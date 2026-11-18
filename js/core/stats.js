/* Big4 Prep — statistiques calculées à partir du journal des réponses. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  function ofModule(log, module, last) {
    var list = log.filter(function (e) { return e.m === module; });
    return last ? list.slice(-last) : list;
  }

  /** Taux de réussite et vitesse sur les dernières réponses d'un module. */
  function moduleStats(log, module, last) {
    var list = ofModule(log, module, last || 60), pts = 0, ratio = 0, nr = 0, ms = 0;
    list.forEach(function (e) {
      pts += e.ok; ms += e.ms;
      if (e.tgt > 0) { ratio += e.ms / (e.tgt * 1000); nr++; }
    });
    return { n: list.length, acc: list.length ? pts / list.length : 0, speed: nr ? ratio / nr : 0, avgMs: list.length ? ms / list.length : 0 };
  }

  /** Réussite par générateur ou par item (pour le choix adaptatif). Fenêtre : 400 dernières réponses du module. */
  function genStats(log, module) {
    var out = {};
    ofModule(log, module, 400).forEach(function (e) {
      var s = out[e.g] = out[e.g] || { n: 0, ok: 0, ms: 0 };
      s.n++; s.ok += e.ok; s.ms += e.ms;
    });
    return out;
  }

  /** Nombre d'erreurs par type (réponses fausses uniquement). */
  function errorStats(log, module, last) {
    var out = {};
    ofModule(log, module, last || 300).forEach(function (e) { if (e.ok < 1 && e.e) out[e.e] = (out[e.e] || 0) + 1; });
    return out;
  }

  function levelLabel(st) {
    if (st.n < 10) return { key: 'eval', label: 'À évaluer' };
    if (st.acc < 0.5) return { key: 'low', label: 'À renforcer' };
    if (st.acc < 0.7) return { key: 'mid', label: 'En progrès' };
    if (st.acc < 0.85) return { key: 'good', label: 'Solide' };
    return { key: 'top', label: 'Prêt' };
  }

  function speedLabel(st) {
    if (!st.n || !st.speed) return '';
    if (st.speed <= 0.8) return 'rapide';
    if (st.speed <= 1.1) return 'dans le temps';
    return 'trop lent';
  }

  /** Modules du plus faible au plus fort (les modules jamais travaillés passent en tête). */
  function weakest(log, modules) {
    return modules.slice().sort(function (a, b) {
      var sa = moduleStats(log, a), sb = moduleStats(log, b);
      var va = sa.n < 10 ? -1 + sa.n / 100 : sa.acc - (sa.speed > 1.1 ? 0.1 : 0);
      var vb = sb.n < 10 ? -1 + sb.n / 100 : sb.acc - (sb.speed > 1.1 ? 0.1 : 0);
      return va - vb;
    });
  }

  BP.stats = { moduleStats: moduleStats, genStats: genStats, errorStats: errorStats, levelLabel: levelLabel, speedLabel: speedLabel, weakest: weakest };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.stats;
})(typeof self !== 'undefined' ? self : globalThis);
