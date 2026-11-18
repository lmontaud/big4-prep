/* Big4 Prep — état de l'application : valeurs par défaut, sauvegarde locale, export / import JSON,
   journal des réponses, simulations, candidatures et plan de préparation. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  var STORAGE_KEY = 'big4-prep-state-v1';
  var SIM_KEY = 'big4-prep-active-sim-v1';
  var APP_ID = 'big4-prep';
  var VERSION = 1;
  var LOG_MAX = 6000;
  var MODULES = ['numerique', 'verbal', 'abstrait', 'sjt', 'technique', 'anglais'];
  var STATUSES = ['a-passer', 'passe', 'reussi', 'refuse'];

  function newDeviceId() {
    var s = '';
    for (var i = 0; i < 8; i++) s += 'abcdefghijkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 32));
    return s;
  }

  function defaultState(nowMs) {
    return {
      version: VERSION,
      deviceId: newDeviceId(),
      createdAt: nowMs || 0,
      settings: {
        goalMinutes: 20,           // 10, 20 ou 30
        reminderTime: '19:00',
        notifications: false,
        questionLang: 'mix',       // mix, fr ou en (numérique et verbal)
        indicativeTimer: true      // chrono indicatif en entraînement
      },
      cards: {},                   // répétition espacée (technique, SJT, anglais)
      xp: { total: 0, days: {} },  // XP de CET appareil
      ms: { total: 0, days: {} },  // temps d'entraînement de CET appareil (ms)
      peers: {},                   // compteurs des autres appareils : { id: { xp, ms } }
      streak: { count: 0, best: 0, last: null, freezes: 0, frozen: [] },
      log: [],                     // journal des réponses : { id, ts, m, g, ok, ms, tgt, e, s, l }
      logSeq: 0,
      sims: [],                    // bilans de simulation
      apps: [],                    // candidatures
      plan: { testDate: null, weeks: 4, updatedAt: 0 },
      seenPassages: {},            // textes verbaux déjà lus : { id: jour }
      sessions: 0,
      lastExport: null
    };
  }

  function isObj(v) { return v && typeof v === 'object' && !Array.isArray(v); }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max || 200) : ''; }
  function isDay(v) {
    if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
    var p = v.split('-'), d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return d.getUTCFullYear() === +p[0] && d.getUTCMonth() === +p[1] - 1 && d.getUTCDate() === +p[2];
  }

  function cleanCounter(c) {
    var out = { total: 0, days: {} };
    if (!isObj(c)) return out;
    out.total = Math.max(0, +c.total || 0);
    if (isObj(c.days)) Object.keys(c.days).forEach(function (k) { if (isDay(k)) out.days[k] = Math.max(0, +c.days[k] || 0); });
    return out;
  }

  function cleanLog(e) {
    if (!isObj(e) || typeof e.id !== 'string' || MODULES.indexOf(e.m) === -1) return null;
    return {
      id: e.id.slice(0, 60), ts: +e.ts || 0, m: e.m, g: str(e.g, 40),
      ok: e.ok === 1 || e.ok === 0.5 ? e.ok : 0,
      ms: Math.max(0, Math.min(+e.ms || 0, 600000)), tgt: Math.max(0, +e.tgt || 0),
      e: typeof e.e === 'string' ? e.e.slice(0, 20) : null, s: e.s === 's' ? 's' : 't', l: e.l === 'en' ? 'en' : 'fr'
    };
  }

  function cleanApp(a) {
    if (!isObj(a) || typeof a.id !== 'string') return null;
    return {
      id: a.id.slice(0, 60), cabinet: str(a.cabinet, 40), poste: str(a.poste, 120),
      date: isDay(a.date) ? a.date : null, statut: STATUSES.indexOf(a.statut) === -1 ? 'a-passer' : a.statut,
      note: str(a.note, 500), updatedAt: +a.updatedAt || 0, deleted: !!a.deleted
    };
  }

  function cleanSim(s) {
    if (!isObj(s) || typeof s.id !== 'string') return null;
    return {
      id: s.id.slice(0, 60), ts: +s.ts || 0, module: str(s.module, 20), n: s.n | 0, correct: +s.correct || 0,
      skipped: s.skipped | 0, pct: +s.pct || 0, avgMs: +s.avgMs || 0, percentile: s.percentile | 0, durMs: +s.durMs || 0,
      label: str(s.label, 80)
    };
  }

  /** Complète un état partiel ou ancien avec les valeurs par défaut (sans rien écraser). */
  function migrate(raw, nowMs) {
    var s = defaultState(nowMs);
    if (!isObj(raw)) return s;
    s.createdAt = typeof raw.createdAt === 'number' ? raw.createdAt : s.createdAt;
    if (typeof raw.deviceId === 'string' && /^[a-z0-9]{4,32}$/.test(raw.deviceId)) s.deviceId = raw.deviceId;
    if (isObj(raw.settings)) {
      Object.keys(s.settings).forEach(function (k) {
        if (raw.settings[k] !== undefined && typeof raw.settings[k] === typeof s.settings[k]) s.settings[k] = raw.settings[k];
      });
    }
    if ([10, 20, 30].indexOf(s.settings.goalMinutes) === -1) s.settings.goalMinutes = 20;
    if (['mix', 'fr', 'en'].indexOf(s.settings.questionLang) === -1) s.settings.questionLang = 'mix';
    if (!/^\d{2}:\d{2}$/.test(s.settings.reminderTime)) s.settings.reminderTime = '19:00';
    if (isObj(raw.cards)) {
      Object.keys(raw.cards).forEach(function (id) {
        var c = raw.cards[id];
        if (!isObj(c)) return;
        s.cards[id] = {
          step: Math.max(0, Math.min(7, c.step | 0)), due: isDay(c.due) ? c.due : null,
          seen: c.seen | 0, ok: c.ok | 0, ko: c.ko | 0, last: isDay(c.last) ? c.last : null, ts: typeof c.ts === 'number' ? c.ts : 0
        };
      });
    }
    s.xp = cleanCounter(raw.xp);
    s.ms = cleanCounter(raw.ms);
    if (isObj(raw.peers)) {
      Object.keys(raw.peers).forEach(function (id) {
        if (id === s.deviceId || !isObj(raw.peers[id])) return;
        s.peers[id] = { xp: cleanCounter(raw.peers[id].xp), ms: cleanCounter(raw.peers[id].ms) };
      });
    }
    if (isObj(raw.streak)) {
      s.streak.count = Math.max(0, raw.streak.count | 0);
      s.streak.best = Math.max(s.streak.count, raw.streak.best | 0);
      s.streak.last = isDay(raw.streak.last) ? raw.streak.last : null;
      s.streak.freezes = Math.max(0, Math.min(2, raw.streak.freezes | 0));
      s.streak.frozen = Array.isArray(raw.streak.frozen) ? raw.streak.frozen.filter(isDay).slice(-60) : [];
    }
    if (Array.isArray(raw.log)) s.log = raw.log.map(cleanLog).filter(Boolean).slice(-LOG_MAX);
    s.logSeq = Math.max(raw.logSeq | 0, 0);
    if (Array.isArray(raw.sims)) s.sims = raw.sims.map(cleanSim).filter(Boolean).slice(-300);
    if (Array.isArray(raw.apps)) s.apps = raw.apps.map(cleanApp).filter(Boolean).slice(-200);
    if (isObj(raw.plan)) {
      s.plan.testDate = isDay(raw.plan.testDate) ? raw.plan.testDate : null;
      s.plan.weeks = raw.plan.weeks === 2 ? 2 : 4;
      s.plan.updatedAt = +raw.plan.updatedAt || 0;
    }
    if (isObj(raw.seenPassages)) Object.keys(raw.seenPassages).forEach(function (k) { if (isDay(raw.seenPassages[k])) s.seenPassages[k] = raw.seenPassages[k]; });
    s.sessions = raw.sessions | 0;
    s.lastExport = typeof raw.lastExport === 'number' ? raw.lastExport : null;
    return s;
  }

  function exportState(state, nowMs) {
    return JSON.stringify({ app: APP_ID, version: VERSION, exportedAt: nowMs || 0, state: state }, null, 1);
  }

  function importState(text, nowMs) {
    var data;
    try { data = JSON.parse(text); } catch (err) { return { ok: false, error: 'Ce fichier n\'est pas un JSON valide.' }; }
    if (!isObj(data) || data.app !== APP_ID || !isObj(data.state)) {
      if (isObj(data) && data.app === 'english-pro') return { ok: false, error: 'Ce fichier est une sauvegarde d\'English Pro, pas de Big4 Prep.' };
      return { ok: false, error: 'Ce fichier n\'est pas une sauvegarde Big4 Prep.' };
    }
    if (typeof data.version === 'number' && data.version > VERSION) return { ok: false, error: 'Cette sauvegarde vient d\'une version plus récente de l\'application.' };
    return { ok: true, state: migrate(data.state, nowMs) };
  }

  function createStore(backend) {
    var memory = null, simMemory = null, persistent = true;
    try {
      if (!backend) throw new Error('no storage');
      backend.setItem(STORAGE_KEY + ':test', '1');
      backend.removeItem(STORAGE_KEY + ':test');
    } catch (err) { persistent = false; }
    return {
      get persistent() { return persistent; },
      load: function (nowMs) {
        var raw = null;
        try { raw = persistent ? backend.getItem(STORAGE_KEY) : memory; } catch (err) { persistent = false; raw = memory; }
        if (!raw) return defaultState(nowMs);
        try { return migrate(JSON.parse(raw), nowMs); } catch (err2) { return defaultState(nowMs); }
      },
      save: function (state) {
        var text = JSON.stringify(state);
        memory = text;
        if (!persistent) return false;
        try { backend.setItem(STORAGE_KEY, text); return true; } catch (err) { persistent = false; return false; }
      },
      /* Simulation en cours : sauvegardée à chaque réponse pour reprendre là où l'on en était
         si le téléphone ferme l'app en arrière-plan (le chrono, lui, a continué). */
      saveSim: function (sim) {
        var text = sim ? JSON.stringify(sim) : null;
        simMemory = text;
        if (!persistent) return;
        try { if (text) backend.setItem(SIM_KEY, text); else backend.removeItem(SIM_KEY); } catch (err) { /* rien */ }
      },
      loadSim: function () {
        var raw = simMemory;
        try { if (persistent) raw = backend.getItem(SIM_KEY); } catch (err) { /* rien */ }
        try { return raw ? JSON.parse(raw) : null; } catch (err2) { return null; }
      },
      clear: function () {
        memory = null; simMemory = null;
        try { if (persistent) { backend.removeItem(STORAGE_KEY); backend.removeItem(SIM_KEY); } } catch (err) { /* rien */ }
      }
    };
  }

  /* ---------- Journal des réponses ---------- */

  /** Ajoute une réponse au journal. entry : { m, g, ok, ms, tgt, e, s, l } */
  function logAnswer(state, entry, nowMs) {
    state.logSeq = (state.logSeq | 0) + 1;
    var e = cleanLog({
      id: state.deviceId + '-' + state.logSeq, ts: nowMs, m: entry.m, g: entry.g, ok: entry.ok,
      ms: entry.ms, tgt: entry.tgt, e: entry.e || null, s: entry.s, l: entry.l
    });
    if (!e) return null;
    state.log.push(e);
    if (state.log.length > LOG_MAX) state.log = state.log.slice(-LOG_MAX);
    return e;
  }

  /* ---------- Candidatures ---------- */

  function saveApp(state, input, nowMs) {
    var cabinet = str(input.cabinet, 40).trim(), poste = str(input.poste, 120).trim();
    if (!cabinet) return { ok: false, error: 'Indiquez le cabinet.' };
    if (input.date && !isDay(input.date)) return { ok: false, error: 'Date invalide.' };
    var existing = input.id ? state.apps.filter(function (a) { return a.id === input.id; })[0] : null;
    var app = existing || { id: 'app-' + state.deviceId + '-' + (nowMs || 0).toString(36) };
    app.cabinet = cabinet; app.poste = poste || 'Auditeur financier junior';
    app.date = input.date || null; app.statut = STATUSES.indexOf(input.statut) === -1 ? 'a-passer' : input.statut;
    app.note = str(input.note, 500); app.updatedAt = nowMs || 0; app.deleted = false;
    if (!existing) state.apps.push(app);
    return { ok: true, app: app };
  }

  function deleteApp(state, id, nowMs) {
    var a = state.apps.filter(function (x) { return x.id === id; })[0];
    if (!a) return false;
    a.deleted = true; a.updatedAt = nowMs || 0;
    return true;
  }

  /** Candidatures visibles, triées par date de test (les sans date à la fin). */
  function activeApps(state) {
    return state.apps.filter(function (a) { return !a.deleted; }).sort(function (a, b) {
      if (!a.date && !b.date) return b.updatedAt - a.updatedAt;
      if (!a.date) return 1;
      if (!b.date) return -1;
      return a.date < b.date ? -1 : a.date > b.date ? 1 : 0;
    });
  }

  BP.store = {
    STORAGE_KEY: STORAGE_KEY, SIM_KEY: SIM_KEY, APP_ID: APP_ID, VERSION: VERSION, LOG_MAX: LOG_MAX, MODULES: MODULES, STATUSES: STATUSES,
    newDeviceId: newDeviceId, defaultState: defaultState, migrate: migrate, exportState: exportState, importState: importState,
    createStore: createStore, logAnswer: logAnswer, saveApp: saveApp, deleteApp: deleteApp, activeApps: activeApps,
    cleanCounter: cleanCounter
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.store;
})(typeof self !== 'undefined' ? self : globalThis);
