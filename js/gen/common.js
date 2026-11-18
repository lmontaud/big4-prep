/* Big4 Prep — outils communs aux générateurs de questions (numérique et abstrait).
   Logique pure : fonctionne dans le navigateur et sous Node (tests). */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};
  var U = BP.util || (typeof require !== 'undefined' ? require('../core/util.js') : null);

  /** Texte selon la langue de la question. */
  function T(lang, fr, en) { return lang === 'en' ? en : fr; }

  var CUR = {
    eur: { fr: ' €', en: '€', before: true },
    usd: { fr: ' $', en: '$', before: true },
    gbp: { fr: ' £', en: '£', before: true },
    chf: { fr: ' CHF', en: 'CHF ', before: true },
    jpy: { fr: ' ¥', en: '¥', before: true }
  };

  /**
   * Formate une valeur avec son unité.
   * unit : pct | pp | eur | usd | gbp | chf | jpy | keur | meur | num | x | days | months | hours | units | year
   */
  function fmtVal(v, unit, lang, dec) {
    var n = U.fmtNum(v, lang, dec);
    var fr = lang !== 'en';
    switch (unit) {
      case 'pct': return n + (fr ? ' %' : '%');
      case 'pp': return n + (fr ? ' point' + (Math.abs(v) >= 2 ? 's' : '') : ' percentage point' + (Math.abs(v) === 1 ? '' : 's'));
      case 'eur': case 'usd': case 'gbp': case 'chf': case 'jpy':
        return fr ? n + CUR[unit].fr.replace(' ', ' ') : (v < 0 ? '−' + CUR[unit].en + n.replace('−', '') : CUR[unit].en + n);
      case 'keur': return fr ? n + ' k€' : '€' + n + 'k';
      case 'meur': return fr ? n + ' M€' : '€' + n + 'm';
      case 'x': return n + (fr ? '' : '') ;
      case 'days': return n + (fr ? ' jours' : ' days');
      case 'months': return n + (fr ? ' mois' : ' months');
      case 'hours': return n + (fr ? ' h' : ' hours');
      case 'units': return n + (fr ? ' unités' : ' units');
      case 'people': return n + (fr ? ' personnes' : ' people');
      case 'year': return String(v);
      default: return n;
    }
  }

  /**
   * Construit les propositions d'un QCM.
   * correct : valeur juste ; wrong : [{ v, err }] distracteurs issus d'erreurs typiques.
   * format(v) -> texte affiché. Les doublons (même texte affiché) sont écartés,
   * puis on complète avec des valeurs proches (« erreur de calcul ») jusqu'à `count` propositions.
   * Renvoie { choices: [{ text, value, err }], answer: index }.
   */
  function buildChoices(rng, correct, wrong, format, count, opts) {
    opts = opts || {};
    count = count || 5;
    var good = format(correct);
    var seen = {}; seen[good] = 1;
    var out = [{ text: good, value: correct, err: null }];
    (wrong || []).forEach(function (w) {
      if (out.length >= count) return;
      if (w == null || typeof w.v !== 'number' || !isFinite(w.v)) return;
      if (opts.positive && w.v <= 0) return;
      var t = format(w.v);
      if (seen[t]) return;
      seen[t] = 1;
      out.push({ text: t, value: w.v, err: w.err || 'calcul' });
    });
    // Compléments : valeurs voisines, assez éloignées pour ne pas être ambiguës.
    var factors = opts.factors || [1.1, 0.9, 1.2, 0.8, 1.25, 0.75, 1.15, 0.85, 1.3, 0.7, 1.5, 0.5];
    for (var i = 0; out.length < count && i < factors.length * 3; i++) {
      var f = factors[i % factors.length];
      var v = opts.near ? opts.near(correct, i) : correct * f + (i >= factors.length ? (i % 2 ? 1 : -1) * Math.pow(10, -(opts.dec || 0)) * (i + 1) : 0);
      if (!isFinite(v) || (opts.positive && v <= 0)) continue;
      if (opts.integer) v = Math.round(v);
      var t2 = format(v);
      if (seen[t2]) continue;
      seen[t2] = 1;
      out.push({ text: t2, value: v, err: 'calcul' });
    }
    var shuffled = opts.keepOrder ? out : U.shuffle(out, rng);
    return { choices: shuffled, answer: shuffled.indexOf(out[0]) };
  }

  /** Arrondi d'affichage. */
  function r(v, dec) { return U.round(v, dec); }

  BP.gen = BP.gen || {};
  BP.gen.common = { T: T, fmtVal: fmtVal, buildChoices: buildChoices, r: r };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.gen.common;
})(typeof self !== 'undefined' ? self : globalThis);
