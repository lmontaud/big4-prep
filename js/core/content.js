/* Big4 Prep — contenu rédigé : chargement, mise à plat et validation.
   Fichiers JSON (un par module, voir content/index.json) :
   - verbal    : { module, passages: [{ id, lang, title, text, difficulty, statements: [{ id, s, answer: vrai|faux|nsp, why }] }] }
   - sjt       : { module, items: [{ id, lang, type: best-worst|rank, theme, situation, question, options: [{ t, score 1..4, why }], principle, explain, difficulty, time }] }
   - technique : { module, items: [{ id, lang, type: qcm|calcul, theme, q, answer, distractors: [3], explain, ref, difficulty, time }] }
   - anglais   : même format que technique
   - fiches    : { module: 'fiches', fiches: [{ id, title, icon, intro, sections: [{ h, p: [..] }] }] }
   Chaque item mis à plat porte : id, module, lang, type, prompt, answers, distractors, explain, difficulty, targetSec. */
(function (root) {
  'use strict';
  var BP = root.BP = root.BP || {};

  var VFN = {
    keys: ['vrai', 'faux', 'nsp'],
    fr: { vrai: 'Vrai', faux: 'Faux', nsp: 'On ne peut pas savoir' },
    en: { vrai: 'True', faux: 'False', nsp: 'Cannot say' }
  };
  var LANGS = ['fr', 'en'];

  /** Met à plat les fichiers chargés. Renvoie { items, byId, passages, fiches, errors }. */
  function install(files) {
    var out = { items: [], byId: {}, passages: {}, fiches: [], errors: [] };
    function add(it) {
      if (out.byId[it.id]) { out.errors.push('Identifiant en double : ' + it.id); return; }
      out.items.push(it); out.byId[it.id] = it;
    }
    (files || []).forEach(function (f) {
      if (!f || typeof f !== 'object') return;
      if (f.module === 'verbal') {
        (f.passages || []).forEach(function (p) {
          out.passages[p.id] = p;
          (p.statements || []).forEach(function (st) {
            var labels = VFN[p.lang] || VFN.fr;
            add({
              id: st.id, module: 'verbal', lang: p.lang, type: 'vfn', passage: p.id, prompt: st.s,
              answer: st.answer, answers: [labels[st.answer]],
              distractors: VFN.keys.filter(function (k) { return k !== st.answer; }).map(function (k) { return labels[k]; }),
              explain: st.why, difficulty: st.difficulty || p.difficulty || 2, targetSec: st.time || 45
            });
          });
        });
      } else if (f.module === 'sjt') {
        (f.items || []).forEach(function (it) {
          var order = it.options ? it.options.map(function (o, i) { return i; }).sort(function (a, b) { return it.options[b].score - it.options[a].score; }) : [];
          add({
            id: it.id, module: 'sjt', lang: it.lang || 'fr', type: it.type, theme: it.theme, situation: it.situation,
            prompt: it.question, options: it.options, principle: it.principle, explain: it.explain,
            answers: order.length ? [it.options[order[0]].t] : [], distractors: order.slice(1).map(function (i) { return it.options[i].t; }),
            difficulty: it.difficulty || 2, targetSec: it.time || 90
          });
        });
      } else if (f.module === 'technique' || f.module === 'anglais') {
        (f.items || []).forEach(function (it) {
          add({
            id: it.id, module: f.module, lang: it.lang || (f.module === 'anglais' ? 'en' : 'fr'), type: it.type || 'qcm', theme: it.theme,
            prompt: it.q, answers: [it.answer], distractors: it.distractors, explain: it.explain, ref: it.ref || '',
            difficulty: it.difficulty || 2, targetSec: it.time || 45
          });
        });
      } else if (f.module === 'fiches') {
        out.fiches = out.fiches.concat(f.fiches || []);
      }
    });
    return out;
  }

  function norm(s) { return String(s).trim().toLowerCase().replace(/\s+/g, ' '); }

  /** Vérifie un item mis à plat. Renvoie la liste des problèmes (vide si l'item est valide). */
  function validateItem(it, passages) {
    var e = [];
    function need(cond, msg) { if (!cond) e.push(it.id + ' : ' + msg); }
    need(typeof it.id === 'string' && it.id.length > 1, 'id manquant');
    need(['verbal', 'sjt', 'technique', 'anglais'].indexOf(it.module) !== -1, 'module inconnu');
    need(LANGS.indexOf(it.lang) !== -1, 'langue inconnue');
    need(typeof it.prompt === 'string' && it.prompt.trim().length > 5, 'énoncé manquant');
    need(typeof it.explain === 'string' && it.explain.trim().length > 10, 'explication manquante');
    need([1, 2, 3].indexOf(it.difficulty) !== -1, 'difficulté hors 1-3');
    need(typeof it.targetSec === 'number' && it.targetSec >= 10 && it.targetSec <= 300, 'temps cible invalide');
    need(Array.isArray(it.answers) && it.answers.length === 1, 'il faut exactement une bonne réponse');
    need(Array.isArray(it.distractors) && it.distractors.length >= 2, 'distracteurs insuffisants');
    if (Array.isArray(it.answers) && Array.isArray(it.distractors)) {
      var all = it.answers.concat(it.distractors).map(norm), uniq = {};
      all.forEach(function (x) { uniq[x] = 1; });
      need(Object.keys(uniq).length === all.length, 'propositions en double (ou bonne réponse répétée dans les distracteurs)');
      need(all.every(function (x) { return x.length > 0; }), 'proposition vide');
    }
    if (it.module === 'verbal') {
      need(VFN.keys.indexOf(it.answer) !== -1, 'réponse vrai/faux/nsp attendue');
      need(passages && passages[it.passage] && passages[it.passage].text && passages[it.passage].text.length > 200, 'texte support manquant ou trop court');
    }
    if (it.module === 'sjt') {
      need(['best-worst', 'rank'].indexOf(it.type) !== -1, 'type SJT inconnu');
      need(Array.isArray(it.options) && it.options.length === 4, '4 réponses attendues');
      if (Array.isArray(it.options)) {
        var scores = it.options.map(function (o) { return o.score; }).sort();
        need(scores.join(',') === '1,2,3,4', 'scores d\'efficacité 1 à 4 attendus, chacun une fois');
        need(it.options.every(function (o) { return typeof o.why === 'string' && o.why.length > 15; }), 'chaque réponse doit être justifiée');
      }
      need(typeof it.situation === 'string' && it.situation.length > 60, 'situation trop courte');
      need(typeof it.principle === 'string' && it.principle.length > 3, 'principe manquant');
    }
    if (it.module === 'technique') {
      need(['qcm', 'calcul'].indexOf(it.type) !== -1, 'type technique inconnu');
      need(typeof it.ref === 'string' && it.ref.length > 2, 'référence comptable manquante');
      need(it.distractors && it.distractors.length === 3, '3 distracteurs attendus');
    }
    return e;
  }

  /** Libellés Vrai / Faux / On ne peut pas savoir selon la langue. */
  function vfnLabels(lang) { return VFN[lang] || VFN.fr; }

  BP.content = { VFN: VFN, install: install, validateItem: validateItem, vfnLabels: vfnLabels };
  if (typeof module !== 'undefined' && module.exports) module.exports = BP.content;
})(typeof self !== 'undefined' ? self : globalThis);
