/* Big4 Prep — fabrique et affichage des questions, tous modules confondus.
   Une question « normalisée » (Q) a toujours la même forme, quel que soit le module :
   { qid, module, kind, lang, prompt, visual, passage, situation, choices, answer, options, explain, shortcut,
     rule, ref, principle, targetSec, g (générateur ou item), srs (id de fiche de révision ou null) }
   kind : choice (QCM texte) | vfn (Vrai/Faux/On ne peut pas savoir) | fig (figures) | terms (suite)
          | sjt-bw (plus / moins efficace) | sjt-rank (classement) */
(function (root) {
  'use strict';
  var BP = root.BP;
  var U = BP.util, SRS = BP.srs, SC = BP.scoring, ST = BP.stats, h = BP.ui ? BP.ui.h : null;
  var NUM = BP.gen.numeric, ABS = BP.gen.abstract;

  var MODULES = {
    numerique: { id: 'numerique', title: 'Raisonnement numérique', short: 'Numérique', icon: '📊', desc: 'Tableaux et graphiques financiers : pourcentages, variations, ratios, devises, croissance. Calculatrice autorisée.', target: 60 },
    verbal: { id: 'verbal', title: 'Raisonnement verbal', short: 'Verbal', icon: '📖', desc: 'Un texte, puis des affirmations à classer Vrai / Faux / On ne peut pas savoir, en jugeant uniquement d\'après le texte.', target: 45 },
    abstrait: { id: 'abstrait', title: 'Raisonnement abstrait', short: 'Abstrait', icon: '🔷', desc: 'Suites de figures, intrus, suites de nombres et de lettres : trouver la règle.', target: 45 },
    sjt: { id: 'sjt', title: 'Mises en situation', short: 'SJT', icon: '🤝', desc: 'Scénarios d\'auditeur junior : choisir ou classer les réponses les plus efficaces au regard des valeurs des Big 4.', target: 90 },
    technique: { id: 'technique', title: 'Connaissances techniques', short: 'Technique', icon: '📚', desc: 'PCG, IFRS, écritures, amortissements, provisions, régularisations, assertions, NEP / ISA.', target: 45 },
    anglais: { id: 'anglais', title: 'Anglais professionnel', short: 'Anglais', icon: '🇬🇧', desc: 'Questions courtes de grammaire, vocabulaire et compréhension, comme dans les tests d\'anglais de recrutement.', target: 30 }
  };
  var ORDER = ['numerique', 'verbal', 'abstrait', 'sjt', 'technique', 'anglais'];

  var VFN_ERR = { 'nsp-manque': '« On ne peut pas savoir » non repéré', 'nsp-exces': '« On ne peut pas savoir » choisi à tort', inversion: 'Vrai et Faux inversés' };
  var SJT_ERR = { meilleure: 'Meilleure réponse mal identifiée', pire: 'Pire réponse mal identifiée', 'les-deux': 'Meilleure et pire réponses mal identifiées', classement: 'Classement éloigné' };

  function errLabel(module, e) {
    if (!e) return '';
    if (module === 'numerique') return NUM.ERR_LABELS[e] || e;
    if (module === 'abstrait') return ABS.ERR_LABELS[e] || e;
    if (module === 'verbal') return VFN_ERR[e] || e;
    if (module === 'sjt') return SJT_ERR[e] || e;
    return THEMES[e] || e;
  }
  var THEMES = {
    principes: 'Principes comptables', ecritures: 'Écritures', regularisations: 'Régularisations', rapprochement: 'Rapprochement bancaire',
    tva: 'TVA', capitaux: 'Capitaux propres', bilan: 'Bilan', stocks: 'Stocks', creances: 'Créances', 'plan-comptes': 'Plan de comptes',
    paie: 'Paie', immobilisations: 'Immobilisations', outils: 'Outils comptables', amortissements: 'Amortissements', provisions: 'Provisions',
    ratios: 'Analyse financière', fiscalite: 'Fiscalité', change: 'Opérations en devises', financement: 'Financement', location: 'Contrats de location',
    subventions: 'Subventions', cdg: 'Contrôle de gestion', materialite: 'Seuil de signification', assertions: 'Assertions d\'audit',
    risque: 'Risque d\'audit', procedures: 'Procédures d\'audit', opinion: 'Opinion d\'audit', cac: 'Commissariat aux comptes',
    'controle-interne': 'Contrôle interne', evenements: 'Événements postérieurs', continuite: 'Continuité d\'exploitation', fraude: 'Fraude',
    ethique: 'Éthique', ifrs: 'IFRS', normes: 'Normes d\'audit', grammaire: 'Grammaire', vocabulaire: 'Vocabulaire', comprehension: 'Compréhension'
  };

  /* ====================== Fabrication ====================== */

  function langFor(pref, i, rng) {
    if (pref === 'fr' || pref === 'en') return pref;
    return i % 2 === 0 ? (rng() < 0.5 ? 'fr' : 'en') : null;
  }

  function fromNumeric(genId, rng, lang, seq) {
    var q = NUM.generate(genId, rng, lang, seq);
    return {
      qid: q.id, module: 'numerique', kind: 'choice', lang: lang, prompt: q.prompt, visual: q.visual,
      choices: q.choices.map(function (c) { return { text: c.text, err: c.err }; }), answer: q.answer,
      explain: q.explain, shortcut: q.shortcut, targetSec: q.targetSec, g: q.gen, title: q.title, srs: null
    };
  }

  function fromAbstract(genId, rng, seq) {
    var q = ABS.generate(genId, rng, seq);
    var kind = q.kind === 'number' || q.kind === 'letter' ? 'terms' : 'fig';
    return {
      qid: q.id, module: 'abstrait', kind: kind, odd: q.kind === 'odd', lang: 'fr', prompt: q.prompt,
      seq: q.seq || null, terms: q.terms || null,
      choices: q.choices.map(function (c) { return c.fig ? { fig: c.fig, err: c.err } : { text: c.text, err: c.err }; }), answer: q.answer,
      rule: q.rule, explain: q.explain, targetSec: q.targetSec, g: q.gen, title: q.title, srs: null
    };
  }

  function fromVerbal(it, passage) {
    var L = BP.content.vfnLabels(it.lang), keys = BP.content.VFN.keys, ans = keys.indexOf(it.answer);
    return {
      qid: it.id + '-' + Math.floor(Math.random() * 1e6), module: 'verbal', kind: 'vfn', lang: it.lang, prompt: it.prompt,
      passage: { id: passage.id, title: passage.title, text: passage.text, lang: passage.lang },
      choices: keys.map(function (k, i) {
        var err = i === ans ? null : (it.answer === 'nsp' ? 'nsp-manque' : k === 'nsp' ? 'nsp-exces' : 'inversion');
        return { text: L[k], key: k, err: err };
      }), answer: ans, explain: [it.explain], targetSec: it.targetSec, g: it.id, srs: null
    };
  }

  function fromItem(it, rng) {
    if (it.module === 'sjt') {
      return {
        qid: it.id + '-' + Math.floor(rng() * 1e6), module: 'sjt', kind: it.type === 'rank' ? 'sjt-rank' : 'sjt-bw', lang: 'fr',
        prompt: it.prompt, situation: it.situation, options: it.options, sjtType: it.type, principle: it.principle,
        explain: [it.explain], targetSec: it.targetSec, g: it.id, srs: it.id, item: it
      };
    }
    var opts = U.shuffle([{ text: it.answers[0], err: null }].concat(it.distractors.map(function (d) { return { text: d, err: it.theme || 'autre' }; })), rng);
    var ans = 0;
    opts.forEach(function (o, i) { if (o.err === null) ans = i; });
    return {
      qid: it.id + '-' + Math.floor(rng() * 1e6), module: it.module, kind: 'choice', lang: it.lang, prompt: it.prompt,
      choices: opts, answer: ans, explain: [it.explain], ref: it.ref, targetSec: it.targetSec, g: it.id, srs: it.id, theme: it.theme
    };
  }

  /** Sélection par répétition espacée : dues d'abord (les plus en retard), puis nouvelles, puis en avance. */
  function pickSRS(items, cards, today, n, rng, filter) {
    var due = [], fresh = [], later = [];
    items.forEach(function (it) {
      if (filter && !filter(it)) return;
      var c = cards[it.id];
      if (SRS.isNew(c)) fresh.push(it); else if (SRS.isDue(c, today)) due.push(it); else later.push(it);
    });
    due = U.shuffle(due, rng).sort(function (a, b) { return cards[a.id].due < cards[b.id].due ? -1 : cards[a.id].due > cards[b.id].due ? 1 : 0; });
    fresh = U.shuffle(fresh, rng);
    later = U.shuffle(later, rng).sort(function (a, b) { return (cards[a.id].last || '') < (cards[b.id].last || '') ? -1 : 1; });
    return due.concat(fresh, later).slice(0, n);
  }

  function countDue(items, cards, today) {
    var n = 0;
    items.forEach(function (it) { if (SRS.isDue(cards[it.id], today)) n++; });
    return n;
  }

  /** Textes du verbal : jamais lus d'abord, puis les plus anciens ; langue selon la préférence. */
  function pickPassages(content, seen, pref, rng, count) {
    var list = Object.keys(content.passages).map(function (k) { return content.passages[k]; });
    if (pref === 'fr' || pref === 'en') list = list.filter(function (p) { return p.lang === pref; });
    list = U.shuffle(list, rng).sort(function (a, b) {
      var sa = seen[a.id] || '', sb = seen[b.id] || '';
      return sa < sb ? -1 : sa > sb ? 1 : 0;
    });
    if (pref === 'mix') { // alterne FR / EN
      var fr = list.filter(function (p) { return p.lang === 'fr'; }), en = list.filter(function (p) { return p.lang === 'en'; }), out = [];
      var first = rng() < 0.5 ? fr : en, second = first === fr ? en : fr;
      for (var i = 0; out.length < count && (i < fr.length || i < en.length); i++) {
        if (first[i]) out.push(first[i]);
        if (second[i] && out.length < count) out.push(second[i]);
      }
      return out.slice(0, count);
    }
    return list.slice(0, count);
  }

  /**
   * File de questions d'un module.
   * ctx : { content, state, today, rng, pref, n, gen (facultatif : un seul générateur), sim (booléen) }
   */
  function buildQueue(module, ctx) {
    var rng = ctx.rng, n = ctx.n, out = [], i, seq = Date.now() % 1e6;
    var log = ctx.state.log;
    if (module === 'numerique') {
      var gs = ST.genStats(log, 'numerique'), recent = [];
      for (i = 0; i < n; i++) {
        var g = ctx.gen || NUM.pickGen(rng, ctx.sim ? null : gs, recent.slice(-3));
        recent.push(g);
        var lang = ctx.pref === 'fr' || ctx.pref === 'en' ? ctx.pref : (i % 2 ? 'en' : 'fr');
        out.push(fromNumeric(g, rng, lang, seq + i));
      }
    } else if (module === 'abstrait') {
      var as = ST.genStats(log, 'abstrait'), last = null;
      for (i = 0; i < n; i++) {
        var a = ctx.gen;
        if (!a) { do { a = ABS.pickGen(rng, ctx.sim ? null : as); } while (a === last && ABS.GENS.length > 1); }
        last = a;
        out.push(fromAbstract(a, rng, seq + i));
      }
    } else if (module === 'verbal') {
      var ps = pickPassages(ctx.content, ctx.state.seenPassages || {}, ctx.pref, rng, Math.ceil(n / 3) + 2);
      for (i = 0; i < ps.length && out.length < n; i++) {
        var p = ps[i];
        p.statements.forEach(function (st) {
          if (out.length < n) out.push(fromVerbal(ctx.content.byId[st.id], p));
        });
      }
    } else {
      var items = ctx.content.items.filter(function (it) { return it.module === module; });
      var chosen = pickSRS(items, ctx.state.cards, ctx.today, n, rng, ctx.filter);
      if (module === 'technique' && !ctx.sim) chosen = U.shuffle(chosen, rng);
      out = chosen.map(function (it) { return fromItem(it, rng); });
    }
    return out;
  }

  /* ====================== Notation ====================== */

  /** Évalue une réponse. Renvoie { points (0..1 ou null si passée), result, err, detail } */
  function evaluate(Q, resp) {
    if (!resp) return { points: null, result: 'skipped', err: null };
    if (Q.kind === 'sjt-bw' || Q.kind === 'sjt-rank') {
      var s = SC.scoreSJT(Q.item || { type: Q.sjtType, options: Q.options }, resp);
      var err = null;
      if (Q.kind === 'sjt-bw' && s.points < 1) err = !s.bestOk && !s.worstOk ? 'les-deux' : !s.bestOk ? 'meilleure' : 'pire';
      if (Q.kind === 'sjt-rank' && s.result === 'wrong') err = 'classement';
      return { points: s.points, result: s.result, err: err, detail: s };
    }
    var ok = resp.idx === Q.answer;
    var ch = Q.choices[resp.idx];
    return { points: ok ? 1 : 0, result: ok ? 'correct' : 'wrong', err: ok ? null : (ch ? ch.err : 'autre') };
  }

  function isComplete(Q, resp) {
    if (!resp) return false;
    if (Q.kind === 'sjt-bw') return resp.best != null && resp.worst != null && resp.best !== resp.worst;
    if (Q.kind === 'sjt-rank') return resp.order && resp.order.length === Q.options.length;
    return resp.idx != null;
  }

  /* ====================== Affichage ====================== */

  function visualEl(v) {
    if (!v) return null;
    if (v.kind === 'table') {
      return h('div', { class: 'table-wrap' }, h('table', { class: 'data-table' }, [
        v.title ? h('caption', { text: v.title }) : null,
        h('thead', {}, h('tr', {}, v.head.map(function (c) { return h('th', { scope: 'col', text: c }); }))),
        h('tbody', {}, v.rows.map(function (r) { return h('tr', {}, r.map(function (c, i) { return i === 0 ? h('th', { scope: 'row', text: c }) : h('td', { text: c }); })); }))
      ]));
    }
    if (v.kind === 'chart') return h('figure', { class: 'chart-card', html: BP.chart.chartSVG(v.spec) });
    return null;
  }

  var LETTERS = 'ABCDE';

  /**
   * Construit la zone de réponse. opts.onChange(resp) est appelé à chaque modification.
   * Renvoie { el, response(), lock() }
   */
  function renderQuestion(Q, opts) {
    opts = opts || {};
    var resp = null, buttons = [], locked = false;
    function changed() { if (opts.onChange) opts.onChange(resp); }
    var parts = [];

    if (Q.passage) {
      parts.push(h('div', { class: 'passage' + (Q.passage.lang === 'en' ? ' en' : ''), lang: Q.passage.lang }, [
        h('h3', { text: Q.passage.title }), h('p', { text: Q.passage.text })
      ]));
      parts.push(h('p', { class: 'statement' + (Q.lang === 'en' ? ' en' : ''), lang: Q.lang, text: Q.prompt }));
    } else if (Q.situation) {
      parts.push(h('div', { class: 'sjt-situation', text: Q.situation }));
      parts.push(h('p', { class: 'q-prompt', text: Q.prompt }));
    } else {
      parts.push(h('p', { class: 'q-prompt' + (Q.lang === 'en' ? ' en' : ''), lang: Q.lang, text: Q.prompt }));
      if (Q.visual) parts.push(visualEl(Q.visual));
      if (Q.seq) {
        parts.push(h('div', { class: 'seq', role: 'img', 'aria-label': 'Suite de figures' }, Q.seq.map(function (f, i) {
          return h('div', { class: 'seq-cell', html: ABS.figureSVG(f, 'Figure ' + (i + 1)) });
        }).concat([h('div', { class: 'seq-cell seq-q', text: '?' })])));
      }
      if (Q.terms) parts.push(h('div', { class: 'terms' }, Q.terms.map(function (t) { return h('span', { text: String(t) }); }).concat([h('span', { class: 't-q', text: '?' })])));
    }

    function select(i) {
      if (locked) return;
      resp = { idx: i };
      buttons.forEach(function (b, k) { b.setAttribute('aria-pressed', String(k === i)); });
      changed();
    }

    if (Q.kind === 'vfn') {
      parts.push(h('div', { class: 'vfn' }, Q.choices.map(function (c, i) {
        var b = h('button', { class: 'choice', type: 'button', 'aria-pressed': 'false', 'data-key': c.key, onclick: function () { select(i); } }, c.text);
        buttons.push(b); return b;
      })));
    } else if (Q.kind === 'fig') {
      parts.push(h('div', { class: 'fig-choices' }, Q.choices.map(function (c, i) {
        var b = h('button', { class: 'fig-choice', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Proposition ' + LETTERS.charAt(i), onclick: function () { select(i); } }, [
          h('span', { html: ABS.figureSVG(c.fig, 'Proposition ' + LETTERS.charAt(i)) }), h('span', { class: 'fig-label', text: LETTERS.charAt(i) })
        ]);
        buttons.push(b); return b;
      })));
    } else if (Q.kind === 'choice' || Q.kind === 'terms') {
      parts.push(h('div', { class: 'choices' }, Q.choices.map(function (c, i) {
        var b = h('button', { class: 'choice' + (Q.lang === 'en' ? ' en' : ''), type: 'button', 'aria-pressed': 'false', onclick: function () { select(i); } }, [
          h('span', { class: 'choice-letter', text: LETTERS.charAt(i) }), h('span', { text: c.text })
        ]);
        buttons.push(b); return b;
      })));
    } else if (Q.kind === 'sjt-bw') {
      resp = { best: null, worst: null };
      var rows = Q.options.map(function (o, i) {
        var best = h('button', { class: 'sjt-mark best', type: 'button', 'aria-pressed': 'false', onclick: function () { mark('best', i); } }, 'Plus efficace');
        var worst = h('button', { class: 'sjt-mark worst', type: 'button', 'aria-pressed': 'false', onclick: function () { mark('worst', i); } }, 'Moins efficace');
        var row = h('div', { class: 'sjt-opt' }, [h('p', { class: 'sjt-opt-text' }, [h('strong', { text: LETTERS.charAt(i) + '. ' }), o.t]), h('div', { class: 'sjt-marks' }, [best, worst])]);
        return { row: row, best: best, worst: worst };
      });
      function mark(kind, i) {
        if (locked) return;
        resp[kind] = resp[kind] === i ? null : i;
        var other = kind === 'best' ? 'worst' : 'best';
        if (resp[other] === i) resp[other] = null;
        rows.forEach(function (r, k) {
          r.best.setAttribute('aria-pressed', String(resp.best === k));
          r.worst.setAttribute('aria-pressed', String(resp.worst === k));
          r.row.className = 'sjt-opt' + (resp.best === k ? ' is-best' : resp.worst === k ? ' is-worst' : '');
        });
        changed();
      }
      parts.push(h('div', { class: 'choices' }, rows.map(function (r) { return r.row; })));
    } else if (Q.kind === 'sjt-rank') {
      resp = { order: [] };
      var badges = [], rbtns = [];
      var reset = h('button', { class: 'link', type: 'button', onclick: function () { if (locked) return; resp.order = []; paint(); changed(); } }, 'Recommencer le classement');
      function paint() {
        badges.forEach(function (b, k) {
          var pos = resp.order.indexOf(k);
          b.textContent = pos === -1 ? '' : String(pos + 1);
          b.className = 'rank-badge' + (pos === -1 ? '' : ' is-set');
          rbtns[k].setAttribute('aria-pressed', String(pos !== -1));
        });
      }
      parts.push(h('p', { class: 'q-sub', text: 'Touchez les réponses dans l\'ordre, de la plus efficace (1) à la moins efficace (4).' }));
      parts.push(h('div', { class: 'choices' }, Q.options.map(function (o, i) {
        var badge = h('span', { class: 'rank-badge' });
        badges.push(badge);
        var b = h('button', { class: 'choice rank-btn', type: 'button', 'aria-pressed': 'false', onclick: function () {
          if (locked) return;
          var pos = resp.order.indexOf(i);
          if (pos === -1) resp.order.push(i); else resp.order.splice(pos, 1);
          paint(); changed();
        } }, [badge, h('span', {}, [h('strong', { text: LETTERS.charAt(i) + '. ' }), o.t])]);
        rbtns.push(b); return b;
      })));
      parts.push(reset);
    }

    var el = h('div', { class: 'ex' }, parts);
    return {
      el: el,
      response: function () { return isComplete(Q, resp) ? JSON.parse(JSON.stringify(resp)) : null; },
      lock: function (ev) {
        locked = true;
        if (Q.kind === 'sjt-bw' || Q.kind === 'sjt-rank') return;
        buttons.forEach(function (b, k) {
          b.disabled = true;
          if (k === Q.answer) b.classList.add('is-right');
          else if (resp && resp.idx === k) b.classList.add('is-wrong');
        });
      }
    };
  }

  function fmtSec(ms) { return Math.round(ms / 1000) + ' s'; }

  /** Correction détaillée affichée après la réponse (entraînement) ou dans le bilan (simulation). */
  function feedbackBody(Q, resp, ev, ms) {
    var out = [];
    if (Q.kind === 'sjt-bw' || Q.kind === 'sjt-rank') {
      var order = SC.sjtOrder({ options: Q.options });
      out.push(h('p', { class: 'fb-label', text: Q.kind === 'sjt-bw'
        ? 'Plus efficace : ' + LETTERS.charAt(order[0]) + ' — moins efficace : ' + LETTERS.charAt(order[order.length - 1])
        : 'Classement attendu : ' + order.map(function (i) { return LETTERS.charAt(i); }).join(' > ') }));
      out.push(h('ul', { class: 'fb-opts' }, order.map(function (i) {
        var o = Q.options[i];
        return h('li', {}, [h('strong', { text: LETTERS.charAt(i) + ' — efficacité ' + o.score + '/4' }), o.why]);
      })));
      out.push(h('p', { class: 'fb-tip' }, [h('strong', { text: 'Principe : ' }), Q.principle + '. ' + Q.explain[0]]));
    } else {
      var right = Q.choices[Q.answer];
      if (right && (right.text != null)) out.push(h('p', { class: 'fb-answer' }, [h('span', { class: 'answer-line', text: 'Réponse : ' + right.text })]));
      else if (right && right.fig) out.push(h('p', { class: 'fb-answer' }, [h('span', { class: 'answer-line', text: 'Réponse : ' + LETTERS.charAt(Q.answer) })]));
      if (Q.rule) out.push(h('p', { class: 'fb-explain' }, [h('strong', { text: 'Règle : ' }), Q.rule]));
      if (Q.explain && Q.explain.length > 1) out.push(h('ol', { class: 'fb-steps' }, Q.explain.map(function (s) { return h('li', { text: s }); })));
      else if (Q.explain) out.push(h('p', { class: 'fb-explain', text: Q.explain[0] }));
      if (Q.shortcut) out.push(h('p', { class: 'fb-tip' }, [h('strong', { text: 'Raccourci : ' }), Q.shortcut]));
      if (Q.ref) out.push(h('p', { class: 'fb-ref', text: 'Référence : ' + Q.ref }));
    }
    if (ev && ev.err && ev.points < 1) out.push(h('p', { class: 'fb-err', text: 'Type d\'erreur : ' + errLabel(Q.module, ev.err) }));
    if (ms != null) {
      var over = ms > Q.targetSec * 1000;
      out.push(h('p', { class: 'fb-time', text: 'Temps : ' + fmtSec(ms) + ' (cible ' + Q.targetSec + ' s)' + (over ? ' — trop lent pour le test réel.' : '.') }));
    }
    return out;
  }

  /** Résumé d'une question pour la liste de revue d'un bilan. */
  function shortLabel(Q) {
    var t = Q.kind === 'vfn' ? Q.prompt : Q.situation ? Q.situation : Q.prompt;
    if (Q.title && (Q.module === 'numerique' || Q.module === 'abstrait')) t = Q.title + ' — ' + (Q.module === 'abstrait' ? Q.prompt : Q.prompt);
    return t.length > 110 ? t.slice(0, 107) + '…' : t;
  }

  BP.q = {
    MODULES: MODULES, ORDER: ORDER, THEMES: THEMES, errLabel: errLabel, buildQueue: buildQueue, pickSRS: pickSRS, countDue: countDue,
    fromNumeric: fromNumeric, fromAbstract: fromAbstract, fromVerbal: fromVerbal, fromItem: fromItem,
    evaluate: evaluate, isComplete: isComplete, renderQuestion: renderQuestion, feedbackBody: feedbackBody, visualEl: visualEl, shortLabel: shortLabel, LETTERS: LETTERS
  };
})(typeof self !== 'undefined' ? self : globalThis);
