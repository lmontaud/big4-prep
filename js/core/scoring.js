/* Big4 Prep — formats de simulation, notation et percentile indicatif. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  /* Formats proches de ceux annoncés par les éditeurs utilisés par les Big 4 (voir DECISIONS.md).
     noBack : impossible de revenir sur une question validée ou passée. */
  var FORMATS = {
    numerique: { label: 'Raisonnement numérique', n: 18, minutes: 25, noBack: true },
    verbal: { label: 'Raisonnement verbal', n: 30, minutes: 19, noBack: true },
    abstrait: { label: 'Raisonnement abstrait', n: 24, minutes: 25, noBack: true },
    sjt: { label: 'Mises en situation', n: 16, minutes: 25, noBack: true },
    technique: { label: 'Connaissances techniques', n: 20, minutes: 20, noBack: true },
    complete: {
      label: 'Simulation complète', noBack: true,
      sections: [
        { module: 'numerique', n: 12, minutes: 16 },
        { module: 'verbal', n: 16, minutes: 11 },
        { module: 'abstrait', n: 12, minutes: 12 },
        { module: 'sjt', n: 8, minutes: 12 }
      ]
    }
  };

  /* Groupe de référence FICTIF : moyenne et écart-type du taux de réussite d'un candidat
     « jeune diplômé finance ». Sert uniquement à donner un ordre de grandeur. */
  var NORMS = {
    numerique: { mean: 0.55, sd: 0.18 }, verbal: { mean: 0.58, sd: 0.16 }, abstrait: { mean: 0.55, sd: 0.18 },
    sjt: { mean: 0.65, sd: 0.13 }, technique: { mean: 0.6, sd: 0.17 }, complete: { mean: 0.58, sd: 0.14 }
  };

  /** Fonction de répartition de la loi normale (approximation d'Abramowitz et Stegun, erreur < 1e-7). */
  function normCdf(z) {
    var t = 1 / (1 + 0.2316419 * Math.abs(z));
    var d = 0.3989423 * Math.exp(-z * z / 2);
    var p = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    return z > 0 ? 1 - p : p;
  }

  /** Percentile indicatif (1 à 99) pour un taux de réussite donné. */
  function percentile(module, rate) {
    var n = NORMS[module] || NORMS.complete;
    var p = Math.round(normCdf((rate - n.mean) / n.sd) * 100);
    return Math.max(1, Math.min(99, p));
  }

  /**
   * Bilan d'une simulation.
   * answers : [{ points (0..1, null si non répondue), ms, targetSec, err, gen, module }]
   */
  function summarize(answers, module, durMs) {
    var n = answers.length, pts = 0, answered = 0, skipped = 0, totalMs = 0, slow = [], errs = {}, byModule = {};
    answers.forEach(function (a, i) {
      var mod = a.module || module;
      byModule[mod] = byModule[mod] || { n: 0, points: 0 };
      byModule[mod].n++;
      if (a.points == null) { skipped++; return; }
      answered++;
      pts += a.points;
      byModule[mod].points += a.points;
      totalMs += a.ms || 0;
      if (a.targetSec && a.ms > a.targetSec * 1500) slow.push(i);
      if (a.points < 1 && a.err) errs[a.err] = (errs[a.err] || 0) + 1;
    });
    var rate = n ? pts / n : 0;
    return {
      n: n, correct: Math.round(pts * 100) / 100, answered: answered, skipped: skipped,
      pct: Math.round(rate * 1000) / 10, avgMs: answered ? Math.round(totalMs / answered) : 0,
      slow: slow, errors: errs, byModule: byModule, durMs: durMs || 0,
      percentile: percentile(module, rate)
    };
  }

  /* ---------- Mises en situation ---------- */

  /** Indices des réponses classées de la plus à la moins efficace. */
  function sjtOrder(item) {
    return item.options.map(function (o, i) { return i; }).sort(function (a, b) { return item.options[b].score - item.options[a].score; });
  }

  /**
   * Note une réponse SJT.
   * best-worst : response = { best, worst } ; 1 point par choix juste, divisé par 2.
   * rank       : response = { order: [indices du plus au moins efficace] } ;
   *              points = 1 − (somme des écarts de rang) ÷ 8 (8 = écart maximal pour 4 réponses).
   * Résultat pour la répétition espacée : correct (tout juste), almost (presque), wrong.
   */
  function scoreSJT(item, response) {
    var order = sjtOrder(item);
    if (item.type === 'rank') {
      var user = (response && response.order) || [], disp = 0;
      if (user.length !== order.length) return { points: 0, result: 'wrong', disp: 8 };
      order.forEach(function (idx, pos) { disp += Math.abs(user.indexOf(idx) - pos); });
      var pts = Math.max(0, 1 - disp / 8);
      return { points: pts, result: disp === 0 ? 'correct' : disp <= 2 ? 'almost' : 'wrong', disp: disp };
    }
    var bestOk = !!response && response.best === order[0];
    var worstOk = !!response && response.worst === order[order.length - 1];
    var p = ((bestOk ? 1 : 0) + (worstOk ? 1 : 0)) / 2;
    return { points: p, result: p === 1 ? 'correct' : p === 0.5 ? 'almost' : 'wrong', bestOk: bestOk, worstOk: worstOk };
  }

  BP.scoring = { FORMATS: FORMATS, NORMS: NORMS, normCdf: normCdf, percentile: percentile, summarize: summarize, sjtOrder: sjtOrder, scoreSJT: scoreSJT };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.scoring;
})(typeof self !== 'undefined' ? self : globalThis);
