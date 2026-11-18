/* Big4 Prep — générateurs de raisonnement abstrait / logique inductive.
   Figures décrites par des données (formes, rotations, couleurs, nombre d'éléments) et dessinées en SVG.
   Chaque générateur applique une ou deux règles, calcule la bonne figure et fabrique des distracteurs
   qui ne respectent qu'une partie de la règle. La clé canonique d'une figure tient compte des symétries
   (un carré tourné de 90° est identique) : deux propositions ne peuvent pas être visuellement identiques.
   Types d'erreurs : partielle (une règle sur deux), pas (mauvais pas), sens (mauvais sens), decalage (une étape de trop ou de moins), autre. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};
  var U = BP.util || (typeof require !== 'undefined' ? require('../core/util.js') : null);
  var ri = U.randInt, pick = U.pick;

  var ERR_LABELS = {
    partielle: 'Une seule des règles appliquée',
    pas: 'Mauvais pas de progression',
    sens: 'Mauvais sens de rotation / de déplacement',
    decalage: 'Une étape de trop ou de moins',
    autre: 'Règle mal identifiée'
  };

  /* ---------------- Figures ---------------- */

  function mod(a, n) { return ((a % n) + n) % n; }
  function symOf(it) {
    if (it.t === 'circle') return 1;
    if (it.t === 'poly') return 360 / it.sides;
    if (it.t === 'star') return 72;
    return 360;
  }
  /** Clé canonique d'une figure (rotations ramenées selon la symétrie de la forme). */
  function key(fig) {
    return JSON.stringify(fig.map(function (it) {
      var o = {};
      Object.keys(it).sort().forEach(function (k) { o[k] = it[k]; });
      if ('rot' in o) o.rot = symOf(it) === 1 ? 0 : mod(o.rot, symOf(it));
      if (o.t === 'quarters') o.q = o.q.join('');
      return o;
    }));
  }

  var FILL = { black: 'fig-black', white: 'fig-white', grey: 'fig-grey' };
  function rotPt(x, y, deg) {
    var a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return [50 + x * c - y * s, 50 + x * s + y * c];
  }
  function pts(list) { return list.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join(' '); }

  var DICE = {
    1: [[50, 50]], 2: [[32, 32], [68, 68]], 3: [[30, 30], [50, 50], [70, 70]], 4: [[32, 32], [68, 32], [32, 68], [68, 68]],
    5: [[30, 30], [70, 30], [50, 50], [30, 70], [70, 70]], 6: [[32, 28], [68, 28], [32, 50], [68, 50], [32, 72], [68, 72]],
    7: [[30, 28], [70, 28], [30, 50], [50, 50], [70, 50], [30, 72], [70, 72]], 8: [[30, 26], [50, 26], [70, 26], [30, 50], [70, 50], [30, 74], [50, 74], [70, 74]],
    9: [[28, 28], [50, 28], [72, 28], [28, 50], [50, 50], [72, 50], [28, 72], [50, 72], [72, 72]]
  };
  var SMALL = { // points à l'intérieur d'un polygone
    1: [[50, 54]], 2: [[42, 54], [58, 54]], 3: [[40, 58], [50, 46], [60, 58]], 4: [[42, 46], [58, 46], [42, 60], [58, 60]],
    5: [[40, 46], [60, 46], [50, 53], [40, 60], [60, 60]], 6: [[40, 44], [50, 44], [60, 44], [40, 60], [50, 60], [60, 60]],
    7: [[40, 44], [50, 44], [60, 44], [50, 52], [40, 60], [50, 60], [60, 60]], 8: [[38, 44], [46, 44], [54, 44], [62, 44], [38, 60], [46, 60], [54, 60], [62, 60]]
  };

  function itemSVG(it) {
    var cls = FILL[it.fill || 'white'] || 'fig-white';
    var r, i, p, out = [];
    switch (it.t) {
      case 'circle':
        return '<circle class="' + cls + '" cx="50" cy="50" r="' + (it.r || 32) + '"/>';
      case 'poly':
        r = it.r || 34; p = [];
        for (i = 0; i < it.sides; i++) { var a = -90 + i * 360 / it.sides; p.push(rotPt(r * Math.cos(a * Math.PI / 180), r * Math.sin(a * Math.PI / 180), it.rot || 0)); }
        return '<polygon class="' + cls + '" points="' + pts(p) + '"/>';
      case 'star':
        p = [];
        for (i = 0; i < 10; i++) { var rr = i % 2 ? 15 : 36, b = -90 + i * 36; p.push(rotPt(rr * Math.cos(b * Math.PI / 180), rr * Math.sin(b * Math.PI / 180), it.rot || 0)); }
        return '<polygon class="' + cls + '" points="' + pts(p) + '"/>';
      case 'arrow':
        p = [[0, -36], [-20, -10], [-8, -10], [-8, 32], [8, 32], [8, -10], [20, -10]].map(function (q) { return rotPt(q[0], q[1], it.rot || 0); });
        return '<polygon class="' + cls + '" points="' + pts(p) + '"/>';
      case 'dots':
        return (it.inner ? SMALL : DICE)[it.n].map(function (q) { return '<circle class="' + cls + '" cx="' + q[0] + '" cy="' + q[1] + '" r="' + (it.inner ? 3.6 : 7) + '"/>'; }).join('');
      case 'marker':
        var ang = (-90 + it.pos * 45) * Math.PI / 180;
        return '<circle class="' + cls + '" cx="' + (50 + 42 * Math.cos(ang)).toFixed(1) + '" cy="' + (50 + 42 * Math.sin(ang)).toFixed(1) + '" r="6.5"/>';
      case 'lines':
        out.push('<rect class="fig-white" x="20" y="20" width="60" height="60"/>');
        for (i = 1; i <= it.n; i++) {
          var c = 20 + 60 * i / (it.n + 1);
          out.push(it.dir === 'h' ? '<line class="fig-line" x1="20" x2="80" y1="' + c.toFixed(1) + '" y2="' + c.toFixed(1) + '"/>' : '<line class="fig-line" y1="20" y2="80" x1="' + c.toFixed(1) + '" x2="' + c.toFixed(1) + '"/>');
        }
        return out.join('');
      case 'quarters':
        // quarts : 0 haut-droit, 1 bas-droit, 2 bas-gauche, 3 haut-gauche
        var paths = ['M50 50 L50 16 A34 34 0 0 1 84 50 Z', 'M50 50 L84 50 A34 34 0 0 1 50 84 Z', 'M50 50 L50 84 A34 34 0 0 1 16 50 Z', 'M50 50 L16 50 A34 34 0 0 1 50 16 Z'];
        return it.q.map(function (f, k) { return '<path class="' + (f ? 'fig-black' : 'fig-white') + '" d="' + paths[k] + '"/>'; }).join('');
      default: return '';
    }
  }

  function figureSVG(fig, label) {
    return '<svg class="fig" viewBox="0 0 100 100" role="img" aria-label="' + (label || 'Figure') + '" xmlns="http://www.w3.org/2000/svg">' +
      fig.map(itemSVG).join('') + '</svg>';
  }

  /* ---------------- Outils ---------------- */

  /** Assemble les propositions : la bonne d'abord, puis des distracteurs de clés différentes. */
  function options(rng, correct, wrongs, count) {
    count = count || 5;
    var seen = {}, out = [{ fig: correct, err: null }];
    seen[key(correct)] = 1;
    wrongs.forEach(function (w) {
      if (out.length >= count || !w || !w.fig) return;
      var k = key(w.fig);
      if (seen[k]) return;
      seen[k] = 1; out.push({ fig: w.fig, err: w.err || 'autre' });
    });
    var sh = U.shuffle(out, rng);
    return { choices: sh, answer: sh.indexOf(out[0]) };
  }
  function numOptions(rng, correct, wrongs, count, fmt) {
    count = count || 5; fmt = fmt || String;
    var seen = {}, out = [{ text: fmt(correct), value: correct, err: null }];
    seen[fmt(correct)] = 1;
    wrongs.forEach(function (w) {
      if (out.length >= count || w == null || w.v == null) return;
      var t = fmt(w.v);
      if (seen[t] || (typeof w.v === 'number' && !isFinite(w.v))) return;
      seen[t] = 1; out.push({ text: t, value: w.v, err: w.err || 'autre' });
    });
    for (var d = 1; out.length < count && d < 50; d++) {
      [correct + d, correct - d].forEach(function (v) {
        if (out.length >= count || typeof correct !== 'number') return;
        var t = fmt(v);
        if (!seen[t]) { seen[t] = 1; out.push({ text: t, value: v, err: 'pas' }); }
      });
    }
    var sh = U.shuffle(out, rng);
    return { choices: sh, answer: sh.indexOf(out[0]) };
  }
  function deg(d) { return mod(d, 360) + '°'; }
  var FILLS = ['black', 'white', 'grey'];
  var FILL_FR = { black: 'noir', white: 'blanc', grey: 'gris' };

  var GENS = [];
  function def(g) { GENS.push(g); }

  /* A01 — rotation d'une flèche */
  def({
    id: 'A01', title: 'Rotation', difficulty: 1, targetSec: 40, kind: 'next',
    make: function (rng) {
      var step = pick(rng, [45, 90, 135, -45, -90]), r0 = ri(rng, 0, 7) * 45, fill = pick(rng, ['black', 'white']);
      var f = function (i) { return [{ t: 'arrow', rot: r0 + step * i, fill: fill }]; };
      var seq = [0, 1, 2, 3, 4].map(f), ans = f(5);
      var o = options(rng, ans, [
        { fig: f(4), err: 'decalage' }, { fig: f(6), err: 'decalage' },
        { fig: [{ t: 'arrow', rot: r0 + step * 4 - step, fill: fill }], err: 'sens' },
        { fig: [{ t: 'arrow', rot: r0 + step * 5 + 180, fill: fill }], err: 'autre' },
        { fig: [{ t: 'arrow', rot: r0 + step * 5 + 45, fill: fill }], err: 'pas' },
        { fig: [{ t: 'arrow', rot: r0 + step * 5 - 45, fill: fill }], err: 'pas' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'La flèche tourne de ' + Math.abs(step) + '° dans le sens ' + (step > 0 ? 'des aiguilles d\'une montre' : 'inverse des aiguilles d\'une montre') + ' à chaque étape.',
        explain: ['Comparez deux cases consécutives : l\'angle change toujours de la même valeur (' + Math.abs(step) + '°).', 'Sixième case : la flèche pointe à ' + deg(r0 + step * 5) + ' (0° = vers le haut).'] };
    }
  });

  /* A02 — nombre de points */
  def({
    id: 'A02', title: 'Nombre d\'éléments', difficulty: 1, targetSec: 35, kind: 'next',
    make: function (rng) {
      var mode = pick(rng, ['up1', 'down1', 'alt']), n0, f;
      if (mode === 'up1') { n0 = ri(rng, 1, 3); f = function (i) { return n0 + i; }; }
      else if (mode === 'down1') { n0 = 9; f = function (i) { return 9 - i; }; }
      else { n0 = ri(rng, 1, 2); f = function (i) { return n0 + Math.floor(i / 2) + (i % 2 ? 2 : 0); }; }
      var fill = pick(rng, ['black', 'grey']);
      var g = function (n) { return [{ t: 'dots', n: Math.max(1, Math.min(9, n)), fill: fill }]; };
      var seq = [0, 1, 2, 3, 4].map(function (i) { return g(f(i)); }), c = f(5);
      var o = options(rng, g(c), [
        { fig: g(c + 1), err: 'pas' }, { fig: g(c - 1), err: 'pas' }, { fig: g(f(4)), err: 'decalage' }, { fig: g(c + 2), err: 'pas' }, { fig: g(c - 2), err: 'pas' }
      ]);
      var rule = mode === 'up1' ? 'On ajoute un point à chaque étape.' : mode === 'down1' ? 'On retire un point à chaque étape.' : 'On ajoute alternativement deux points puis on en retire un (+2, −1, +2, −1…).';
      return { seq: seq, choices: o.choices, answer: o.answer, rule: rule,
        explain: ['Comptez les points de chaque case : ' + [0, 1, 2, 3, 4].map(f).join(', ') + '.', 'La case suivante en compte ' + c + '.'] };
    }
  });

  /* A03 — couleur (cycle de 3) et forme (cycle de 2) */
  def({
    id: 'A03', title: 'Deux cycles : couleur et forme', difficulty: 2, targetSec: 50, kind: 'next',
    make: function (rng) {
      var fills = U.shuffle(FILLS, rng), shapes = U.shuffle([{ t: 'circle' }, { t: 'poly', sides: 4, rot: 0 }, { t: 'poly', sides: 3, rot: 0 }], rng).slice(0, 2);
      var mk = function (s, f) { var o = JSON.parse(JSON.stringify(shapes[s])); o.fill = fills[f]; return [o]; };
      var f = function (i) { return mk(i % 2, i % 3); };
      var seq = [0, 1, 2, 3, 4].map(f), ans = f(5);
      var o = options(rng, ans, [
        { fig: mk(1, 5 % 3), err: 'partielle' }, { fig: mk(0, 4 % 3), err: 'partielle' }, { fig: mk(0, 0), err: 'partielle' }, { fig: f(4), err: 'decalage' }, { fig: mk(1, 0), err: 'autre' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Deux règles indépendantes : la couleur suit un cycle de trois (' + fills.map(function (x) { return FILL_FR[x]; }).join(' → ') + ') et la forme alterne une case sur deux.',
        explain: ['Couleur de la 6e case : position 6 dans un cycle de 3 → ' + FILL_FR[fills[5 % 3]] + '.', 'Forme : les cases paires et impaires alternent → même forme que la 2e et la 4e case.'] };
    }
  });

  /* A04 — nombre de côtés */
  def({
    id: 'A04', title: 'Nombre de côtés', difficulty: 1, targetSec: 35, kind: 'next',
    make: function (rng) {
      var down = rng() < 0.4, s0 = down ? 9 : 3, step = down ? -1 : 1, fill = pick(rng, FILLS);
      var g = function (s) { return [{ t: 'poly', sides: s, rot: 0, fill: fill }]; };
      var seq = [0, 1, 2, 3, 4].map(function (i) { return g(s0 + step * i); }), c = s0 + step * 5;
      var o = options(rng, g(c), [
        { fig: g(c + step), err: 'pas' }, { fig: g(c - step), err: 'decalage' }, { fig: [{ t: 'circle', fill: fill }], err: 'autre' }, { fig: g(c - 2 * step), err: 'decalage' },
        { fig: [{ t: 'poly', sides: c, rot: 0, fill: fill === 'black' ? 'white' : 'black' }], err: 'autre' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Le polygone ' + (down ? 'perd' : 'gagne') + ' un côté à chaque étape ; la couleur ne change pas.',
        explain: ['Côtés : ' + [0, 1, 2, 3, 4].map(function (i) { return s0 + step * i; }).join(', ') + '.', 'Case suivante : ' + c + ' côtés.'] };
    }
  });

  /* A05 — déplacement d'un repère autour du cadre */
  def({
    id: 'A05', title: 'Déplacement circulaire', difficulty: 2, targetSec: 45, kind: 'next',
    make: function (rng) {
      var step = pick(rng, [1, 2, 3, -1, -3]), p0 = ri(rng, 0, 7);
      var g = function (i) { return [{ t: 'poly', sides: 4, rot: 45, fill: 'white', r: 22 }, { t: 'marker', pos: mod(p0 + step * i, 8), fill: 'black' }]; };
      var seq = [0, 1, 2, 3, 4].map(g), ans = g(5);
      var at = function (p) { return [{ t: 'poly', sides: 4, rot: 45, fill: 'white', r: 22 }, { t: 'marker', pos: mod(p, 8), fill: 'black' }]; };
      var o = options(rng, ans, [
        { fig: at(p0 + step * 4 - step), err: 'sens' }, { fig: g(6), err: 'decalage' }, { fig: at(p0 + step * 5 + 1), err: 'pas' }, { fig: at(p0 + step * 5 - 1), err: 'pas' }, { fig: g(4), err: 'decalage' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Le point noir avance de ' + Math.abs(step) + ' position' + (Math.abs(step) > 1 ? 's' : '') + ' sur 8 dans le sens ' + (step > 0 ? 'des aiguilles d\'une montre' : 'inverse des aiguilles d\'une montre') + '.',
        explain: ['Repérez les 8 positions possibles (coins et milieux des côtés) et comptez le saut entre deux cases.', 'Appliquez le même saut une fois de plus.'] };
    }
  });

  /* A06 — rotation + alternance de couleur */
  def({
    id: 'A06', title: 'Rotation et couleur alternée', difficulty: 2, targetSec: 50, kind: 'next',
    make: function (rng) {
      var step = pick(rng, [90, -90, 45, 135]), r0 = ri(rng, 0, 7) * 45, cols = U.shuffle(['black', 'white', 'grey'], rng).slice(0, 2);
      var g = function (rot, f) { return [{ t: 'arrow', rot: rot, fill: f }]; };
      var f = function (i) { return g(r0 + step * i, cols[i % 2]); };
      var seq = [0, 1, 2, 3, 4].map(f), ans = f(5);
      var o = options(rng, ans, [
        { fig: g(r0 + step * 5, cols[0]), err: 'partielle' }, { fig: g(r0 + step * 4, cols[1]), err: 'partielle' }, { fig: g(r0 + step * 5 + 180, cols[1]), err: 'sens' },
        { fig: g(r0 + step * 3, cols[1]), err: 'sens' }, { fig: g(r0 + step * 6, cols[0]), err: 'decalage' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'La flèche tourne de ' + Math.abs(step) + '° (' + (step > 0 ? 'sens horaire' : 'sens antihoraire') + ') et sa couleur alterne ' + FILL_FR[cols[0]] + ' / ' + FILL_FR[cols[1]] + '.',
        explain: ['Traitez les deux règles séparément : d\'abord l\'angle, puis la couleur.', 'Les cases impaires (2e, 4e, 6e) sont ' + FILL_FR[cols[1]] + 'es.'] };
    }
  });

  /* A07 — nombre de traits et orientation */
  def({
    id: 'A07', title: 'Traits : nombre et orientation', difficulty: 2, targetSec: 45, kind: 'next',
    make: function (rng) {
      var n0 = ri(rng, 1, 2), d0 = pick(rng, ['h', 'v']), other = d0 === 'h' ? 'v' : 'h';
      var g = function (n, d) { return [{ t: 'lines', n: n, dir: d }]; };
      var f = function (i) { return g(n0 + i, i % 2 ? other : d0); };
      var seq = [0, 1, 2, 3, 4].map(f), ans = f(5);
      var o = options(rng, ans, [
        { fig: g(n0 + 5, d0), err: 'partielle' }, { fig: g(n0 + 4, other), err: 'partielle' }, { fig: g(n0 + 6, other), err: 'pas' }, { fig: g(n0 + 4, d0), err: 'decalage' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Un trait de plus à chaque étape, et l\'orientation alterne (horizontal / vertical).',
        explain: ['Traits : ' + [0, 1, 2, 3, 4].map(function (i) { return n0 + i; }).join(', ') + ' → ' + (n0 + 5) + '.', 'Orientation de la 6e case : la même que la 2e et la 4e.'] };
    }
  });

  /* A08 — repère qui tourne + forme intérieure alternée */
  def({
    id: 'A08', title: 'Deux éléments indépendants', difficulty: 3, targetSec: 60, kind: 'next',
    make: function (rng) {
      var step = pick(rng, [1, 2, -1]), p0 = ri(rng, 0, 7), inner = U.shuffle([{ t: 'poly', sides: 3, rot: 0, r: 30 }, { t: 'circle', r: 24 }, { t: 'poly', sides: 4, rot: 0, r: 28 }], rng).slice(0, 2);
      var dots0 = ri(rng, 1, 2);
      var g = function (pos, s, d) { var x = JSON.parse(JSON.stringify(inner[s])); x.fill = 'white'; return [x, { t: 'marker', pos: mod(pos, 8), fill: 'black' }, { t: 'dots', n: d, fill: 'black', inner: true }]; };
      var f = function (i) { return g(p0 + step * i, i % 2, dots0 + Math.floor(i / 2)); };
      var seq = [0, 1, 2, 3, 4].map(f), ans = f(5);
      var o = options(rng, ans, [
        { fig: g(p0 + step * 5, 0, dots0 + 2), err: 'partielle' }, { fig: g(p0 + step * 4, 1, dots0 + 2), err: 'partielle' }, { fig: g(p0 + step * 5, 1, dots0 + 3), err: 'pas' },
        { fig: g(p0 - step * 5, 1, dots0 + 2), err: 'sens' }, { fig: g(p0 + step * 6, 0, dots0 + 3), err: 'decalage' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Trois règles : le point extérieur avance de ' + Math.abs(step) + ' position(s) ' + (step > 0 ? 'en sens horaire' : 'en sens antihoraire') + ', la forme centrale alterne, et un point intérieur s\'ajoute toutes les deux cases.',
        explain: ['Isolez chaque élément et suivez-le sur les cinq cases, l\'un après l\'autre.', 'Points intérieurs : ' + [0, 1, 2, 3, 4].map(function (i) { return dots0 + Math.floor(i / 2); }).join(', ') + ' → ' + (dots0 + 2) + '.'] };
    }
  });

  /* A09 — intrus : nombre de points = nombre de côtés */
  def({
    id: 'A09', title: 'Intrus : côtés et points', difficulty: 2, targetSec: 50, kind: 'odd',
    make: function (rng) {
      var sides = U.shuffle([3, 4, 5, 6, 7], rng), odd = ri(rng, 0, 4);
      var figs = sides.map(function (s, i) {
        var n = s;
        if (i === odd) n = s + (s >= 7 ? -1 : pick(rng, [-1, 1]));
        return [{ t: 'poly', sides: s, rot: 0, fill: 'white' }, { t: 'dots', n: Math.min(8, n), fill: 'black', inner: true }];
      });
      return { choices: figs.map(function (fg, i) { return { fig: fg, err: i === odd ? null : 'autre' }; }), answer: odd,
        rule: 'Dans chaque figure, le nombre de points est égal au nombre de côtés, sauf dans l\'intrus.',
        explain: ['Comptez côtés et points de chaque figure.', 'Seule la figure ' + 'ABCDE'.charAt(odd) + ' a ' + sides[odd] + ' côtés mais un nombre de points différent.'] };
    }
  });

  /* A10 — intrus : le point est dans la direction de la flèche */
  def({
    id: 'A10', title: 'Intrus : direction', difficulty: 2, targetSec: 45, kind: 'odd',
    make: function (rng) {
      var odd = ri(rng, 0, 4), used = U.shuffle([0, 1, 2, 3, 4, 5, 6, 7], rng).slice(0, 5), shift = pick(rng, [2, 4, 6]);
      var figs = used.map(function (p, i) {
        return [{ t: 'arrow', rot: p * 45, fill: 'grey', r: 0 }, { t: 'marker', pos: i === odd ? mod(p + shift, 8) : p, fill: 'black' }];
      });
      return { choices: figs.map(function (fg, i) { return { fig: fg, err: i === odd ? null : 'autre' }; }), answer: odd,
        rule: 'Le point noir se trouve du côté vers lequel pointe la flèche, sauf dans l\'intrus.',
        explain: ['La rotation de la flèche varie d\'une figure à l\'autre : ce n\'est pas elle qui compte, mais la relation entre la flèche et le point.', 'Figure ' + 'ABCDE'.charAt(odd) + ' : le point n\'est pas dans l\'axe de la flèche.'] };
    }
  });

  /* A11 — suites numériques */
  var NUM_TYPES = ['arith', 'geo', 'diffs', 'alt', 'fibo', 'squares'];
  def({
    id: 'A11', title: 'Suite numérique', difficulty: 2, targetSec: 50, kind: 'number',
    make: function (rng) {
      var type = pick(rng, NUM_TYPES), t = [], i, nxt, rule, wrong = [];
      if (type === 'arith') {
        var a = ri(rng, 2, 40), d = pick(rng, [3, 4, 6, 7, 8, 9, 11, 12, -3, -4, -6]); if (d < 0) a += 60;
        for (i = 0; i < 5; i++) t.push(a + d * i); nxt = a + d * 5; rule = 'On ajoute ' + d + ' à chaque terme.';
        wrong = [{ v: nxt + d, err: 'decalage' }, { v: nxt - 1, err: 'pas' }, { v: nxt + 1, err: 'pas' }, { v: t[4] * 2 - t[3] + 2, err: 'calcul' }];
      } else if (type === 'geo') {
        var g0 = ri(rng, 2, 5), q = pick(rng, [2, 3]);
        for (i = 0; i < 5; i++) t.push(g0 * Math.pow(q, i)); nxt = g0 * Math.pow(q, 5); rule = 'Chaque terme est multiplié par ' + q + '.';
        wrong = [{ v: t[4] + (t[4] - t[3]), err: 'autre' }, { v: nxt * q, err: 'decalage' }, { v: t[4] + t[3], err: 'autre' }, { v: nxt - g0, err: 'calcul' }];
      } else if (type === 'diffs') {
        var b0 = ri(rng, 1, 20), d0 = ri(rng, 1, 4), inc = pick(rng, [1, 2]); t.push(b0);
        for (i = 1; i < 5; i++) t.push(t[i - 1] + d0 + inc * (i - 1)); nxt = t[4] + d0 + inc * 4;
        rule = 'Les écarts augmentent de ' + inc + ' à chaque fois (+' + d0 + ', +' + (d0 + inc) + ', +' + (d0 + 2 * inc) + '…).';
        wrong = [{ v: t[4] + (t[4] - t[3]), err: 'pas' }, { v: nxt + inc, err: 'pas' }, { v: nxt - inc * 2, err: 'pas' }, { v: t[4] + d0, err: 'autre' }];
      } else if (type === 'alt') {
        var s = ri(rng, 10, 40), up = ri(rng, 4, 9), dn = ri(rng, 1, 3); t.push(s);
        for (i = 1; i < 5; i++) t.push(t[i - 1] + (i % 2 ? up : -dn)); nxt = t[4] + up;
        rule = 'On ajoute ' + up + ' puis on retire ' + dn + ', en alternance.';
        wrong = [{ v: t[4] - dn, err: 'decalage' }, { v: t[4] + up - dn, err: 'autre' }, { v: t[4] + dn, err: 'sens' }, { v: nxt + 1, err: 'pas' }];
      } else if (type === 'fibo') {
        var f0 = ri(rng, 1, 5), f1 = ri(rng, 2, 7); t = [f0, f1];
        for (i = 2; i < 5; i++) t.push(t[i - 1] + t[i - 2]); nxt = t[4] + t[3];
        rule = 'Chaque terme est la somme des deux précédents.';
        wrong = [{ v: t[4] + (t[4] - t[3]), err: 'autre' }, { v: t[4] + t[2], err: 'decalage' }, { v: nxt + 1, err: 'pas' }, { v: t[4] * 2, err: 'autre' }];
      } else {
        var k0 = ri(rng, 1, 5), off = pick(rng, [0, 1, -1, 2]);
        for (i = 0; i < 5; i++) t.push((k0 + i) * (k0 + i) + off); nxt = (k0 + 5) * (k0 + 5) + off;
        rule = 'Carrés successifs (' + k0 + '², ' + (k0 + 1) + '²…)' + (off ? ', ' + (off > 0 ? '+ ' + off : '− ' + (-off)) : '') + '.';
        wrong = [{ v: t[4] + (t[4] - t[3]), err: 'pas' }, { v: nxt + 2, err: 'pas' }, { v: (k0 + 6) * (k0 + 6) + off, err: 'decalage' }, { v: nxt - 1, err: 'pas' }];
      }
      var o = numOptions(rng, nxt, wrong, 5);
      return { terms: t, choices: o.choices, answer: o.answer, rule: rule,
        explain: ['Écrivez les écarts entre termes successifs : ' + t.slice(1).map(function (x, k) { var e = x - t[k]; return (e >= 0 ? '+' : '') + e; }).join(', ') + '.', 'Terme suivant : ' + nxt + '.'] };
    }
  });

  /* A12 — suites de lettres */
  var ALPHA = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  def({
    id: 'A12', title: 'Suite de lettres', difficulty: 2, targetSec: 45, kind: 'letter',
    make: function (rng) {
      var mode = pick(rng, ['step', 'back', 'grow']), idx = [], i, nxt, rule;
      if (mode === 'step') { var st = ri(rng, 2, 4), s0 = ri(rng, 0, 25 - st * 5); for (i = 0; i < 5; i++) idx.push(s0 + st * i); nxt = s0 + st * 5; rule = 'On avance de ' + st + ' lettres à chaque fois.'; }
      else if (mode === 'back') { var sb = ri(rng, 2, 3), b0 = ri(rng, sb * 5, 25); for (i = 0; i < 5; i++) idx.push(b0 - sb * i); nxt = b0 - sb * 5; rule = 'On recule de ' + sb + ' lettres à chaque fois.'; }
      else { var g0 = ri(rng, 0, 4); idx.push(g0); for (i = 1; i < 5; i++) idx.push(idx[i - 1] + i); nxt = idx[4] + 5; rule = 'Les sauts augmentent : +1, +2, +3, +4, puis +5.'; }
      var L = function (k) { return ALPHA.charAt(k); };
      var wrongIdx = [nxt + 1, nxt - 1, nxt + (mode === 'back' ? -1 : 1) * 2, idx[4] + (idx[4] - idx[3])].filter(function (k) { return k >= 0 && k < 26; });
      var o = numOptions(rng, nxt, wrongIdx.map(function (k, j) { return { v: k, err: j < 2 ? 'pas' : 'autre' }; }), 5, L);
      // filtrer les compléments hors alphabet
      o.choices = o.choices.filter(function (c) { return c.text; });
      if (o.choices.length < 4) { // sécurité (rare) : complète avec des lettres proches valides
        var have = {}; o.choices.forEach(function (c) { have[c.text] = 1; });
        for (var d = 2; o.choices.length < 5 && d < 26; d++) [nxt + d, nxt - d].forEach(function (k) { if (o.choices.length < 5 && k >= 0 && k < 26 && !have[L(k)]) { have[L(k)] = 1; o.choices.push({ text: L(k), value: k, err: 'pas' }); } });
      }
      o.answer = o.choices.map(function (c) { return c.err; }).indexOf(null);
      return { terms: idx.map(L), choices: o.choices, answer: o.answer, rule: rule,
        explain: ['Remplacez chaque lettre par son rang dans l\'alphabet : ' + idx.map(function (k) { return k + 1; }).join(', ') + '.', 'Rang suivant : ' + (nxt + 1) + ', soit la lettre ' + L(nxt) + '.'] };
    }
  });

  /* A13 — deux suites entrelacées */
  def({
    id: 'A13', title: 'Suites entrelacées', difficulty: 3, targetSec: 60, kind: 'number',
    make: function (rng) {
      var a0 = ri(rng, 2, 20), da = pick(rng, [2, 3, 5]), b0 = ri(rng, 30, 60), db = pick(rng, [-2, -3, -4, 4]);
      var t = [a0, b0, a0 + da, b0 + db, a0 + 2 * da, b0 + 2 * db], nxt = a0 + 3 * da;
      var o = numOptions(rng, nxt, [
        { v: b0 + 3 * db, err: 'partielle' }, { v: t[5] + (t[5] - t[4]), err: 'autre' }, { v: nxt + da, err: 'decalage' }, { v: nxt - 1, err: 'pas' }
      ], 5);
      return { terms: t, choices: o.choices, answer: o.answer,
        rule: 'Deux suites alternent : les termes impairs augmentent de ' + da + ', les termes pairs ' + (db > 0 ? 'augmentent de ' + db : 'diminuent de ' + (-db)) + '.',
        explain: ['Termes 1, 3, 5 : ' + [t[0], t[2], t[4]].join(', ') + ' (+' + da + ').', 'Le 7e terme appartient à cette suite : ' + nxt + '.'] };
    }
  });

  /* A14 — secteurs colorés qui tournent */
  def({
    id: 'A14', title: 'Secteurs qui tournent', difficulty: 2, targetSec: 45, kind: 'next',
    make: function (rng) {
      var pattern = pick(rng, [[1, 1, 0, 0], [1, 0, 1, 0], [1, 1, 1, 0], [1, 0, 0, 0]]), step = pick(rng, [1, -1]);
      if (pattern.join('') === '1010') step = 1;
      var rotQ = function (p, k) { var o = []; for (var j = 0; j < 4; j++) o[mod(j + k, 4)] = p[j]; return o; };
      var g = function (k) { return [{ t: 'quarters', q: rotQ(pattern, k) }]; };
      var seq = [0, 1, 2, 3, 4].map(function (i) { return g(step * i); });
      var ans = g(step * 5), alt = pattern.map(function (x) { return 1 - x; });
      var o = options(rng, ans, [
        { fig: g(step * 4), err: 'decalage' }, { fig: g(step * 6), err: 'decalage' }, { fig: g(-step * 5), err: 'sens' },
        { fig: [{ t: 'quarters', q: rotQ(alt, step * 5) }], err: 'autre' }, { fig: [{ t: 'quarters', q: [1, 1, 1, 1] }], err: 'autre' }, { fig: [{ t: 'quarters', q: rotQ([1, 0, 0, 0], step * 5 + 1) }], err: 'autre' }
      ]);
      return { seq: seq, choices: o.choices, answer: o.answer,
        rule: 'Le motif de secteurs noirs tourne d\'un quart de tour ' + (step > 0 ? 'dans le sens horaire' : 'dans le sens antihoraire') + ' à chaque étape.',
        explain: ['Suivez un secteur noir précis d\'une case à l\'autre.', 'Un quart de tour de plus après la 5e case.'] };
    }
  });

  var byId = {};
  GENS.forEach(function (g) { byId[g.id] = g; });

  function generate(genId, rng, seq) {
    var g = byId[genId], q = g.make(rng);
    q.gen = g.id; q.title = g.title; q.kind = g.kind; q.module = 'abstrait'; q.lang = 'fr';
    q.targetSec = g.targetSec; q.difficulty = g.difficulty;
    q.id = g.id + '-' + (seq == null ? Math.floor(rng() * 1e9) : seq);
    q.prompt = g.kind === 'odd' ? 'Quelle figure est l\'intrus ?' : g.kind === 'next' ? 'Quelle figure complète la suite ?' : 'Quel terme vient ensuite ?';
    return q;
  }

  /** Même logique que pour le numérique : les règles les moins réussies reviennent plus souvent. */
  function pickGen(rng, stats) {
    var w = [], total = 0;
    GENS.forEach(function (g) {
      var s = (stats && stats[g.id]) || { n: 0, ok: 0 };
      var weight = s.n === 0 ? 3 : 1 + 3 * (s.n - s.ok + 1) / (s.n + 2);
      w.push([g.id, weight]); total += weight;
    });
    var x = rng() * total;
    for (var i = 0; i < w.length; i++) { x -= w[i][1]; if (x <= 0) return w[i][0]; }
    return w[w.length - 1][0];
  }

  BP.gen = BP.gen || {};
  BP.gen.abstract = { GENS: GENS, byId: byId, generate: generate, pickGen: pickGen, figureSVG: figureSVG, key: key, ERR_LABELS: ERR_LABELS };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.gen.abstract;
})(typeof self !== 'undefined' ? self : globalThis);
