/* Big4 Prep — mini-jeux de familiarisation (inspirés des compétences mesurées par les tests « jeux »).
   Ils ne reproduisent aucun test réel. Chaque jeu : start(zone, fin) et renvoie une fonction d'arrêt. */
(function (root) {
  'use strict';
  var BP = root.BP;
  var h = BP.ui.h, U = BP.util;

  var GAMES = [
    { id: 'memoire', title: 'Mémoire de séquence', icon: '🧠', skill: 'Mémoire de travail', desc: 'Des cases s\'allument l\'une après l\'autre : touchez-les dans le même ordre. La séquence s\'allonge à chaque réussite ; deux erreurs terminent la partie.' },
    { id: 'attention', title: 'Attention sélective', icon: '🎯', skill: 'Attention et rapidité', desc: 'Des formes apparaissent une à une. Touchez « Cible ! » uniquement pour le cercle plein, le plus vite possible. Ignorez les autres formes.' },
    { id: 'risque', title: 'Risque mesuré', icon: '🎈', skill: 'Prise de risque mesurée', desc: 'Chaque gonflage ajoute 5 points au ballon, mais il peut éclater et vous perdez alors les points du ballon. Encaissez quand vous voulez. 10 ballons.' }
  ];

  function wait(ms, timers) { return new Promise(function (r) { timers.push(setTimeout(r, ms)); }); }

  /* ---------- Mémoire de séquence ---------- */
  function memoire(zone, done) {
    var timers = [], stopped = false, len = 3, errors = 0, best = 0, seq = [], input = [], accepting = false;
    var cells = [];
    var info = h('p', { class: 'game-score', text: 'Regardez la séquence…' });
    var grid = h('div', { class: 'game-grid' });
    for (var i = 0; i < 9; i++) {
      (function (k) {
        var c = h('button', { class: 'game-cell', type: 'button', 'aria-label': 'Case ' + (k + 1), onclick: function () { tap(k); } });
        cells.push(c); grid.appendChild(c);
      })(i);
    }
    zone.appendChild(info); zone.appendChild(grid);
    function lit(k, cls, ms) {
      cells[k].classList.add(cls);
      return wait(ms, timers).then(function () { cells[k].classList.remove(cls); });
    }
    function round() {
      if (stopped) return;
      accepting = false; input = [];
      info.textContent = 'Séquence de ' + len + ' cases : regardez…';
      seq = [];
      for (var j = 0; j < len; j++) { var n; do { n = U.randInt(Math.random, 0, 8); } while (j && n === seq[j - 1]); seq.push(n); }
      var p = wait(500, timers);
      seq.forEach(function (k) { p = p.then(function () { return lit(k, 'is-lit', 550); }).then(function () { return wait(180, timers); }); });
      p.then(function () { if (!stopped) { accepting = true; info.textContent = 'À vous : ' + len + ' cases'; } });
    }
    function tap(k) {
      if (!accepting || stopped) return;
      var pos = input.length;
      input.push(k);
      if (seq[pos] !== k) {
        accepting = false; errors++;
        lit(k, 'is-ko', 400);
        if (errors >= 2) { finish(); return; }
        info.textContent = 'Raté. Encore une chance à ' + len + ' cases.';
        wait(1000, timers).then(round);
        return;
      }
      lit(k, 'is-ok', 200);
      if (input.length === seq.length) {
        accepting = false; best = Math.max(best, len); len++;
        info.textContent = 'Bravo !';
        wait(800, timers).then(round);
      }
    }
    function finish() {
      stopped = true;
      done({ score: best, text: 'Séquence la plus longue réussie : ' + best + ' cases.', tip: 'La plupart des adultes retiennent 5 à 7 éléments. Regrouper la séquence en petits blocs (2 + 3) aide à en retenir davantage.' });
    }
    round();
    return function () { stopped = true; timers.forEach(clearTimeout); };
  }

  /* ---------- Attention sélective ---------- */
  var SHAPES = {
    target: '<svg viewBox="0 0 100 100" class="game-symbol"><circle cx="50" cy="50" r="38" class="fig-black"/></svg>',
    ring: '<svg viewBox="0 0 100 100" class="game-symbol"><circle cx="50" cy="50" r="38" class="fig-white"/></svg>',
    square: '<svg viewBox="0 0 100 100" class="game-symbol"><rect x="14" y="14" width="72" height="72" class="fig-black"/></svg>',
    tri: '<svg viewBox="0 0 100 100" class="game-symbol"><polygon points="50,10 90,85 10,85" class="fig-black"/></svg>'
  };
  function attention(zone, done) {
    var timers = [], stopped = false, trial = 0, N = 30, hits = 0, misses = 0, fa = 0, rts = [], current = null, shownAt = 0, answered = false;
    var stage = h('div', { class: 'game-stage', 'aria-live': 'polite' });
    var info = h('p', { class: 'game-score', text: 'Prêt…' });
    var btn = h('button', { class: 'btn btn-primary btn-block btn-hero', type: 'button', onclick: press }, 'Cible !');
    zone.appendChild(info); zone.appendChild(stage); zone.appendChild(btn);
    function press() {
      if (stopped || !current || answered) return;
      answered = true;
      if (current === 'target') { hits++; rts.push(Date.now() - shownAt); stage.style.outline = '3px solid var(--good)'; }
      else { fa++; stage.style.outline = '3px solid var(--bad)'; }
    }
    function next() {
      if (stopped) return;
      if (current === 'target' && !answered) misses++;
      stage.style.outline = '';
      if (trial >= N) return finish();
      trial++;
      current = Math.random() < 0.35 ? 'target' : U.pick(Math.random, ['ring', 'square', 'tri']);
      answered = false;
      stage.innerHTML = SHAPES[current];
      shownAt = Date.now();
      info.textContent = trial + ' / ' + N;
      timers.push(setTimeout(function () { stage.innerHTML = ''; current = current; timers.push(setTimeout(next, 250 + Math.random() * 300)); }, 750));
    }
    function finish() {
      stopped = true;
      var avg = rts.length ? Math.round(rts.reduce(function (s, x) { return s + x; }, 0) / rts.length) : 0;
      done({ score: hits, text: hits + ' cibles touchées, ' + misses + ' manquées, ' + fa + ' fausses alertes. Temps de réaction moyen : ' + avg + ' ms.', tip: 'Ces jeux observent l\'équilibre entre vitesse et précision : mieux vaut quelques millisecondes de plus que des fausses alertes.' });
    }
    timers.push(setTimeout(next, 900));
    return function () { stopped = true; timers.forEach(clearTimeout); };
  }

  /* ---------- Risque mesuré ---------- */
  function risque(zone, done) {
    var round = 0, N = 10, bank = 0, pot = 0, pumps = 0, burstAt = 0, stopped = false, bursts = 0, pumpsTotal = 0;
    var info = h('p', { class: 'game-score' });
    var balloon = h('div', { class: 'balloon', 'aria-live': 'polite' });
    var stage = h('div', { class: 'game-stage' }, balloon);
    var pump = h('button', { class: 'btn btn-primary', type: 'button', onclick: doPump }, 'Gonfler (+5)');
    var cash = h('button', { class: 'btn btn-soft', type: 'button', onclick: doCash }, 'Encaisser');
    zone.appendChild(info); zone.appendChild(stage); zone.appendChild(h('div', { class: 'grid-2' }, [pump, cash]));
    function newRound() {
      round++; pot = 0; pumps = 0; burstAt = U.randInt(Math.random, 1, 20);
      balloon.className = 'balloon'; balloon.style.transform = 'scale(1)';
      pump.disabled = false; cash.disabled = false;
      paint();
    }
    function paint() {
      info.textContent = 'Ballon ' + round + ' / ' + N + ' — banque : ' + bank + ' pts';
      balloon.textContent = pot + ' pts';
    }
    function doPump() {
      if (stopped) return;
      pumps++; pumpsTotal++;
      if (pumps >= burstAt) {
        bursts++; pot = 0; balloon.className = 'balloon is-burst'; balloon.textContent = 'Éclaté !';
        pump.disabled = true; cash.disabled = true;
        setTimeout(endRound, 900);
        return;
      }
      pot += 5; balloon.style.transform = 'scale(' + (1 + pumps * 0.03) + ')';
      paint();
    }
    function doCash() { if (stopped) return; bank += pot; pot = 0; endRound(); }
    function endRound() {
      if (stopped) return;
      if (round >= N) {
        stopped = true;
        done({ score: bank, text: 'Total encaissé : ' + bank + ' points, ' + bursts + ' ballon(s) éclaté(s), ' + (pumpsTotal / N).toFixed(1).replace('.', ',') + ' gonflages en moyenne.', tip: 'Ici, chaque ballon éclate au hasard entre le 1er et le 20e gonflage. L\'espérance de gain est maximale autour de 10 gonflages : au-delà, le risque de tout perdre l\'emporte. Ces jeux observent la cohérence de votre prise de risque plus que le score.' });
        return;
      }
      newRound();
    }
    newRound();
    return function () { stopped = true; };
  }

  var RUN = { memoire: memoire, attention: attention, risque: risque };

  BP.games = { GAMES: GAMES, start: function (id, zone, done) { return RUN[id](zone, done); } };
})(typeof self !== 'undefined' ? self : globalThis);
