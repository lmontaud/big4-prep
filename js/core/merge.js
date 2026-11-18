/* Big4 Prep — fusion de deux progressions (synchronisation entre appareils).
   Règles (reprises d'English Pro et étendues) :
   - fiches de révision : la révision la plus récente l'emporte ;
   - XP et temps d'entraînement : un compteur par appareil, maximum par jour (jamais de double comptage) ;
   - journal des réponses et bilans de simulation : union par identifiant (ids préfixés par l'appareil) ;
   - candidatures : par identifiant, la modification la plus récente l'emporte (les suppressions sont propagées) ;
   - plan de préparation : le plus récemment modifié ;
   - série : la plus avancée, puis validation du jour si le temps fusionné atteint l'objectif ;
   - réglages : propres à chaque appareil. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function clone(x) { return JSON.parse(JSON.stringify(x)); }

  function newer(a, b) {
    if (!b) return true;
    if (!a) return false;
    if ((a.ts || 0) !== (b.ts || 0)) return (a.ts || 0) > (b.ts || 0);
    if ((a.last || '') !== (b.last || '')) return (a.last || '') > (b.last || '');
    return (a.seen || 0) > (b.seen || 0);
  }

  function copyCounter(c) {
    var days = {};
    if (c && isObj(c.days)) Object.keys(c.days).forEach(function (k) { days[k] = +c.days[k] || 0; });
    return { total: (c && +c.total) || 0, days: days };
  }

  function maxCounter(a, b) {
    var out = copyCounter(a);
    if (b && isObj(b.days)) Object.keys(b.days).forEach(function (k) { out.days[k] = Math.max(out.days[k] || 0, +b.days[k] || 0); });
    var sum = 0;
    Object.keys(out.days).forEach(function (k) { sum += out.days[k]; });
    out.total = Math.max(sum, (a && +a.total) || 0, (b && +b.total) || 0);
    return out;
  }

  function counters(state) {
    var all = {};
    Object.keys(state.peers || {}).forEach(function (id) { all[id] = state.peers[id]; });
    all[state.deviceId] = { xp: state.xp, ms: state.ms };
    return all;
  }

  function unionById(a, b, max, sortKey) {
    var map = {}, order = [];
    (a || []).concat(b || []).forEach(function (x) {
      if (!x || !x.id) return;
      if (!map[x.id]) order.push(x.id);
      map[x.id] = map[x.id] || x;
    });
    var out = order.map(function (id) { return clone(map[id]); });
    if (sortKey) out.sort(function (x, y) { return (x[sortKey] || 0) - (y[sortKey] || 0); });
    return max ? out.slice(-max) : out;
  }

  function mergeStates(local, remote, today) {
    var out = clone(local);
    if (!remote) return out;
    var r = remote;

    Object.keys(r.cards || {}).forEach(function (id) {
      if (newer(r.cards[id], out.cards[id])) out.cards[id] = clone(r.cards[id]);
    });

    var mine = local.deviceId, rc = counters(r), peers = {};
    Object.keys(local.peers || {}).forEach(function (id) { peers[id] = { xp: copyCounter(local.peers[id].xp), ms: copyCounter(local.peers[id].ms) }; });
    Object.keys(rc).forEach(function (id) {
      if (id === mine) { out.xp = maxCounter(out.xp, rc[id].xp); out.ms = maxCounter(out.ms, rc[id].ms); }
      else {
        var p = peers[id] || { xp: null, ms: null };
        peers[id] = { xp: maxCounter(p.xp, rc[id].xp), ms: maxCounter(p.ms, rc[id].ms) };
      }
    });
    out.peers = peers;

    out.log = unionById(local.log, r.log, (BP.store && BP.store.LOG_MAX) || 6000, 'ts');
    out.sims = unionById(local.sims, r.sims, 300, 'ts');

    var apps = {}, order = [];
    (local.apps || []).concat(r.apps || []).forEach(function (a) {
      if (!a || !a.id) return;
      if (!apps[a.id]) { order.push(a.id); apps[a.id] = a; }
      else if ((a.updatedAt || 0) > (apps[a.id].updatedAt || 0)) apps[a.id] = a;
    });
    out.apps = order.map(function (id) { return clone(apps[id]); });

    var lp = local.plan || {}, rp = r.plan || {};
    out.plan = clone((rp.updatedAt || 0) > (lp.updatedAt || 0) ? rp : lp);

    var seen = clone(local.seenPassages || {});
    Object.keys(r.seenPassages || {}).forEach(function (k) { if (!seen[k] || r.seenPassages[k] > seen[k]) seen[k] = r.seenPassages[k]; });
    out.seenPassages = seen;

    var a = local.streak || {}, b = r.streak || {};
    var pick = (b.last || '') > (a.last || '') || ((b.last || '') === (a.last || '') && (b.count | 0) > (a.count | 0)) ? b : a;
    var frozen = {};
    (a.frozen || []).concat(b.frozen || []).forEach(function (d) { frozen[d] = 1; });
    out.streak = { count: pick.count | 0, best: Math.max(a.best | 0, b.best | 0, pick.count | 0), last: pick.last || null, freezes: pick.freezes | 0, frozen: Object.keys(frozen).sort().slice(-60) };

    out.sessions = Math.max(local.sessions | 0, r.sessions | 0);
    var maxSeq = local.logSeq | 0;
    out.log.forEach(function (e) { var p = e.id.split('-'); if (p[0] === mine) maxSeq = Math.max(maxSeq, +p[1] || 0); });
    out.logSeq = maxSeq;
    out.createdAt = Math.min(local.createdAt || Infinity, r.createdAt || Infinity);
    if (!isFinite(out.createdAt)) out.createdAt = 0;

    if (today && BP.game) BP.game.checkGoal(out, today);
    return out;
  }

  /** Une sauvegarde importée d'un autre appareil : ses compteurs passent sous l'identifiant de cet autre appareil. */
  function adoptImported(imported, localDeviceId) {
    var s = imported;
    if (!localDeviceId || s.deviceId === localDeviceId) return s;
    var oldId = s.deviceId;
    s.peers = s.peers || {};
    var own = s.peers[localDeviceId];
    delete s.peers[localDeviceId];
    if (oldId) {
      var prev = s.peers[oldId] || {};
      s.peers[oldId] = { xp: maxCounter(prev.xp, s.xp), ms: maxCounter(prev.ms, s.ms) };
    }
    s.xp = own ? copyCounter(own.xp) : { total: 0, days: {} };
    s.ms = own ? copyCounter(own.ms) : { total: 0, days: {} };
    s.deviceId = localDeviceId;
    // Les ids du journal créés ensuite sur cet appareil ne doivent pas en écraser d'anciens
    var maxSeq = 0;
    (s.log || []).forEach(function (e) { var p = e.id.split('-'); if (p[0] === localDeviceId) maxSeq = Math.max(maxSeq, +p[1] || 0); });
    s.logSeq = Math.max(s.logSeq | 0, maxSeq);
    return s;
  }

  function fingerprint(state) {
    var lastLog = state.log && state.log.length ? state.log[state.log.length - 1].id + ':' + state.log.length : '';
    return JSON.stringify([state.cards, state.xp, state.ms, state.peers, lastLog, (state.sims || []).length, state.apps, state.plan, state.streak]);
  }

  BP.merge = { mergeStates: mergeStates, adoptImported: adoptImported, fingerprint: fingerprint, newer: newer, maxCounter: maxCounter };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.merge;
})(typeof self !== 'undefined' ? self : globalThis);
