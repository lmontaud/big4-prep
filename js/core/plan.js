/* Big4 Prep — plan de préparation sur 2 ou 4 semaines avant une date de test. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};
  var U = BP.util || (typeof require !== 'undefined' ? require('./util.js') : null);

  var LABELS = {
    numerique: 'Numérique', verbal: 'Verbal', abstrait: 'Abstrait', sjt: 'Mises en situation', technique: 'Technique', anglais: 'Anglais'
  };

  /**
   * opts : { today, testDate, weeks (2|4), weak: modules du plus faible au plus fort, minutes }
   * Renvoie [{ date, daysLeft, type: 'entrainement' | 'simulation' | 'leger', focus: [modules], minutes, note }]
   * Règles : simulation complète tous les 7 jours et à J-2 ; veille du test légère (SJT + stratégie) ;
   * les autres jours, deux modules, les plus faibles revenant deux fois plus souvent.
   */
  function buildPlan(opts) {
    var today = opts.today, test = opts.testDate;
    if (!test || U.diffDays(today, test) < 1) return [];
    var weeks = opts.weeks === 2 ? 2 : 4;
    var start = U.diffDays(today, test) > weeks * 7 ? U.addDays(test, -weeks * 7) : today;
    var weak = (opts.weak && opts.weak.length ? opts.weak : ['numerique', 'verbal', 'abstrait', 'sjt', 'technique']).slice(0, 5);
    while (weak.length < 5) weak.push(['numerique', 'verbal', 'abstrait', 'sjt', 'technique'].filter(function (m) { return weak.indexOf(m) === -1; })[0]);
    var cycle = [weak[0], weak[1], weak[0], weak[2], weak[1], weak[3], weak[0], weak[4]];
    var out = [], k = 0, minutes = opts.minutes || 20;
    for (var d = start; d < test; d = U.addDays(d, 1)) {
      var left = U.diffDays(d, test);
      if (left === 1) {
        out.push({ date: d, daysLeft: left, type: 'leger', focus: ['sjt'], minutes: Math.min(minutes, 15), note: 'Veille du test : quelques mises en situation, relecture de la fiche stratégie, puis repos.' });
      } else if (left === 2 || (left % 7 === 0)) {
        out.push({ date: d, daysLeft: left, type: 'simulation', focus: ['complete'], minutes: 55, note: 'Simulation complète en conditions réelles, puis analyse des erreurs.' });
      } else {
        var a = cycle[k % cycle.length], b = cycle[(k + 3) % cycle.length];
        if (b === a) b = cycle[(k + 4) % cycle.length];
        k++;
        out.push({ date: d, daysLeft: left, type: 'entrainement', focus: [a, b], minutes: minutes, note: 'Entraînement : ' + LABELS[a] + ' puis ' + LABELS[b] + '.' });
      }
    }
    return out;
  }

  BP.plan = { buildPlan: buildPlan, LABELS: LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.plan;
})(typeof self !== 'undefined' ? self : globalThis);
