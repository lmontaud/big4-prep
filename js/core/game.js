/* Big4 Prep — gamification : XP, temps d'entraînement, objectif quotidien, série et gels de série.
   Reprise d'English Pro SANS les cœurs : en préparation aux tests, on doit pouvoir enchaîner les erreurs.
   L'objectif quotidien se compte en MINUTES d'entraînement effectif (temps passé sur les questions,
   plafonné par question), l'XP sert de score cumulé. Toutes les fonctions reçoivent le jour en paramètre. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};
  var U = BP.util || (typeof require !== 'undefined' ? require('./util.js') : null);

  var MAX_FREEZES = 2;
  var GOALS = [10, 20, 30];               // minutes par jour
  var XP = { correct: 10, almost: 6, wrong: 2, simulation: 30, game: 5 };

  function goalMinutes(state) {
    var g = state.settings.goalMinutes;
    return GOALS.indexOf(g) === -1 ? 20 : g;
  }

  function dayValue(counter, day) { return (counter && counter.days && counter.days[day]) || 0; }

  /** Somme d'un compteur (xp ou ms) pour un jour, tous appareils confondus. */
  function sumDay(state, field, day) {
    var n = dayValue(state[field], day);
    var peers = state.peers || {};
    Object.keys(peers).forEach(function (id) { n += dayValue(peers[id][field], day); });
    return n;
  }
  function sumTotal(state, field) {
    var n = (state[field] && state[field].total) || 0;
    var peers = state.peers || {};
    Object.keys(peers).forEach(function (id) { n += (peers[id][field] && peers[id][field].total) || 0; });
    return n;
  }

  function todayXp(state, day) { return sumDay(state, 'xp', day); }
  function totalXp(state) { return sumTotal(state, 'xp'); }
  function todayMinutes(state, day) { return sumDay(state, 'ms', day) / 60000; }
  function totalMinutes(state) { return sumTotal(state, 'ms') / 60000; }

  function goalReached(state, day) { return todayMinutes(state, day) >= goalMinutes(state); }

  /* ---------- Série (identique à English Pro) ---------- */

  function settleStreak(state, today) {
    var s = state.streak;
    if (!s.last) return {};
    var gap = U.diffDays(s.last, today);
    if (gap <= 1) return {};
    var missed = gap - 1;
    if (s.count > 0 && s.freezes >= missed) {
      s.freezes -= missed;
      for (var i = missed; i >= 1; i--) s.frozen.push(U.addDays(today, -i));
      if (s.frozen.length > 60) s.frozen = s.frozen.slice(-60);
      s.last = U.addDays(today, -1);
      return { frozen: missed };
    }
    if (s.count > 0) { s.count = 0; return { broken: true }; }
    return {};
  }

  function currentStreak(state, today) { settleStreak(state, today); return state.streak.count; }

  function checkGoal(state, today) {
    var out = { reachedNow: false, freezeEarned: false };
    settleStreak(state, today);
    var s = state.streak;
    if (!goalReached(state, today) || s.last === today) return out;
    s.count = (s.count > 0 && s.last === U.addDays(today, -1)) ? s.count + 1 : 1;
    s.last = today;
    if (s.count > s.best) s.best = s.count;
    out.reachedNow = true;
    if (s.count % 7 === 0 && s.freezes < MAX_FREEZES) { s.freezes += 1; out.freezeEarned = true; }
    return out;
  }

  function addTo(counter, amount, day) {
    if (!counter.days) counter.days = {};
    counter.total = (counter.total || 0) + amount;
    counter.days[day] = (counter.days[day] || 0) + amount;
  }

  /** Enregistre de l'XP et du temps d'entraînement, puis vérifie l'objectif du jour. */
  function addActivity(state, xp, ms, today) {
    if (xp) addTo(state.xp, Math.round(xp), today);
    if (ms) addTo(state.ms, Math.round(ms), today);
    return checkGoal(state, today);
  }

  /** Niveau affiché à partir de l'XP cumulée (paliers croissants). */
  function level(xp) {
    var lvl = 1, need = 200, acc = 0;
    while (xp >= acc + need) { acc += need; lvl++; need = Math.round(need * 1.25); }
    return { level: lvl, into: xp - acc, need: need };
  }

  BP.game = {
    MAX_FREEZES: MAX_FREEZES, GOALS: GOALS, XP: XP, goalMinutes: goalMinutes,
    todayXp: todayXp, totalXp: totalXp, todayMinutes: todayMinutes, totalMinutes: totalMinutes,
    goalReached: goalReached, settleStreak: settleStreak, currentStreak: currentStreak, checkGoal: checkGoal,
    addActivity: addActivity, level: level
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.game;
})(typeof self !== 'undefined' ? self : globalThis);
