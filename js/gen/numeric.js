/* Big4 Prep — générateurs de questions de raisonnement numérique.
   Chaque générateur tire des données réalistes au hasard, CALCULE la réponse et construit
   les distracteurs à partir des erreurs typiques :
     base       : base de calcul inversée (diviser par la mauvaise valeur)
     pp         : confusion point de pourcentage / pourcentage
     sens       : mauvais sens (multiplier au lieu de diviser, signe inversé)
     conversion : conversion de devise ou d'unité oubliée ou mal faite
     compose    : croissance simple au lieu de composée, pourcentages additionnés
     periodes   : mauvais nombre de périodes (années, mois)
     moyenne    : moyenne simple au lieu de pondérée, mauvais dénominateur
     lecture    : mauvaise ligne, mauvaise année ou mauvais poste lu dans le tableau
     calcul     : erreur de calcul (valeur voisine)
   Toutes les explications sont en français, même pour les questions en anglais. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};
  var U = BP.util || (typeof require !== 'undefined' ? require('../core/util.js') : null);
  var C = (BP.gen && BP.gen.common) || (typeof require !== 'undefined' ? require('./common.js') : null);
  var T = C.T, fv = C.fmtVal, ri = U.randInt, pick = U.pick;

  var ERR_LABELS = {
    base: 'Base de calcul inversée',
    pp: 'Points de % confondus avec des %',
    sens: 'Mauvais sens (× au lieu de ÷, signe)',
    conversion: 'Conversion de devise ou d\'unité',
    compose: 'Croissance simple au lieu de composée',
    periodes: 'Mauvais nombre de périodes',
    moyenne: 'Mauvaise moyenne ou mauvais dénominateur',
    lecture: 'Mauvaise donnée lue dans le tableau',
    calcul: 'Erreur de calcul'
  };

  var REGIONS = {
    fr: ['Île-de-France', 'Auvergne-Rhône-Alpes', 'Nouvelle-Aquitaine', 'Occitanie', 'Hauts-de-France', 'Grand Est'],
    en: ['UK', 'Germany', 'Spain', 'Italy', 'Nordics', 'Benelux']
  };
  var FIRMS = ['Alvéo', 'Norvane', 'Sarthel', 'Kerlis', 'Montavia', 'Brévalis', 'Ortéga Industries', 'Valcourt'];
  var SUBS = { fr: ['Filiale A', 'Filiale B', 'Filiale C'], en: ['Subsidiary A', 'Subsidiary B', 'Subsidiary C'] };

  function L(lang) { return lang === 'en' ? 'en' : 'fr'; }
  function pct(a, b) { return (b - a) / a * 100; }
  function table(title, head, rows, note) { return { kind: 'table', title: title, head: head, rows: rows, note: note || '' }; }
  function n0(v, lang) { return U.fmtNum(v, lang, 0); }
  function signed(v, unit, lang, dec) {
    var t = fv(v, unit, lang, dec);
    return U.round(v, dec) > 0 ? '+' + t : t;
  }
  /** Tire une variation en % non nulle dans [lo, hi]. */
  function change(rng, lo, hi) {
    var c;
    do { c = ri(rng, lo * 10, hi * 10) / 10; } while (Math.abs(c) < 2);
    return c;
  }
  function frf(v, unit, dec) { return fv(v, unit, 'fr', dec); }

  var GENS = [];
  function def(g) { GENS.push(g); }

  /* ---------------- N01 Variation en % ---------------- */
  def({
    id: 'N01', title: 'Variation en pourcentage', skill: 'Pourcentages', difficulty: 1, targetSec: 50, range: [-40, 60],
    make: function (rng, lang) {
      var R = REGIONS[L(lang)], k = 4, regs = U.shuffle(R, rng).slice(0, k), rows = [], a = [], b = [];
      for (var i = 0; i < k; i++) {
        a[i] = ri(rng, 800, 6000, 10);
        b[i] = Math.round(a[i] * (1 + change(rng, -25, 40) / 100));
        rows.push([regs[i], n0(a[i], lang), n0(b[i], lang)]);
      }
      var j = ri(rng, 0, k - 1), v = pct(a[j], b[j]);
      var ch = C.buildChoices(rng, v, [
        { v: pct(b[j], a[j]) * -1, err: 'base' },          // (b-a)/b
        { v: b[j] / a[j] * 100, err: 'sens' },             // ratio au lieu de variation
        { v: -v, err: 'sens' },
        { v: pct(a[(j + 1) % k], b[(j + 1) % k]), err: 'lecture' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'Quelle est la variation du chiffre d\'affaires de la région ' + regs[j] + ' entre 2024 et 2025 ?',
          'What was the percentage change in revenue for ' + regs[j] + ' between 2024 and 2025?'),
        visual: table(T(lang, 'Chiffre d\'affaires par région (k€)', 'Revenue by region (€k)'), [T(lang, 'Région', 'Region'), '2024', '2025'], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Variation = (valeur d\'arrivée − valeur de départ) ÷ valeur de départ × 100.',
          '(' + n0(b[j], 'fr') + ' − ' + n0(a[j], 'fr') + ') ÷ ' + n0(a[j], 'fr') + ' × 100 = ' + signed(v, 'pct', 'fr', 1) + '.'
        ],
        shortcut: 'Divisez directement ' + n0(b[j], 'fr') + ' par ' + n0(a[j], 'fr') + ' = ' + U.fmtNum(b[j] / a[j], 'fr', 3) + ', puis retirez 1 : ' + signed(v, 'pct', 'fr', 1) + '. La base est toujours l\'année de départ.'
      };
    }
  });

  /* ---------------- N02 Points de pourcentage vs pourcentage ---------------- */
  def({
    id: 'N02', title: 'Points de % ou % ?', skill: 'Pourcentages', difficulty: 2, targetSec: 50, range: [-60, 60],
    make: function (rng, lang) {
      var firms = U.shuffle(FIRMS, rng).slice(0, 4), a = [], b = [], rows = [];
      for (var i = 0; i < 4; i++) {
        a[i] = ri(rng, 40, 320) / 10;
        do { b[i] = ri(rng, 40, 320) / 10; } while (Math.abs(b[i] - a[i]) < 0.8 || Math.abs(b[i] - a[i]) > 9 || Math.abs(b[i] - a[i]) / a[i] > 0.6);
        rows.push([firms[i], fv(a[i], 'pct', lang, 1), fv(b[i], 'pct', lang, 1)]);
      }
      var j = ri(rng, 0, 3), askPoints = rng() < 0.5;
      var d = b[j] - a[j], rel = pct(a[j], b[j]);
      var v = askPoints ? d : rel, unit = askPoints ? 'pp' : 'pct';
      var wrong = askPoints
        ? [{ v: rel, err: 'pp' }, { v: -d, err: 'sens' }, { v: (b[j] - a[j]) / b[j] * 100, err: 'base' }, { v: b[(j + 1) % 4] - a[(j + 1) % 4], err: 'lecture' }]
        : [{ v: d, err: 'pp' }, { v: (b[j] - a[j]) / b[j] * 100, err: 'base' }, { v: -rel, err: 'sens' }, { v: pct(a[(j + 1) % 4], b[(j + 1) % 4]), err: 'lecture' }];
      var ch = C.buildChoices(rng, v, wrong, function (x) { return signed(x, unit, lang, 1); }, 5, { dec: 1 });
      return {
        prompt: askPoints
          ? T(lang, 'De combien de points de pourcentage la part de marché de ' + firms[j] + ' a-t-elle évolué entre 2024 et 2025 ?',
            'By how many percentage points did ' + firms[j] + '\'s market share change between 2024 and 2025?')
          : T(lang, 'De combien de pour cent la part de marché de ' + firms[j] + ' a-t-elle évolué entre 2024 et 2025 ?',
            'By what percentage did ' + firms[j] + '\'s market share change between 2024 and 2025?'),
        visual: table(T(lang, 'Parts de marché', 'Market share'), [T(lang, 'Société', 'Company'), '2024', '2025'], rows),
        unit: unit, dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: askPoints ? [
          'Un écart en points de pourcentage est une simple soustraction de deux pourcentages.',
          fv(b[j], 'pct', 'fr', 1) + ' − ' + fv(a[j], 'pct', 'fr', 1) + ' = ' + signed(d, 'pp', 'fr', 1) + '.',
          'La variation relative (' + signed(rel, 'pct', 'fr', 1) + ') répond à une autre question.'
        ] : [
          'Une variation en pour cent se calcule par rapport à la valeur de départ.',
          '(' + U.fmtNum(b[j], 'fr', 1) + ' − ' + U.fmtNum(a[j], 'fr', 1) + ') ÷ ' + U.fmtNum(a[j], 'fr', 1) + ' × 100 = ' + signed(rel, 'pct', 'fr', 1) + '.',
          'L\'écart de ' + signed(d, 'pp', 'fr', 1) + ' est la réponse en points, pas en pour cent.'
        ],
        shortcut: 'Repérez le mot clé : « points » = soustraction ; « pour cent » = division par la valeur de départ.'
      };
    }
  });

  /* ---------------- N03 Part dans le total ---------------- */
  def({
    id: 'N03', title: 'Part dans un total', skill: 'Pourcentages', difficulty: 1, targetSec: 45, range: [3, 70],
    make: function (rng, lang) {
      var regs = U.shuffle(REGIONS[L(lang)], rng).slice(0, 4), a = [], b = [], rows = [];
      for (var i = 0; i < 4; i++) { a[i] = ri(rng, 300, 4000, 5); b[i] = Math.round(a[i] * (1 + change(rng, -15, 25) / 100)); rows.push([regs[i], n0(a[i], lang), n0(b[i], lang)]); }
      var sa = a.reduce(function (s, x) { return s + x; }, 0), sb = b.reduce(function (s, x) { return s + x; }, 0);
      var j = ri(rng, 0, 3), v = b[j] / sb * 100;
      var ch = C.buildChoices(rng, v, [
        { v: b[j] / (sb - b[j]) * 100, err: 'base' },
        { v: a[j] / sa * 100, err: 'lecture' },
        { v: b[j] / Math.max.apply(null, b) * 100, err: 'base' },
        { v: b[j] / sa * 100, err: 'lecture' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: T(lang, 'Quelle part du chiffre d\'affaires total de 2025 la région ' + regs[j] + ' représente-t-elle ?',
          'What share of total 2025 revenue did ' + regs[j] + ' account for?'),
        visual: table(T(lang, 'Chiffre d\'affaires par région (k€)', 'Revenue by region (€k)'), [T(lang, 'Région', 'Region'), '2024', '2025'], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Total 2025 = ' + b.map(function (x) { return n0(x, 'fr'); }).join(' + ') + ' = ' + n0(sb, 'fr') + ' k€.',
          'Part = ' + n0(b[j], 'fr') + ' ÷ ' + n0(sb, 'fr') + ' × 100 = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'Additionnez la seule colonne 2025 ; les données 2024 sont là pour piéger.'
      };
    }
  });

  var RATES = { usd: [1.04, 1.18], gbp: [0.82, 0.89], chf: [0.92, 0.98], jpy: [155, 172] };
  function rateTable(rng, lang) {
    var r = {};
    Object.keys(RATES).forEach(function (k) {
      var lo = RATES[k][0], hi = RATES[k][1];
      r[k] = k === 'jpy' ? ri(rng, lo * 10, hi * 10) / 10 : ri(rng, lo * 10000, hi * 10000) / 10000;
    });
    var rows = [['USD', U.fmtNum(r.usd, lang, 4)], ['GBP', U.fmtNum(r.gbp, lang, 4)], ['CHF', U.fmtNum(r.chf, lang, 4)], ['JPY', U.fmtNum(r.jpy, lang, 1)]];
    return { r: r, visual: table(T(lang, 'Taux de change : 1 EUR =', 'Exchange rates: 1 EUR ='), [T(lang, 'Devise', 'Currency'), T(lang, 'Cours', 'Rate')], rows) };
  }

  /* ---------------- N04 Conversion de devise ---------------- */
  def({
    id: 'N04', title: 'Conversion de devise', skill: 'Devises', difficulty: 1, targetSec: 50, range: [1000, 5e6],
    make: function (rng, lang) {
      var rt = rateTable(rng, lang), cur = pick(rng, ['usd', 'gbp', 'chf']);
      var amt = ri(rng, 20, 900) * 1000, v = amt / rt.r[cur];
      var other = cur === 'usd' ? 'chf' : 'usd';
      var ch = C.buildChoices(rng, v, [
        { v: amt * rt.r[cur], err: 'sens' },
        { v: amt, err: 'conversion' },
        { v: amt / rt.r[other], err: 'lecture' }
      ], function (x) { return fv(x, 'eur', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Une facture fournisseur s\'élève à ' + fv(amt, cur, lang, 0) + '. Quel est son montant en euros ?',
          'A supplier invoice amounts to ' + fv(amt, cur, lang, 0) + '. What is its value in euros?'),
        visual: rt.visual, unit: 'eur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Le tableau donne la valeur de 1 euro en devise : pour passer de la devise à l\'euro, on DIVISE.',
          fv(amt, cur, 'fr', 0) + ' ÷ ' + U.fmtNum(rt.r[cur], 'fr', 4) + ' = ' + frf(v, 'eur', 0) + '.'
        ],
        shortcut: 'Contrôle de vraisemblance : si 1 € vaut plus d\'une unité de devise, le montant en euros est plus petit que le montant en devise (et inversement).'
      };
    }
  });

  /* ---------------- N05 Taux croisé ---------------- */
  def({
    id: 'N05', title: 'Taux croisé', skill: 'Devises', difficulty: 2, targetSec: 70, range: [1000, 5e6],
    make: function (rng, lang) {
      var rt = rateTable(rng, lang), r = rt.r;
      var from = pick(rng, ['gbp', 'chf']), to = 'usd';
      var amt = ri(rng, 10, 600) * 1000, v = amt / r[from] * r[to];
      var ch = C.buildChoices(rng, v, [
        { v: amt * r[from] / r[to], err: 'sens' },
        { v: amt / r[from], err: 'conversion' },
        { v: amt * r[to], err: 'conversion' },
        { v: amt / r[from] / r[to], err: 'sens' }
      ], function (x) { return fv(x, 'usd', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Un contrat de ' + fv(amt, from, lang, 0) + ' doit être présenté en dollars américains. Quel est son montant en USD ?',
          'A contract worth ' + fv(amt, from, lang, 0) + ' must be reported in US dollars. What is its value in USD?'),
        visual: rt.visual, unit: 'usd', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'On passe par l\'euro : d\'abord ' + from.toUpperCase() + ' → EUR (division), puis EUR → USD (multiplication).',
          fv(amt, from, 'fr', 0) + ' ÷ ' + U.fmtNum(r[from], 'fr', 4) + ' = ' + frf(amt / r[from], 'eur', 0) + '.',
          frf(amt / r[from], 'eur', 0) + ' × ' + U.fmtNum(r[to], 'fr', 4) + ' = ' + frf(v, 'usd', 0) + '.'
        ],
        shortcut: 'En une seule opération : montant × (' + U.fmtNum(r[to], 'fr', 4) + ' ÷ ' + U.fmtNum(r[from], 'fr', 4) + ').'
      };
    }
  });

  /* ---------------- N06 Croissance composée ---------------- */
  def({
    id: 'N06', title: 'Croissance composée', skill: 'Croissance', difficulty: 2, targetSec: 60, range: [1000, 20000],
    make: function (rng, lang) {
      var V = ri(rng, 1500, 9000, 50), rate = ri(rng, 30, 95) / 10, n = ri(rng, 3, 5), firm = pick(rng, FIRMS);
      var g = rate / 100, v = V * Math.pow(1 + g, n), y0 = 2025;
      var ch = C.buildChoices(rng, v, [
        { v: V * (1 + n * g), err: 'compose' },
        { v: V * Math.pow(1 + g, n - 1), err: 'periodes' },
        { v: V * Math.pow(1 + g, n + 1), err: 'periodes' },
        { v: V * n * g, err: 'lecture' }
      ], function (x) { return fv(x, 'keur', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Le chiffre d\'affaires 2025 de ' + firm + ' est de ' + fv(V, 'keur', lang, 0) + '. S\'il croît de ' + fv(rate, 'pct', lang, 1) + ' par an, quel sera-t-il en ' + (y0 + n) + ' ?',
          firm + '\'s 2025 revenue is ' + fv(V, 'keur', lang, 0) + '. If it grows by ' + fv(rate, 'pct', lang, 1) + ' a year, what will it be in ' + (y0 + n) + '?'),
        visual: null, unit: 'keur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'De 2025 à ' + (y0 + n) + ' : ' + n + ' années de croissance, chacune appliquée au montant de l\'année précédente.',
          n0(V, 'fr') + ' × ' + U.fmtNum(1 + g, 'fr', 3) + '^' + n + ' = ' + n0(V, 'fr') + ' × ' + U.fmtNum(Math.pow(1 + g, n), 'fr', 4) + ' = ' + frf(v, 'keur', 0) + '.'
        ],
        shortcut: 'La croissance simple (' + frf(V * (1 + n * g), 'keur', 0) + ') donne toujours un peu MOINS que la composée : éliminez-la.'
      };
    }
  });

  /* ---------------- N07 Taux de croissance annuel moyen ---------------- */
  def({
    id: 'N07', title: 'Taux de croissance annuel moyen (TCAM)', skill: 'Croissance', difficulty: 3, targetSec: 80, range: [1, 20],
    make: function (rng, lang) {
      var n = ri(rng, 3, 5), y0 = 2025 - n, V0 = ri(rng, 2000, 8000, 50), g = ri(rng, 40, 120) / 1000;
      var Vn = Math.round(V0 * Math.pow(1 + g, n));
      var v = (Math.pow(Vn / V0, 1 / n) - 1) * 100, tot = (Vn / V0 - 1) * 100;
      var ch = C.buildChoices(rng, v, [
        { v: tot / n, err: 'compose' },
        { v: (Math.pow(Vn / V0, 1 / (n + 1)) - 1) * 100, err: 'periodes' },
        { v: tot, err: 'compose' },
        { v: tot / (n + 1), err: 'periodes' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1, positive: true });
      var labels = [], vals = [];
      for (var y = 0; y <= n; y++) { labels.push(String(y0 + y)); vals.push(y === 0 ? V0 : y === n ? Vn : null); }
      return {
        prompt: T(lang, 'Le résultat opérationnel est passé de ' + fv(V0, 'keur', lang, 0) + ' en ' + y0 + ' à ' + fv(Vn, 'keur', lang, 0) + ' en 2025. Quel est le taux de croissance annuel moyen ?',
          'Operating profit rose from ' + fv(V0, 'keur', lang, 0) + ' in ' + y0 + ' to ' + fv(Vn, 'keur', lang, 0) + ' in 2025. What was the compound annual growth rate?'),
        visual: null, unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'De ' + y0 + ' à 2025, il y a ' + n + ' périodes (et non ' + (n + 1) + ' années affichées).',
          'TCAM = (' + n0(Vn, 'fr') + ' ÷ ' + n0(V0, 'fr') + ')^(1/' + n + ') − 1 = ' + U.fmtNum(Vn / V0, 'fr', 4) + '^(1/' + n + ') − 1 = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'Sans racine sur la calculatrice : testez les propositions. ' + U.fmtNum(1 + U.round(v, 1) / 100, 'fr', 3) + '^' + n + ' doit redonner environ ' + U.fmtNum(Vn / V0, 'fr', 3) + '. La croissance totale ÷ ' + n + ' (' + frf(tot / n, 'pct', 1) + ') est toujours trop haute.'
      };
    }
  });

  /* ---------------- N08 Prix hors taxes ---------------- */
  def({
    id: 'N08', title: 'Retrouver un montant hors taxes', skill: 'Pourcentages', difficulty: 2, targetSec: 45, range: [10, 1e6],
    make: function (rng, lang) {
      var t = pick(rng, [20, 20, 20, 10, 5.5]), ht = ri(rng, 120, 9800) * 10, ttc = U.round(ht * (1 + t / 100), 2);
      var v = ttc / (1 + t / 100);
      var ch = C.buildChoices(rng, v, [
        { v: ttc * (1 - t / 100), err: 'sens' },
        { v: ttc / (1 - t / 100), err: 'sens' },
        { v: ttc * t / 100, err: 'lecture' },
        { v: ttc - t, err: 'pp' }
      ], function (x) { return fv(x, 'eur', lang, 2); }, 5, { dec: 2, positive: true });
      return {
        prompt: T(lang, 'Une facture affiche ' + fv(ttc, 'eur', lang, 2) + ' TTC, avec une TVA de ' + fv(t, 'pct', lang, 1) + '. Quel est le montant hors taxes ?',
          'An invoice shows ' + fv(ttc, 'eur', lang, 2) + ' including VAT at ' + fv(t, 'pct', lang, 1) + '. What is the amount excluding VAT?'),
        visual: null, unit: 'eur', dec: 2, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'TTC = HT × (1 + taux). Donc HT = TTC ÷ (1 + taux).',
          fv(ttc, 'eur', 'fr', 2) + ' ÷ ' + U.fmtNum(1 + t / 100, 'fr', 3) + ' = ' + frf(v, 'eur', 2) + '.',
          'Retirer ' + fv(t, 'pct', 'fr', 1) + ' du TTC (× ' + U.fmtNum(1 - t / 100, 'fr', 3) + ') est faux : la TVA est calculée sur le HT, pas sur le TTC.'
        ],
        shortcut: 'Contrôle : HT × ' + U.fmtNum(1 + t / 100, 'fr', 3) + ' doit redonner exactement le TTC.'
      };
    }
  });

  /* ---------------- N09 Pourcentages successifs ---------------- */
  def({
    id: 'N09', title: 'Hausse puis baisse successives', skill: 'Pourcentages', difficulty: 2, targetSec: 45, range: [-40, 40],
    make: function (rng, lang) {
      var a = ri(rng, 5, 30), b = ri(rng, 5, 30), firm = pick(rng, FIRMS);
      var v = ((1 + a / 100) * (1 - b / 100) - 1) * 100;
      var ch = C.buildChoices(rng, v, [
        { v: a - b, err: 'compose' },
        { v: ((1 - a / 100) * (1 + b / 100) - 1) * 100, err: 'sens' },
        { v: -(a - b), err: 'sens' },
        { v: (a - b) / 2, err: 'moyenne' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'Le cours de l\'action ' + firm + ' a augmenté de ' + a + ' % en janvier, puis baissé de ' + b + ' % en février. Quelle est la variation sur les deux mois ?',
          firm + '\'s share price rose by ' + a + '% in January, then fell by ' + b + '% in February. What was the overall change over the two months?'),
        visual: null, unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Les pourcentages successifs se multiplient : on applique chaque coefficient au résultat précédent.',
          U.fmtNum(1 + a / 100, 'fr', 2) + ' × ' + U.fmtNum(1 - b / 100, 'fr', 2) + ' = ' + U.fmtNum((1 + a / 100) * (1 - b / 100), 'fr', 4) + ', soit ' + signed(v, 'pct', 'fr', 1) + '.'
        ],
        shortcut: 'Formule rapide : a − b − (a × b ÷ 100) = ' + a + ' − ' + b + ' − ' + U.fmtNum(a * b / 100, 'fr', 2) + ' = ' + signed(v, 'pct', 'fr', 1) + '.'
      };
    }
  });

  /* ---------------- N10 Chiffre d'affaires par salarié ---------------- */
  def({
    id: 'N10', title: 'Ratio par salarié', skill: 'Ratios', difficulty: 3, targetSec: 90, range: [-40, 60],
    make: function (rng, lang) {
      var subs = SUBS[L(lang)], R1 = [], R2 = [], E1 = [], E2 = [], rows = [];
      for (var i = 0; i < 3; i++) {
        R1[i] = ri(rng, 120, 900) / 10; R2[i] = U.round(R1[i] * (1 + change(rng, -12, 25) / 100), 1);
        E1[i] = ri(rng, 80, 600); do { E2[i] = Math.round(E1[i] * (1 + change(rng, -15, 20) / 100)); } while (E2[i] === E1[i]);
        rows.push([subs[i], U.fmtNum(R1[i], lang, 1), U.fmtNum(R2[i], lang, 1), n0(E1[i], lang), n0(E2[i], lang)]);
      }
      var j = ri(rng, 0, 2), p1 = R1[j] / E1[j], p2 = R2[j] / E2[j], v = pct(p1, p2);
      var ch = C.buildChoices(rng, v, [
        { v: pct(R1[j], R2[j]), err: 'lecture' },
        { v: pct(R1[j], R2[j]) - pct(E1[j], E2[j]), err: 'compose' },
        { v: pct(p2, p1), err: 'base' },
        { v: pct(E1[j], E2[j]), err: 'lecture' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'De combien a varié le chiffre d\'affaires par salarié de la ' + subs[j] + ' entre 2024 et 2025 ?',
          'By what percentage did revenue per employee change at ' + subs[j] + ' between 2024 and 2025?'),
        visual: table(T(lang, 'Chiffre d\'affaires (M€) et effectifs', 'Revenue (€m) and headcount'),
          ['', T(lang, 'CA 2024', 'Rev. 2024'), T(lang, 'CA 2025', 'Rev. 2025'), T(lang, 'Eff. 2024', 'Staff 2024'), T(lang, 'Eff. 2025', 'Staff 2025')], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'CA par salarié 2024 = ' + U.fmtNum(R1[j], 'fr', 1) + ' M€ ÷ ' + E1[j] + ' = ' + U.fmtNum(p1 * 1000, 'fr', 1) + ' k€.',
          'CA par salarié 2025 = ' + U.fmtNum(R2[j], 'fr', 1) + ' M€ ÷ ' + E2[j] + ' = ' + U.fmtNum(p2 * 1000, 'fr', 1) + ' k€.',
          'Variation = ' + U.fmtNum(p2 * 1000, 'fr', 1) + ' ÷ ' + U.fmtNum(p1 * 1000, 'fr', 1) + ' − 1 = ' + signed(v, 'pct', 'fr', 1) + '.'
        ],
        shortcut: 'Sans calculer les ratios : (' + U.fmtNum(R2[j], 'fr', 1) + ' ÷ ' + U.fmtNum(R1[j], 'fr', 1) + ') ÷ (' + E2[j] + ' ÷ ' + E1[j] + ') − 1. Soustraire les deux variations n\'est qu\'une approximation.'
      };
    }
  });

  /* ---------------- N11 Moyenne simple ---------------- */
  def({
    id: 'N11', title: 'Moyenne mensuelle', skill: 'Moyennes', difficulty: 1, targetSec: 45, range: [10, 5000],
    make: function (rng, lang) {
      var months = T(lang, ['Janv.', 'Févr.', 'Mars', 'Avr.', 'Mai', 'Juin'], ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun']);
      var vals = [], i;
      var base = ri(rng, 80, 900);
      for (i = 0; i < 6; i++) vals.push(Math.round(base * (0.75 + rng() * 0.5)));
      var sum = vals.reduce(function (s, x) { return s + x; }, 0), v = sum / 6;
      var sorted = vals.slice().sort(function (x, y) { return x - y; });
      var ch = C.buildChoices(rng, v, [
        { v: sum / 5, err: 'moyenne' },
        { v: (vals[0] + vals[5]) / 2, err: 'moyenne' },
        { v: (sorted[2] + sorted[3]) / 2, err: 'moyenne' },
        { v: (sum - vals[5]) / 5, err: 'lecture' }
      ], function (x) { return fv(x, 'keur', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: T(lang, 'Quel est le coût moyen mensuel des frais de déplacement sur le semestre ?', 'What was the average monthly travel cost over the half-year?'),
        visual: { kind: 'chart', spec: { kind: 'bar', lang: lang, decimals: 0, title: T(lang, 'Frais de déplacement (k€)', 'Travel costs (€k)'), labels: months, series: [{ name: '', values: vals }] } },
        unit: 'keur', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Somme des six mois : ' + vals.map(function (x) { return n0(x, 'fr'); }).join(' + ') + ' = ' + n0(sum, 'fr') + ' k€.',
          'Moyenne = ' + n0(sum, 'fr') + ' ÷ 6 = ' + frf(v, 'keur', 1) + '.'
        ],
        shortcut: 'Ordre de grandeur : la moyenne est forcément entre le plus petit (' + sorted[0] + ') et le plus grand mois (' + sorted[5] + ') ; écartez ce qui en sort.'
      };
    }
  });

  /* ---------------- N12 Moyenne pondérée ---------------- */
  def({
    id: 'N12', title: 'Marge moyenne pondérée', skill: 'Moyennes', difficulty: 2, targetSec: 70, range: [5, 70],
    make: function (rng, lang) {
      var lines = T(lang, ['Conseil', 'Audit', 'Formation'], ['Advisory', 'Assurance', 'Training']), R = [], m = [], rows = [];
      do {
        for (var i = 0; i < 3; i++) { R[i] = ri(rng, 20, 400) / 10; m[i] = ri(rng, 80, 450) / 10; }
      } while (Math.abs((R[0] * m[0] + R[1] * m[1] + R[2] * m[2]) / (R[0] + R[1] + R[2]) - (m[0] + m[1] + m[2]) / 3) < 0.6);
      for (i = 0; i < 3; i++) rows.push([lines[i], U.fmtNum(R[i], lang, 1), fv(m[i], 'pct', lang, 1)]);
      var sR = R[0] + R[1] + R[2], v = (R[0] * m[0] + R[1] * m[1] + R[2] * m[2]) / sR;
      var big = R.indexOf(Math.max.apply(null, R));
      var ch = C.buildChoices(rng, v, [
        { v: (m[0] + m[1] + m[2]) / 3, err: 'moyenne' },
        { v: m[big], err: 'lecture' },
        { v: (m[0] + m[1] + m[2]) / 3 + (v - (m[0] + m[1] + m[2]) / 3) * 2, err: 'calcul' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: T(lang, 'Quel est le taux de marge de l\'ensemble du cabinet ?', 'What is the overall margin rate for the whole firm?'),
        visual: table(T(lang, 'Chiffre d\'affaires (M€) et taux de marge par activité', 'Revenue (€m) and margin by service line'), [T(lang, 'Activité', 'Service line'), T(lang, 'CA', 'Revenue'), T(lang, 'Marge', 'Margin')], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Marge en valeur de chaque activité : ' + [0, 1, 2].map(function (k) { return U.fmtNum(R[k], 'fr', 1) + ' × ' + U.fmtNum(m[k], 'fr', 1) + ' %'; }).join(' ; ') + '.',
          'Total des marges = ' + U.fmtNum((R[0] * m[0] + R[1] * m[1] + R[2] * m[2]) / 100, 'fr', 3) + ' M€ ; CA total = ' + U.fmtNum(sR, 'fr', 1) + ' M€.',
          'Taux global = ' + U.fmtNum((R[0] * m[0] + R[1] * m[1] + R[2] * m[2]) / 100, 'fr', 3) + ' ÷ ' + U.fmtNum(sR, 'fr', 1) + ' = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'La moyenne simple des trois taux (' + frf((m[0] + m[1] + m[2]) / 3, 'pct', 1) + ') ignore la taille des activités : le bon résultat est tiré vers le taux de la plus grosse.'
      };
    }
  });

  /* ---------------- N13 Règle de trois ---------------- */
  def({
    id: 'N13', title: 'Règle de trois (honoraires)', skill: 'Proportionnalité', difficulty: 1, targetSec: 45, range: [1000, 100000],
    make: function (rng, lang) {
      var rate = ri(rng, 85, 160), h1 = ri(rng, 60, 220), h2;
      do { h2 = ri(rng, 40, 260); } while (Math.abs(h2 - h1) < 15);
      var c1 = h1 * rate, v = c1 / h1 * h2;
      var ch = C.buildChoices(rng, v, [
        { v: c1 * h1 / h2, err: 'sens' },
        { v: c1 + (h2 - h1), err: 'calcul' },
        { v: c1 * h2 / 100, err: 'lecture' }
      ], function (x) { return fv(x, 'eur', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Une mission de ' + h1 + ' heures a été facturée ' + fv(c1, 'eur', lang, 0) + ' HT. Au même taux horaire, combien sera facturée une mission de ' + h2 + ' heures ?',
          'An engagement of ' + h1 + ' hours was billed ' + fv(c1, 'eur', lang, 0) + ' excl. VAT. At the same hourly rate, how much will a ' + h2 + '-hour engagement be billed?'),
        visual: null, unit: 'eur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Taux horaire = ' + fv(c1, 'eur', 'fr', 0) + ' ÷ ' + h1 + ' = ' + fv(rate, 'eur', 'fr', 0) + ' de l\'heure.',
          fv(rate, 'eur', 'fr', 0) + ' × ' + h2 + ' = ' + frf(v, 'eur', 0) + '.'
        ],
        shortcut: 'Plus d\'heures = plus cher : si ' + h2 + (h2 > h1 ? ' > ' : ' < ') + h1 + ', la réponse doit être ' + (h2 > h1 ? 'supérieure' : 'inférieure') + ' à ' + fv(c1, 'eur', 'fr', 0) + '.'
      };
    }
  });

  /* ---------------- N14 Proportionnalité inverse ---------------- */
  def({
    id: 'N14', title: 'Proportionnalité inverse (équipe et délai)', skill: 'Proportionnalité', difficulty: 2, targetSec: 45, range: [1, 60],
    make: function (rng, lang) {
      var n1 = ri(rng, 3, 8), d1 = ri(rng, 4, 15), n2;
      do { n2 = ri(rng, 2, 10); } while (n2 === n1);
      var v = n1 * d1 / n2;
      var ch = C.buildChoices(rng, v, [
        { v: d1 * n2 / n1, err: 'sens' },
        { v: d1 + (n1 - n2), err: 'calcul' },
        { v: d1, err: 'lecture' }
      ], function (x) { return fv(x, 'days', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: T(lang, n1 + ' auditeurs réalisent les tests de détail d\'une mission en ' + d1 + ' jours. Au même rythme, combien de jours faudrait-il à ' + n2 + ' auditeurs ?',
          n1 + ' auditors complete the substantive testing on an engagement in ' + d1 + ' days. Working at the same pace, how many days would ' + n2 + ' auditors need?'),
        visual: null, unit: 'days', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Charge totale = ' + n1 + ' × ' + d1 + ' = ' + (n1 * d1) + ' jours-homme.',
          (n1 * d1) + ' ÷ ' + n2 + ' = ' + frf(v, 'days', 1) + '.'
        ],
        shortcut: 'Moins de personnes = plus de jours (et inversement) : la proportionnalité est inverse, on multiplie puis on divise.'
      };
    }
  });

  /* ---------------- N15 Écart budgétaire ---------------- */
  def({
    id: 'N15', title: 'Écart réel / budget', skill: 'Contrôle de gestion', difficulty: 2, targetSec: 60, range: [-40, 40],
    make: function (rng, lang) {
      var lines = T(lang, ['Achats', 'Personnel', 'Loyers', 'Informatique'], ['Purchases', 'Staff costs', 'Rent', 'IT']), B = [], R = [], rows = [];
      for (var i = 0; i < 4; i++) { B[i] = ri(rng, 150, 2400, 10); R[i] = Math.round(B[i] * (1 + change(rng, -18, 22) / 100)); rows.push([lines[i], n0(B[i], lang), n0(R[i], lang)]); }
      var j = ri(rng, 0, 3), v = (R[j] - B[j]) / B[j] * 100;
      var ch = C.buildChoices(rng, v, [
        { v: (R[j] - B[j]) / R[j] * 100, err: 'base' },
        { v: -v, err: 'sens' },
        { v: R[j] / B[j] * 100, err: 'sens' },
        { v: (R[(j + 1) % 4] - B[(j + 1) % 4]) / B[(j + 1) % 4] * 100, err: 'lecture' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'Quel est l\'écart (réel − budget) du poste « ' + lines[j] + ' », exprimé en % du budget ?',
          'What is the variance (actual − budget) for "' + lines[j] + '", as a percentage of budget?'),
        visual: table(T(lang, 'Charges du premier semestre (k€)', 'First-half costs (€k)'), [T(lang, 'Poste', 'Line'), 'Budget', T(lang, 'Réel', 'Actual')], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Écart = réel − budget = ' + n0(R[j], 'fr') + ' − ' + n0(B[j], 'fr') + ' = ' + (R[j] - B[j] > 0 ? '+' : '') + n0(R[j] - B[j], 'fr') + ' k€.',
          'En % du budget : ' + n0(R[j] - B[j], 'fr') + ' ÷ ' + n0(B[j], 'fr') + ' × 100 = ' + signed(v, 'pct', 'fr', 1) + '.',
          v > 0 ? 'Pour une charge, un réel supérieur au budget est un écart défavorable.' : 'Pour une charge, un réel inférieur au budget est un écart favorable.'
        ],
        shortcut: 'La question précise la base (« en % du budget ») : c\'est elle qui va au dénominateur.'
      };
    }
  });

  /* ---------------- N16 Taux de marge / taux de marque ---------------- */
  def({
    id: 'N16', title: 'Taux de marge ou taux de marque', skill: 'Contrôle de gestion', difficulty: 2, targetSec: 50, range: [3, 300],
    make: function (rng, lang) {
      var cost = ri(rng, 1200, 9000) / 100, mk = ri(rng, 15, 90) / 100, price = U.round(cost * (1 + mk), 2);
      var onPrice = rng() < 0.5, mg = price - cost;
      var v = onPrice ? mg / price * 100 : mg / cost * 100;
      var other = onPrice ? mg / cost * 100 : mg / price * 100;
      var ch = C.buildChoices(rng, v, [
        { v: other, err: 'base' },
        { v: cost / price * 100, err: 'lecture' },
        { v: price / cost * 100, err: 'sens' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: onPrice
          ? T(lang, 'Un produit coûte ' + fv(cost, 'eur', lang, 2) + ' HT à l\'achat et se vend ' + fv(price, 'eur', lang, 2) + ' HT. Quel est son taux de marque (marge ÷ prix de vente) ?',
            'A product costs ' + fv(cost, 'eur', lang, 2) + ' to buy and sells for ' + fv(price, 'eur', lang, 2) + ' (excl. VAT). What is its gross margin as a percentage of the selling price?')
          : T(lang, 'Un produit coûte ' + fv(cost, 'eur', lang, 2) + ' HT à l\'achat et se vend ' + fv(price, 'eur', lang, 2) + ' HT. Quel est son taux de marge (marge ÷ coût d\'achat) ?',
            'A product costs ' + fv(cost, 'eur', lang, 2) + ' to buy and sells for ' + fv(price, 'eur', lang, 2) + ' (excl. VAT). What is its markup as a percentage of cost?'),
        visual: null, unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Marge unitaire = ' + fv(price, 'eur', 'fr', 2) + ' − ' + fv(cost, 'eur', 'fr', 2) + ' = ' + fv(mg, 'eur', 'fr', 2) + '.',
          onPrice ? 'Taux de marque = marge ÷ prix de vente HT = ' + U.fmtNum(mg, 'fr', 2) + ' ÷ ' + U.fmtNum(price, 'fr', 2) + ' = ' + frf(v, 'pct', 1) + '.'
            : 'Taux de marge = marge ÷ coût d\'achat HT = ' + U.fmtNum(mg, 'fr', 2) + ' ÷ ' + U.fmtNum(cost, 'fr', 2) + ' = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'Taux de MARQUE = base prix de vente (toujours < 100 %) ; taux de MARGE = base coût d\'achat. Le premier est toujours plus petit que le second.'
      };
    }
  });

  /* ---------------- N17 Seuil de rentabilité ---------------- */
  def({
    id: 'N17', title: 'Seuil de rentabilité en volume', skill: 'Contrôle de gestion', difficulty: 2, targetSec: 60, range: [100, 1e6],
    make: function (rng, lang) {
      var p = ri(rng, 20, 180), vc = Math.round(p * (0.35 + rng() * 0.45)), F = ri(rng, 40, 900) * 1000;
      if (vc >= p) vc = p - 5;
      var v = Math.ceil(F / (p - vc));
      var ch = C.buildChoices(rng, v, [
        { v: Math.ceil(F / p), err: 'lecture' },
        { v: Math.ceil(F / vc), err: 'lecture' },
        { v: Math.ceil(F / (p + vc)), err: 'sens' }
      ], function (x) { return fv(x, 'units', lang, 0); }, 5, { integer: true, positive: true });
      return {
        prompt: T(lang, 'Un produit est vendu ' + fv(p, 'eur', lang, 0) + ' l\'unité pour un coût variable de ' + fv(vc, 'eur', lang, 0) + '. Les charges fixes annuelles sont de ' + fv(F, 'eur', lang, 0) + '. Combien d\'unités faut-il vendre au minimum pour ne pas faire de perte ?',
          'A product sells for ' + fv(p, 'eur', lang, 0) + ' per unit with a variable cost of ' + fv(vc, 'eur', lang, 0) + '. Annual fixed costs are ' + fv(F, 'eur', lang, 0) + '. What is the minimum number of units to sell to avoid a loss?'),
        visual: null, unit: 'units', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Marge sur coût variable unitaire = ' + p + ' − ' + vc + ' = ' + (p - vc) + ' €.',
          'Seuil = charges fixes ÷ marge unitaire = ' + n0(F, 'fr') + ' ÷ ' + (p - vc) + ' = ' + U.fmtNum(F / (p - vc), 'fr', 2) + ', arrondi à l\'unité supérieure : ' + frf(v, 'units', 0) + '.'
        ],
        shortcut: 'Chaque unité vendue « rembourse » ' + (p - vc) + ' € de charges fixes : divisez les charges fixes par ce montant.'
      };
    }
  });

  /* ---------------- N18 Intérêts simples ---------------- */
  def({
    id: 'N18', title: 'Intérêts sur une durée en mois', skill: 'Finance', difficulty: 2, targetSec: 50, range: [10, 1e6],
    make: function (rng, lang) {
      var Lo = ri(rng, 20, 800) * 1000, r = ri(rng, 4, 14) / 2, m;
      do { m = ri(rng, 3, 18); } while (m === 12);
      var v = Lo * r / 100 * m / 12;
      var ch = C.buildChoices(rng, v, [
        { v: Lo * r / 100, err: 'periodes' },
        { v: Lo * r / 100 * m, err: 'periodes' },
        { v: Lo * r / 100 * 12 / m, err: 'sens' },
        { v: Lo * r / 100 / 12, err: 'periodes' }
      ], function (x) { return fv(x, 'eur', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Un prêt de ' + fv(Lo, 'eur', lang, 0) + ' au taux annuel de ' + fv(r, 'pct', lang, 1) + ' (intérêts simples) est remboursé en une fois au bout de ' + m + ' mois. Quel est le montant des intérêts ?',
          'A loan of ' + fv(Lo, 'eur', lang, 0) + ' at an annual rate of ' + fv(r, 'pct', lang, 1) + ' (simple interest) is repaid in full after ' + m + ' months. How much interest is due?'),
        visual: null, unit: 'eur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Intérêts annuels = ' + n0(Lo, 'fr') + ' × ' + U.fmtNum(r, 'fr', 1) + ' % = ' + frf(Lo * r / 100, 'eur', 0) + '.',
          'Sur ' + m + ' mois : ' + frf(Lo * r / 100, 'eur', 0) + ' × ' + m + ' ÷ 12 = ' + frf(v, 'eur', 0) + '.'
        ],
        shortcut: 'Un taux est annuel sauf mention contraire : ramenez toujours la durée en fraction d\'année (' + m + '/12).'
      };
    }
  });

  /* ---------------- N19 Ratio de liquidité ---------------- */
  def({
    id: 'N19', title: 'Ratio de liquidité', skill: 'Ratios', difficulty: 3, targetSec: 80, range: [0.1, 6],
    make: function (rng, lang) {
      var st = ri(rng, 200, 1500, 10), cl = ri(rng, 300, 2000, 10), oc = ri(rng, 50, 400, 10), cash = ri(rng, 100, 1200, 10);
      var fo = ri(rng, 800, 2600, 10), fs = ri(rng, 200, 900, 10), lt = ri(rng, 500, 4000, 10);
      var quick = rng() < 0.45;
      var ca = st + cl + oc + cash, cd = fo + fs;
      var v = quick ? (ca - st) / cd : ca / cd;
      var rows = [
        [T(lang, 'Stocks', 'Inventories'), n0(st, lang)], [T(lang, 'Créances clients', 'Trade receivables'), n0(cl, lang)],
        [T(lang, 'Autres créances', 'Other receivables'), n0(oc, lang)], [T(lang, 'Trésorerie', 'Cash'), n0(cash, lang)],
        [T(lang, 'Dettes fournisseurs', 'Trade payables'), n0(fo, lang)], [T(lang, 'Dettes fiscales et sociales', 'Tax and social liabilities'), n0(fs, lang)],
        [T(lang, 'Emprunts à plus d\'un an', 'Borrowings due after one year'), n0(lt, lang)]
      ];
      var ch = C.buildChoices(rng, v, [
        { v: quick ? ca / cd : (ca - st) / cd, err: 'lecture' },
        { v: 1 / v, err: 'sens' },
        { v: (quick ? ca - st : ca) / (cd + lt), err: 'lecture' },
        { v: (quick ? ca - st - cash : ca - cash) / cd, err: 'lecture' }
      ], function (x) { return U.fmtNum(x, lang, 2); }, 5, { dec: 2, positive: true });
      return {
        prompt: quick
          ? T(lang, 'Quel est le ratio de liquidité réduite (actif circulant hors stocks ÷ dettes à court terme) ?', 'What is the quick ratio (current assets excluding inventories ÷ current liabilities)?')
          : T(lang, 'Quel est le ratio de liquidité générale (actif circulant ÷ dettes à court terme) ?', 'What is the current ratio (current assets ÷ current liabilities)?'),
        visual: table(T(lang, 'Extrait du bilan au 31/12/2025 (k€)', 'Balance sheet extract at 31/12/2025 (€k)'), [T(lang, 'Poste', 'Item'), T(lang, 'Montant', 'Amount')], rows),
        unit: 'x', dec: 2, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Actif circulant = ' + [st, cl, oc, cash].map(function (x) { return n0(x, 'fr'); }).join(' + ') + ' = ' + n0(ca, 'fr') + ' k€' + (quick ? ' ; hors stocks : ' + n0(ca - st, 'fr') + ' k€.' : '.'),
          'Dettes à court terme = ' + n0(fo, 'fr') + ' + ' + n0(fs, 'fr') + ' = ' + n0(cd, 'fr') + ' k€ (les emprunts à plus d\'un an n\'en font pas partie).',
          'Ratio = ' + n0(quick ? ca - st : ca, 'fr') + ' ÷ ' + n0(cd, 'fr') + ' = ' + U.fmtNum(v, 'fr', 2) + '.'
        ],
        shortcut: 'Rayez d\'abord les lignes hors sujet (dettes à long terme' + (quick ? ', stocks' : '') + '), puis additionnez.'
      };
    }
  });

  /* ---------------- N20 Délai de paiement clients ---------------- */
  def({
    id: 'N20', title: 'Délai moyen de paiement clients (DSO)', skill: 'Ratios', difficulty: 2, targetSec: 50, range: [10, 150],
    make: function (rng, lang) {
      var S = ri(rng, 30, 400) * 100, dso = ri(rng, 25, 110), R = Math.round(S * dso / 365 / 10) * 10;
      var v = R / S * 365;
      var ch = C.buildChoices(rng, v, [
        { v: R / S * 100, err: 'conversion' },
        { v: R / S * 12, err: 'conversion' },
        { v: S / R, err: 'sens' },
        { v: R / S * 52, err: 'conversion' }
      ], function (x) { return fv(x, 'days', lang, 0); }, 5, { positive: true, integer: true });
      return {
        prompt: T(lang, 'Le chiffre d\'affaires annuel est de ' + fv(S, 'keur', lang, 0) + ' et les créances clients de fin d\'année s\'élèvent à ' + fv(R, 'keur', lang, 0) + ' (montants hors taxes). Quel est le délai moyen de paiement des clients (année de 365 jours) ?',
          'Annual revenue is ' + fv(S, 'keur', lang, 0) + ' and year-end trade receivables amount to ' + fv(R, 'keur', lang, 0) + ' (excl. VAT). What are the days sales outstanding (365-day year)?'),
        visual: null, unit: 'days', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'DSO = créances clients ÷ chiffre d\'affaires × 365.',
          n0(R, 'fr') + ' ÷ ' + n0(S, 'fr') + ' × 365 = ' + frf(v, 'days', 0) + '.'
        ],
        shortcut: 'Les créances représentent ' + U.fmtNum(R / S * 100, 'fr', 1) + ' % du CA annuel, soit ' + U.fmtNum(R / S * 100, 'fr', 1) + ' % de 365 jours.'
      };
    }
  });

  /* ---------------- N21 Marge d'exploitation ---------------- */
  def({
    id: 'N21', title: 'Marge d\'exploitation', skill: 'Ratios', difficulty: 3, targetSec: 80, range: [-20, 45],
    make: function (rng, lang) {
      var CA = ri(rng, 400, 2000) * 10, ach = Math.round(CA * (0.25 + rng() * 0.2)), ext = Math.round(CA * (0.08 + rng() * 0.1));
      var pers = Math.round(CA * (0.18 + rng() * 0.15)), dot = Math.round(CA * (0.02 + rng() * 0.06)), fin = -Math.round(CA * (0.005 + rng() * 0.02));
      var ebit = CA - ach - ext - pers - dot, v = ebit / CA * 100;
      var rows = [
        [T(lang, 'Chiffre d\'affaires', 'Revenue'), n0(CA, lang)], [T(lang, 'Achats consommés', 'Cost of purchases'), n0(-ach, lang)],
        [T(lang, 'Charges externes', 'External charges'), n0(-ext, lang)], [T(lang, 'Charges de personnel', 'Staff costs'), n0(-pers, lang)],
        [T(lang, 'Dotations aux amortissements', 'Depreciation and amortisation'), n0(-dot, lang)], [T(lang, 'Résultat financier', 'Net finance costs'), n0(fin, lang)]
      ];
      var ch = C.buildChoices(rng, v, [
        { v: (ebit + dot) / CA * 100, err: 'lecture' },
        { v: (ebit + fin) / CA * 100, err: 'lecture' },
        { v: ebit / (ach + ext + pers + dot) * 100, err: 'base' },
        { v: (ebit - dot) / CA * 100, err: 'calcul' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'Quelle est la marge d\'exploitation (résultat d\'exploitation ÷ chiffre d\'affaires) ?', 'What is the operating margin (operating profit ÷ revenue)?'),
        visual: table(T(lang, 'Compte de résultat 2025 (k€)', '2025 income statement (€k)'), [T(lang, 'Poste', 'Item'), T(lang, 'Montant', 'Amount')], rows),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Résultat d\'exploitation = CA − achats − charges externes − personnel − dotations = ' + n0(CA, 'fr') + ' − ' + n0(ach, 'fr') + ' − ' + n0(ext, 'fr') + ' − ' + n0(pers, 'fr') + ' − ' + n0(dot, 'fr') + ' = ' + n0(ebit, 'fr') + ' k€.',
          'Le résultat financier se situe sous le résultat d\'exploitation : il n\'entre pas dans le calcul.',
          'Marge = ' + n0(ebit, 'fr') + ' ÷ ' + n0(CA, 'fr') + ' = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'Sans dotations, on obtiendrait l\'EBE (EBITDA), ici ' + frf((ebit + dot) / CA * 100, 'pct', 1) + ' : distracteur classique.'
      };
    }
  });

  /* ---------------- N22 Trimestre manquant ---------------- */
  def({
    id: 'N22', title: 'Montant manquant pour atteindre un objectif', skill: 'Contrôle de gestion', difficulty: 1, targetSec: 45, range: [1, 1e5],
    make: function (rng, lang) {
      var q = [ri(rng, 500, 1600, 5), ri(rng, 500, 1600, 5), ri(rng, 500, 1600, 5)];
      var s3 = q[0] + q[1] + q[2], target = Math.round((s3 * (1.25 + rng() * 0.25)) / 10) * 10, v = target - s3;
      var ch = C.buildChoices(rng, v, [
        { v: target / 4, err: 'moyenne' },
        { v: target - q[0] - q[1], err: 'lecture' },
        { v: s3 / 3, err: 'moyenne' },
        { v: (target - s3) / 4, err: 'calcul' }
      ], function (x) { return fv(x, 'keur', lang, 0); }, 5, { positive: true, integer: true });
      return {
        prompt: T(lang, 'L\'objectif annuel de chiffre d\'affaires est de ' + fv(target, 'keur', lang, 0) + '. Quel chiffre d\'affaires faut-il réaliser au 4e trimestre pour l\'atteindre exactement ?',
          'The annual revenue target is ' + fv(target, 'keur', lang, 0) + '. What revenue must be achieved in Q4 to meet it exactly?'),
        visual: { kind: 'chart', spec: { kind: 'bar', lang: lang, decimals: 0, title: T(lang, 'Chiffre d\'affaires trimestriel (k€)', 'Quarterly revenue (€k)'), labels: ['T1', 'T2', 'T3'].map(function (x, i) { return lang === 'en' ? 'Q' + (i + 1) : x; }), series: [{ name: '', values: q }] } },
        unit: 'keur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Réalisé sur trois trimestres : ' + q.map(function (x) { return n0(x, 'fr'); }).join(' + ') + ' = ' + n0(s3, 'fr') + ' k€.',
          'Reste à faire : ' + n0(target, 'fr') + ' − ' + n0(s3, 'fr') + ' = ' + frf(v, 'keur', 0) + '.'
        ],
        shortcut: 'Lisez les valeurs sur les étiquettes des barres, pas à l\'œil sur l\'axe.'
      };
    }
  });

  /* ---------------- N23 Changement d'unité ---------------- */
  def({
    id: 'N23', title: 'Changement d\'unité (k€ → M€)', skill: 'Lecture de données', difficulty: 1, targetSec: 40, range: [0.1, 100],
    make: function (rng, lang) {
      var ents = T(lang, ['Siège', 'Usine de Lyon', 'Usine de Lille', 'Entrepôt'], ['Head office', 'Lyon plant', 'Lille plant', 'Warehouse']), vals = [], rows = [];
      for (var i = 0; i < 4; i++) { vals.push(ri(rng, 300, 9000, 5)); rows.push([ents[i], n0(vals[i], lang)]); }
      var skip = ri(rng, 0, 3), sum = 0;
      vals.forEach(function (x, k) { if (k !== skip) sum += x; });
      var v = sum / 1000;
      var names = ents.filter(function (x, k) { return k !== skip; });
      var ch = C.buildChoices(rng, v, [
        { v: sum / 100, err: 'conversion' },
        { v: sum / 10000, err: 'conversion' },
        { v: (sum + vals[skip]) / 1000, err: 'lecture' }
      ], function (x) { return fv(x, 'meur', lang, 2); }, 5, { dec: 2, positive: true });
      return {
        prompt: T(lang, 'Quel est le total des investissements de : ' + names.join(', ') + ' ? (en millions d\'euros)',
          'What is the total capital expenditure of ' + names.join(', ') + '? (in € millions)'),
        visual: table(T(lang, 'Investissements 2025 (k€)', '2025 capital expenditure (€k)'), [T(lang, 'Site', 'Site'), T(lang, 'Montant', 'Amount')], rows),
        unit: 'meur', dec: 2, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Somme des trois sites demandés : ' + vals.filter(function (x, k) { return k !== skip; }).map(function (x) { return n0(x, 'fr'); }).join(' + ') + ' = ' + n0(sum, 'fr') + ' k€.',
          '1 M€ = 1 000 k€ : ' + n0(sum, 'fr') + ' ÷ 1 000 = ' + frf(v, 'meur', 2) + '.'
        ],
        shortcut: 'Vérifiez l\'unité du tableau (k€) et celle de la question (M€) avant tout calcul.'
      };
    }
  });

  /* ---------------- N24 Pourcentage d'un pourcentage ---------------- */
  def({
    id: 'N24', title: 'Pourcentage d\'un pourcentage', skill: 'Pourcentages', difficulty: 2, targetSec: 50, range: [1, 5000],
    make: function (rng, lang) {
      var N = ri(rng, 16, 80) * 50, X = ri(rng, 6, 12) * 5, Y = ri(rng, 2, 6) * 5;
      var v = Math.round(N * X / 100 * Y / 100);
      var ch = C.buildChoices(rng, v, [
        { v: Math.round(N * (X + Y) / 100), err: 'compose' },
        { v: Math.round(N * Y / 100), err: 'lecture' },
        { v: Math.round(N * X / 100), err: 'lecture' },
        { v: Math.round(N * (X - Y) / 100), err: 'calcul' }
      ], function (x) { return fv(x, 'people', lang, 0); }, 5, { positive: true, integer: true });
      return {
        prompt: T(lang, 'Un cabinet compte ' + n0(N, lang) + ' collaborateurs. ' + X + ' % travaillent en audit et, parmi eux, ' + Y + ' % sont managers. Combien le cabinet compte-t-il de managers en audit (arrondi à l\'unité) ?',
          'A firm has ' + n0(N, lang) + ' staff. ' + X + '% work in audit and, of those, ' + Y + '% are managers. How many audit managers does the firm have (to the nearest whole number)?'),
        visual: null, unit: 'people', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Collaborateurs en audit : ' + n0(N, 'fr') + ' × ' + X + ' % = ' + U.fmtNum(N * X / 100, 'fr', 1) + '.',
          'Managers parmi eux : ' + U.fmtNum(N * X / 100, 'fr', 1) + ' × ' + Y + ' % = ' + U.fmtNum(N * X / 100 * Y / 100, 'fr', 2) + ', soit ' + v + '.'
        ],
        shortcut: '« Parmi eux » = on multiplie les pourcentages (' + X + ' % × ' + Y + ' % = ' + U.fmtNum(X * Y / 100, 'fr', 2) + ' % de l\'effectif), on ne les additionne jamais.'
      };
    }
  });

  /* ---------------- N25 Croissance en devise et en euros ---------------- */
  def({
    id: 'N25', title: 'Croissance après conversion', skill: 'Devises', difficulty: 3, targetSec: 90, range: [-40, 60],
    make: function (rng, lang) {
      var R1 = ri(rng, 200, 900) / 10, R2 = U.round(R1 * (1 + change(rng, -10, 25) / 100), 1);
      var x1 = ri(rng, 1040, 1180) / 1000, x2;
      do { x2 = ri(rng, 1040, 1180) / 1000; } while (Math.abs(x2 - x1) < 0.03);
      var v = pct(R1 / x1, R2 / x2), gu = pct(R1, R2);
      var ch = C.buildChoices(rng, v, [
        { v: gu, err: 'conversion' },
        { v: pct(R1 * x1, R2 * x2), err: 'sens' },
        { v: gu - pct(x1, x2), err: 'compose' },
        { v: pct(R1 / x2, R2 / x1), err: 'lecture' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'De combien le chiffre d\'affaires de la filiale américaine a-t-il évolué entre 2024 et 2025, une fois converti en euros ?',
          'By what percentage did the US subsidiary\'s revenue change between 2024 and 2025 once translated into euros?'),
        visual: table(T(lang, 'Filiale américaine', 'US subsidiary'), ['', '2024', '2025'], [
          [T(lang, 'Chiffre d\'affaires (M$)', 'Revenue ($m)'), U.fmtNum(R1, lang, 1), U.fmtNum(R2, lang, 1)],
          [T(lang, 'Cours moyen : 1 EUR = … USD', 'Average rate: 1 EUR = … USD'), U.fmtNum(x1, lang, 3), U.fmtNum(x2, lang, 3)]
        ]),
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'CA 2024 en euros = ' + U.fmtNum(R1, 'fr', 1) + ' ÷ ' + U.fmtNum(x1, 'fr', 3) + ' = ' + U.fmtNum(R1 / x1, 'fr', 2) + ' M€.',
          'CA 2025 en euros = ' + U.fmtNum(R2, 'fr', 1) + ' ÷ ' + U.fmtNum(x2, 'fr', 3) + ' = ' + U.fmtNum(R2 / x2, 'fr', 2) + ' M€.',
          'Variation = ' + U.fmtNum(R2 / x2, 'fr', 2) + ' ÷ ' + U.fmtNum(R1 / x1, 'fr', 2) + ' − 1 = ' + signed(v, 'pct', 'fr', 1) + ' (contre ' + signed(gu, 'pct', 'fr', 1) + ' en dollars).'
        ],
        shortcut: 'Si le dollar s\'affaiblit (plus de dollars pour 1 €), la croissance en euros est inférieure à la croissance en dollars, et inversement.'
      };
    }
  });

  /* ---------------- N26 Année de plus forte croissance (graphique) ---------------- */
  def({
    id: 'N26', title: 'Lecture de graphique : plus forte croissance', skill: 'Lecture de données', difficulty: 2, targetSec: 60, range: [2022, 2025], kind: 'label',
    make: function (rng, lang) {
      var years = [2021, 2022, 2023, 2024, 2025], vals, g, d, best, bestAbs, sortedG;
      do {
        vals = [ri(rng, 200, 900, 5)];
        for (var i = 1; i < 5; i++) vals.push(Math.round(vals[i - 1] * (1 + change(rng, -8, 22) / 100)));
        g = []; d = [];
        for (i = 1; i < 5; i++) { g.push(pct(vals[i - 1], vals[i])); d.push(vals[i] - vals[i - 1]); }
        best = g.indexOf(Math.max.apply(null, g)); bestAbs = d.indexOf(Math.max.apply(null, d));
        sortedG = g.slice().sort(function (x, y) { return y - x; });
      } while (best === bestAbs || sortedG[0] - sortedG[1] < 1);
      var choices = [1, 2, 3, 4].map(function (k) {
        return { text: String(years[k]), value: years[k], err: k - 1 === best ? null : (k - 1 === bestAbs ? 'base' : 'lecture') };
      });
      var v = years[best + 1];
      return {
        prompt: T(lang, 'Quelle année a connu la plus forte croissance du chiffre d\'affaires en pourcentage ?', 'In which year did revenue grow the most in percentage terms?'),
        visual: { kind: 'chart', spec: { kind: 'bar', lang: lang, decimals: 0, title: T(lang, 'Chiffre d\'affaires (k€)', 'Revenue (€k)'), labels: years.map(String), series: [{ name: '', values: vals }] } },
        unit: 'year', dec: 0, value: v, choices: choices, answer: best,
        explain: [
          'Croissance annuelle : ' + [0, 1, 2, 3].map(function (k) { return years[k + 1] + ' : ' + signed(g[k], 'pct', 'fr', 1); }).join(' ; ') + '.',
          'La plus forte est ' + v + '. ' + years[bestAbs + 1] + ' a la plus forte hausse en valeur (+' + n0(d[bestAbs], 'fr') + ' k€), mais sur une base plus élevée.'
        ],
        shortcut: 'Une même hausse en valeur pèse plus lourd sur une petite base : comparez hausse ÷ valeur de départ, pas la hauteur des marches.'
      };
    }
  });

  /* ---------------- N27 Indice base 100 ---------------- */
  def({
    id: 'N27', title: 'Indice base 100', skill: 'Lecture de données', difficulty: 2, targetSec: 55, range: [-30, 40],
    make: function (rng, lang) {
      var years = ['2020', '2021', '2022', '2023', '2024', '2025'], idx = [100];
      for (var i = 1; i < 6; i++) idx.push(U.round(idx[i - 1] * (1 + change(rng, -6, 14) / 100), 1));
      var k = ri(rng, 2, 5), a = idx[k - 1], b = idx[k], v = pct(a, b);
      var ch = C.buildChoices(rng, v, [
        { v: b - a, err: 'pp' },
        { v: (b - a) / b * 100, err: 'base' },
        { v: b - 100, err: 'lecture' },
        { v: pct(idx[k - 2], idx[k - 1]), err: 'lecture' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, 'De combien de pour cent les prix ont-ils augmenté entre ' + years[k - 1] + ' et ' + years[k] + ' ?', 'By what percentage did prices change between ' + years[k - 1] + ' and ' + years[k] + '?'),
        visual: { kind: 'chart', spec: { kind: 'line', lang: lang, decimals: 1, title: T(lang, 'Indice des prix des matières premières (base 100 en 2020)', 'Raw material price index (2020 = 100)'), labels: years, series: [{ name: '', values: idx }] } },
        unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Variation = indice d\'arrivée ÷ indice de départ − 1.',
          U.fmtNum(b, 'fr', 1) + ' ÷ ' + U.fmtNum(a, 'fr', 1) + ' − 1 = ' + signed(v, 'pct', 'fr', 1) + '.',
          'L\'écart d\'indice (' + signed(b - a, 'pp', 'fr', 1).replace('points', 'points d\'indice').replace('point', 'point d\'indice') + ') n\'est un pourcentage que si l\'année de départ vaut 100.'
        ],
        shortcut: 'Seule l\'année de base (100) permet de lire directement une variation en % depuis cette base.'
      };
    }
  });

  /* ---------------- N28 Taux de rotation du personnel ---------------- */
  def({
    id: 'N28', title: 'Taux de rotation du personnel', skill: 'Ratios', difficulty: 2, targetSec: 50, range: [1, 60],
    make: function (rng, lang) {
      var S = ri(rng, 200, 1500), E;
      do { E = Math.round(S * (1 + change(rng, -15, 20) / 100)); } while (E === S);
      var D = Math.round(((S + E) / 2) * (0.06 + rng() * 0.2));
      var v = D / ((S + E) / 2) * 100;
      var ch = C.buildChoices(rng, v, [
        { v: D / S * 100, err: 'base' },
        { v: D / E * 100, err: 'base' },
        { v: Math.abs(S - E) / S * 100, err: 'lecture' },
        { v: D / (S + E) * 100, err: 'moyenne' }
      ], function (x) { return fv(x, 'pct', lang, 1); }, 5, { dec: 1, positive: true });
      return {
        prompt: T(lang, 'Effectif au 1er janvier : ' + n0(S, lang) + ' ; au 31 décembre : ' + n0(E, lang) + ' ; départs dans l\'année : ' + D + '. Quel est le taux de rotation (départs ÷ effectif moyen) ?',
          'Headcount on 1 January: ' + n0(S, lang) + '; on 31 December: ' + n0(E, lang) + '; leavers during the year: ' + D + '. What is the staff turnover rate (leavers ÷ average headcount)?'),
        visual: null, unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Effectif moyen = (' + n0(S, 'fr') + ' + ' + n0(E, 'fr') + ') ÷ 2 = ' + U.fmtNum((S + E) / 2, 'fr', 1) + '.',
          'Taux = ' + D + ' ÷ ' + U.fmtNum((S + E) / 2, 'fr', 1) + ' × 100 = ' + frf(v, 'pct', 1) + '.'
        ],
        shortcut: 'La définition est donnée dans l\'énoncé : appliquez-la à la lettre (effectif MOYEN au dénominateur).'
      };
    }
  });

  /* ---------------- N29 Écart en valeur à partir de parts ---------------- */
  def({
    id: 'N29', title: 'Écart en valeur entre deux parts', skill: 'Pourcentages', difficulty: 2, targetSec: 55, range: [1, 1e5],
    make: function (rng, lang) {
      var deps = T(lang, ['Audit', 'Fiscal', 'Conseil', 'Juridique', 'Support'], ['Audit', 'Tax', 'Advisory', 'Legal', 'Support']), s = [], left = 100;
      for (var i = 0; i < 4; i++) { s[i] = ri(rng, 6, Math.min(35, left - 6 * (4 - i))); left -= s[i]; }
      s[4] = left;
      var total = ri(rng, 20, 160) * 100;
      var a = ri(rng, 0, 4), b;
      do { b = ri(rng, 0, 4); } while (b === a || s[b] === s[a]);
      var v = total * Math.abs(s[a] - s[b]) / 100;
      var ch = C.buildChoices(rng, v, [
        { v: Math.abs(s[a] - s[b]), err: 'conversion' },
        { v: total * Math.max(s[a], s[b]) / 100, err: 'lecture' },
        { v: total * (s[a] + s[b]) / 100, err: 'sens' },
        { v: total * Math.abs(s[a] - s[b]) / Math.max(s[a], s[b]), err: 'base' }
      ], function (x) { return fv(x, 'keur', lang, 0); }, 5, { positive: true });
      return {
        prompt: T(lang, 'Le budget formation total est de ' + fv(total, 'keur', lang, 0) + '. Quel écart, en k€, sépare le budget du département ' + deps[a] + ' de celui du département ' + deps[b] + ' ?',
          'The total training budget is ' + fv(total, 'keur', lang, 0) + '. What is the difference, in €k, between the ' + deps[a] + ' and ' + deps[b] + ' budgets?'),
        visual: { kind: 'chart', spec: { kind: 'bar', lang: lang, decimals: 0, unit: '%', title: T(lang, 'Répartition du budget formation (%)', 'Training budget split (%)'), labels: deps, series: [{ name: '', values: s }] } },
        unit: 'keur', dec: 0, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Écart de parts : ' + s[a] + ' % − ' + s[b] + ' % = ' + (s[a] - s[b]) + ' points.',
          'En valeur : ' + n0(total, 'fr') + ' × ' + Math.abs(s[a] - s[b]) + ' % = ' + frf(v, 'keur', 0) + '.'
        ],
        shortcut: 'Calculez l\'écart de parts d\'abord, puis appliquez-le une seule fois au total.'
      };
    }
  });

  /* ---------------- N30 Effet prix / volume ---------------- */
  def({
    id: 'N30', title: 'Effet prix et volume sur le CA', skill: 'Contrôle de gestion', difficulty: 2, targetSec: 50, range: [-30, 30],
    make: function (rng, lang) {
      var p = ri(rng, 2, 15), q = ri(rng, 2, 18), firm = pick(rng, FIRMS);
      var v = ((1 + p / 100) * (1 - q / 100) - 1) * 100;
      var ch = C.buildChoices(rng, v, [
        { v: p - q, err: 'compose' },
        { v: ((1 - p / 100) * (1 + q / 100) - 1) * 100, err: 'sens' },
        { v: p + q, err: 'sens' },
        { v: -(p * q) / 100, err: 'calcul' }
      ], function (x) { return signed(x, 'pct', lang, 1); }, 5, { dec: 1 });
      return {
        prompt: T(lang, firm + ' a augmenté ses prix de ' + p + ' %, mais ses volumes vendus ont baissé de ' + q + ' %. Quelle est la variation de son chiffre d\'affaires ?',
          firm + ' raised its prices by ' + p + '%, but the volumes sold fell by ' + q + '%. By what percentage did its revenue change?'),
        visual: null, unit: 'pct', dec: 1, value: v, choices: ch.choices, answer: ch.answer,
        explain: [
          'Chiffre d\'affaires = prix × volume : les coefficients se multiplient.',
          U.fmtNum(1 + p / 100, 'fr', 2) + ' × ' + U.fmtNum(1 - q / 100, 'fr', 2) + ' = ' + U.fmtNum((1 + p / 100) * (1 - q / 100), 'fr', 4) + ', soit ' + signed(v, 'pct', 'fr', 1) + '.'
        ],
        shortcut: 'p − q − (p × q ÷ 100) = ' + p + ' − ' + q + ' − ' + U.fmtNum(p * q / 100, 'fr', 2) + '.'
      };
    }
  });

  /* ---------------- Accès ---------------- */
  var byId = {};
  GENS.forEach(function (g) { byId[g.id] = g; });

  /**
   * Produit une question prête à afficher.
   * Renvoie { id (unique), gen, lang, title, prompt, visual, choices, answer, value, unit, dec, explain, shortcut, targetSec, difficulty }
   */
  function generate(genId, rng, lang, seq) {
    var g = byId[genId];
    var q = g.make(rng, lang);
    q.gen = g.id; q.lang = lang; q.title = g.title; q.skill = g.skill;
    q.targetSec = g.targetSec; q.difficulty = g.difficulty; q.module = 'numerique';
    q.id = g.id + '-' + lang + '-' + (seq == null ? Math.floor(rng() * 1e9) : seq);
    return q;
  }

  /**
   * Choisit le prochain générateur : les types les moins réussis reviennent plus souvent.
   * stats : { genId: { n, ok } }. Poids = 1 + 3 × taux d'échec (lissé), les types jamais vus passent devant.
   */
  function pickGen(rng, stats, exclude) {
    var w = [], total = 0;
    GENS.forEach(function (g) {
      if (exclude && exclude.indexOf(g.id) !== -1) return;
      var s = (stats && stats[g.id]) || { n: 0, ok: 0 };
      var fail = (s.n - s.ok + 1) / (s.n + 2);
      var weight = s.n === 0 ? 3 : 1 + 3 * fail;
      w.push([g.id, weight]); total += weight;
    });
    var x = rng() * total;
    for (var i = 0; i < w.length; i++) { x -= w[i][1]; if (x <= 0) return w[i][0]; }
    return w[w.length - 1][0];
  }

  BP.gen = BP.gen || {};
  BP.gen.numeric = { GENS: GENS, byId: byId, generate: generate, pickGen: pickGen, ERR_LABELS: ERR_LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.gen.numeric;
})(typeof self !== 'undefined' ? self : globalThis);
