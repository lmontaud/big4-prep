/* Big4 Prep — tests automatisés de la logique, des générateurs et du contenu.
   Lancement : node tests/run-tests.js   (aucune dépendance, Node 18 ou plus récent) */
'use strict';
const fs = require('fs');
const path = require('path');
const assert = require('assert');

const ROOT = path.join(__dirname, '..');
['util', 'srs', 'timer', 'calc', 'game', 'content', 'store', 'merge', 'scoring', 'stats', 'plan', 'reminder', 'chart'].forEach(function (m) {
  require(path.join(ROOT, 'js', 'core', m + '.js'));
});
['common', 'numeric', 'abstract'].forEach(function (m) { require(path.join(ROOT, 'js', 'gen', m + '.js')); });
require(path.join(ROOT, 'js', 'sync.js'));
require(path.join(ROOT, 'js', 'questions.js'));
const BP = globalThis.BP;
const { util: U, srs: SRS, timer: TM, calc: CALC, game: G, content: C, store: ST, merge: MG, scoring: SC, stats: STATS, plan: PL, reminder: R, chart: CH, syncCore: SY, q: Q } = BP;
const NUM = BP.gen.numeric, ABS = BP.gen.abstract;

let passed = 0, failed = 0;
const failures = [];
let currentGroup = '';
function group(name) { currentGroup = name; console.log('\n' + name); }
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (err) { failed++; failures.push(currentGroup + ' › ' + name + '\n      ' + err.message); console.log('  ✗ ' + name + '\n      ' + err.message); }
}
async function atest(name, fn) {
  try { await fn(); passed++; console.log('  ✓ ' + name); }
  catch (err) { failed++; failures.push(currentGroup + ' › ' + name + '\n      ' + err.message); console.log('  ✗ ' + name + '\n      ' + err.message); }
}
const eq = assert.strictEqual, deq = assert.deepStrictEqual, ok = assert.ok;
function ms(y, m, d, h, min) { return new Date(y, m - 1, d, h || 0, min || 0, 0, 0).getTime(); }
function fresh() { return ST.defaultState(ms(2026, 1, 1, 8)); }
function memStorage() { const m = {}; return { getItem: (k) => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); }, removeItem: (k) => { delete m[k]; }, _m: m }; }
/** Lit un nombre affiché (fr ou en) : « 1 234,5 % », « €1,234.5k », « −3,2 % ». */
function parseShown(t, lang) {
  let s = String(t).replace(/−/g, '-').replace(/[^\d,.\-+]/g, '');
  if (lang === 'en') s = s.replace(/,/g, ''); else s = s.replace(/\./g, '').replace(',', '.');
  return parseFloat(s);
}

/* ---------- Contenu ---------- */
const index = JSON.parse(fs.readFileSync(path.join(ROOT, 'content', 'index.json'), 'utf8'));
const files = index.files.map((f) => JSON.parse(fs.readFileSync(path.join(ROOT, 'content', f), 'utf8')));
const content = C.install(files);

/* ====================================================================== */
group('Dates et formats');
test('dayKey, addDays, diffDays (y compris changement d\'heure)', function () {
  eq(U.dayKey(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  eq(U.addDays('2026-01-31', 1), '2026-02-01');
  eq(U.addDays('2024-02-28', 1), '2024-02-29');
  eq(U.diffDays('2026-03-28', '2026-03-30'), 2);
  eq(U.diffDays('2026-10-24', '2026-10-26'), 2);
});
test('fmtNum : français (espace fine, virgule) et anglais', function () {
  eq(U.fmtNum(1234567.456, 'fr', 2), '1 234 567,46');
  eq(U.fmtNum(1234.5, 'en', 1), '1,234.5');
  eq(U.fmtNum(-12.34, 'fr', 1), '−12,3');
  eq(U.fmtNum(-0.004, 'fr', 2), '0,00');
  eq(U.fmtNum(1.005, 'en', 2), '1.01');
});

/* ====================================================================== */
group('Générateurs numériques (100 tirages par générateur et par langue)');
test('au moins 25 générateurs, identifiants uniques', function () {
  ok(NUM.GENS.length >= 25, NUM.GENS.length + ' générateurs');
  eq(new Set(NUM.GENS.map((g) => g.id)).size, NUM.GENS.length);
});
NUM.GENS.forEach(function (g) {
  test(g.id + ' — ' + g.title, function () {
    for (let i = 0; i < 100; i++) {
      ['fr', 'en'].forEach(function (lang) {
        const rng = U.mulberry32(i * 7919 + g.id.charCodeAt(1) * 31 + g.id.charCodeAt(2) + (lang === 'en' ? 17 : 0));
        const q = NUM.generate(g.id, rng, lang, i);
        const where = ' (tirage ' + i + ', ' + lang + ')';
        ok(q.choices.length >= 4 && q.choices.length <= 5, 'nombre de propositions' + where);
        ok(q.answer >= 0 && q.answer < q.choices.length, 'indice de réponse' + where);
        eq(q.choices.filter((c) => c.err === null).length, 1, 'une seule bonne réponse' + where);
        eq(q.choices[q.answer].err, null, 'la bonne réponse n\'a pas de type d\'erreur' + where);
        const texts = q.choices.map((c) => c.text);
        eq(new Set(texts).size, texts.length, 'propositions toutes différentes : ' + texts.join(' | ') + where);
        ok(isFinite(q.value), 'réponse finie (pas de division par zéro)' + where);
        q.choices.forEach((c) => ok(isFinite(c.value), 'distracteur fini' + where));
        ok(q.value >= g.range[0] && q.value <= g.range[1], 'valeur réaliste ' + q.value + ' hors de [' + g.range + ']' + where);
        if (g.kind !== 'label') eq(q.choices[q.answer].value, q.value, 'la proposition juste porte la valeur calculée' + where);
        const blob = JSON.stringify(q);
        ok(!/NaN|undefined|Infinity|\[object/.test(blob), 'texte sans NaN/undefined' + where);
        ok(q.prompt.length > 20 && q.explain.length >= 1 && q.shortcut.length > 10, 'énoncé, explication et raccourci' + where);
        ok(q.explain.every((s) => !/[A-Za-z]{3,} [a-z]+ the /.test(s)), 'explication en français' + where);
      });
    }
  });
});
test('contre-calcul indépendant : N01 (variation lue dans le tableau)', function () {
  for (let i = 0; i < 100; i++) {
    const q = NUM.generate('N01', U.mulberry32(500 + i), 'fr', i);
    const region = q.prompt.match(/région (.+) entre/)[1];
    const row = q.visual.rows.find((r) => r[0] === region);
    const a = parseShown(row[1], 'fr'), b = parseShown(row[2], 'fr');
    const expect = (b - a) / a * 100;
    ok(Math.abs(parseShown(q.choices[q.answer].text, 'fr') - expect) < 0.051, 'N01 ' + q.choices[q.answer].text + ' vs ' + expect);
  }
});
test('contre-calcul indépendant : N03 (part dans le total)', function () {
  for (let i = 0; i < 100; i++) {
    const q = NUM.generate('N03', U.mulberry32(900 + i), 'en', i);
    const region = q.prompt.match(/did (.+) account/)[1];
    const total = q.visual.rows.reduce((s, r) => s + parseShown(r[2], 'en'), 0);
    const v = parseShown(q.visual.rows.find((r) => r[0] === region)[2], 'en');
    ok(Math.abs(parseShown(q.choices[q.answer].text, 'en') - v / total * 100) < 0.051);
  }
});
test('contre-calcul indépendant : N23 (k€ → M€) et N04 (division par le cours)', function () {
  for (let i = 0; i < 100; i++) {
    const q = NUM.generate('N23', U.mulberry32(1300 + i), 'fr', i);
    const names = q.prompt.replace('Quel est le total des investissements de : ', '').replace(' ? (en millions d\'euros)', '').split(', ');
    const sum = q.visual.rows.filter((r) => names.indexOf(r[0]) !== -1).reduce((s, r) => s + parseShown(r[1], 'fr'), 0);
    ok(Math.abs(parseShown(q.choices[q.answer].text, 'fr') - sum / 1000) < 0.0051);
    const q2 = NUM.generate('N04', U.mulberry32(1700 + i), 'fr', i);
    const cur = /\$/.test(q2.prompt) ? 'USD' : /£/.test(q2.prompt) ? 'GBP' : 'CHF';
    const rate = parseShown(q2.visual.rows.find((r) => r[0] === cur)[1], 'fr');
    const amt = parseShown(q2.prompt.match(/s'élève à ([^.]+)\./)[1], 'fr');
    ok(Math.abs(parseShown(q2.choices[q2.answer].text, 'fr') - amt / rate) < 0.51);
  }
});
test('les distracteurs proviennent d\'erreurs typiques étiquetées', function () {
  const tags = {};
  NUM.GENS.forEach((g) => { for (let i = 0; i < 20; i++) NUM.generate(g.id, U.mulberry32(i + 3), 'fr', i).choices.forEach((c) => { if (c.err) tags[c.err] = 1; }); });
  ['base', 'pp', 'sens', 'conversion', 'compose', 'periodes', 'moyenne', 'lecture'].forEach((t) => ok(tags[t], 'type ' + t + ' jamais utilisé'));
  Object.keys(tags).forEach((t) => ok(NUM.ERR_LABELS[t], 'libellé manquant pour ' + t));
});
test('choix adaptatif : un type souvent raté revient plus souvent', function () {
  const stats = {};
  NUM.GENS.forEach((g) => { stats[g.id] = { n: 20, ok: 19 }; });
  stats.N07 = { n: 20, ok: 2 };
  const rng = U.mulberry32(42), count = {};
  for (let i = 0; i < 3000; i++) { const id = NUM.pickGen(rng, stats); count[id] = (count[id] || 0) + 1; }
  ok(count.N07 > 3 * (count.N01 || 1), 'N07 tiré ' + count.N07 + ' fois contre ' + count.N01);
  const ex = NUM.pickGen(U.mulberry32(1), {}, NUM.GENS.map((g) => g.id).filter((x) => x !== 'N12'));
  eq(ex, 'N12');
});

/* ====================================================================== */
group('Générateurs abstraits (100 tirages par générateur)');
test('au moins 12 générateurs', function () { ok(ABS.GENS.length >= 12, ABS.GENS.length); });
ABS.GENS.forEach(function (g) {
  test(g.id + ' — ' + g.title, function () {
    for (let i = 0; i < 100; i++) {
      const q = ABS.generate(g.id, U.mulberry32(i * 131 + g.id.charCodeAt(2)), i);
      const keys = q.choices.map((c) => (c.fig ? ABS.key(c.fig) : c.text));
      ok(q.choices.length >= 4, 'au moins 4 propositions');
      eq(new Set(keys).size, keys.length, 'propositions visuellement distinctes (tirage ' + i + ')');
      eq(q.choices.filter((c) => c.err === null).length, 1, 'une seule bonne réponse');
      eq(q.choices[q.answer].err, null);
      ok(q.rule && q.rule.length > 10 && q.explain.length >= 1, 'règle expliquée');
      q.choices.forEach((c) => { if (c.fig) ok(!/NaN|undefined/.test(ABS.figureSVG(c.fig)), 'SVG valide'); });
      (q.seq || []).forEach((f) => ok(!/NaN|undefined/.test(ABS.figureSVG(f))));
    }
  });
});
test('la clé canonique tient compte des symétries', function () {
  eq(ABS.key([{ t: 'poly', sides: 4, rot: 0, fill: 'black' }]), ABS.key([{ t: 'poly', sides: 4, rot: 90, fill: 'black' }]));
  ok(ABS.key([{ t: 'arrow', rot: 0, fill: 'black' }]) !== ABS.key([{ t: 'arrow', rot: 90, fill: 'black' }]));
  eq(ABS.key([{ t: 'circle', rot: 45, fill: 'grey' }]), ABS.key([{ t: 'circle', rot: 0, fill: 'grey' }]));
});
test('suites numériques : la bonne réponse prolonge vraiment la règle (arithmétique et Fibonacci)', function () {
  let seen = 0;
  for (let i = 0; i < 400; i++) {
    const q = ABS.generate('A11', U.mulberry32(i), i), t = q.terms, v = q.choices[q.answer].value;
    if (/On ajoute (-?\d+) à chaque terme/.test(q.rule)) { eq(v - t[4], t[4] - t[3]); seen++; }
    if (/somme des deux précédents/.test(q.rule)) { eq(v, t[4] + t[3]); seen++; }
  }
  ok(seen > 50);
});

/* ====================================================================== */
group('Chronomètre (horloge simulée)');
test('compte à rebours basé sur l\'heure réelle', function () {
  const start = ms(2026, 11, 17, 9), t = TM.countdown(start, 25 * 60000);
  eq(TM.remaining(t, start), 25 * 60000);
  eq(TM.remaining(t, start + 60000), 24 * 60000);
  eq(TM.format(TM.remaining(t, start + 61500)), '23:59');
  ok(!TM.expired(t, start + 25 * 60000 - 1));
  ok(TM.expired(t, start + 25 * 60000));
});
test('passage en arrière-plan : 10 minutes sans rafraîchissement sont bien décomptées', function () {
  const start = ms(2026, 11, 17, 9), t = TM.countdown(start, 25 * 60000);
  // Aucun « tick » entre les deux lectures : seul l'écart d'heure compte.
  eq(TM.remaining(t, start + 3 * 60000), 22 * 60000);
  eq(TM.remaining(t, start + 13 * 60000), 12 * 60000);
  ok(TM.expired(t, start + 40 * 60000));
  eq(TM.remaining(t, start + 40 * 60000), 0);
});
test('horloge qui recule : jamais plus que la durée initiale, jamais négatif', function () {
  const start = ms(2026, 11, 17, 9), t = TM.countdown(start, 60000);
  eq(TM.remaining(t, start - 5000), 60000);
  eq(TM.elapsed(t, start - 5000), 0);
  eq(TM.questionTime(start, start - 1000), 0);
});
test('temps par question plafonné (question oubliée ouverte)', function () {
  eq(TM.questionTime(0, 3 * 3600 * 1000), 10 * 60000);
  eq(TM.questionTime(0, 45000), 45000);
});

/* ====================================================================== */
group('Calculatrice');
test('priorités, parenthèses, pourcentage, virgule', function () {
  eq(CALC.evaluate('2+3×4').value, 14);
  eq(CALC.evaluate('(2+3)*4').value, 20);
  eq(CALC.evaluate('200×15%').value, 30);
  eq(CALC.evaluate('1,5+2.5').value, 4);
  eq(CALC.evaluate('−3+5').value, 2);
  eq(CALC.evaluate('-(2-5)').value, 3);
  eq(CALC.evaluate('1234,5×1,08').value, 1333.26);
  eq(CALC.evaluate('0.1+0.2').value, 0.3);
});
test('erreurs propres (division par zéro, expression incomplète)', function () {
  eq(CALC.evaluate('10÷0').ok, false);
  eq(CALC.evaluate('12/(3-3)').ok, false);
  eq(CALC.evaluate('2+').ok, false);
  eq(CALC.evaluate('((1)').ok, false);
  eq(CALC.evaluate('1..2').ok, false);
  eq(CALC.display(1333.26), '1333,26');
  eq(CALC.display(-2.5), '−2,5');
});

/* ====================================================================== */
group('Répétition espacée (technique, SJT, anglais)');
test('intervalles 1, 2, 4, 7, 15, 30, 60 jours', function () {
  let card, day = '2026-01-01';
  const seen = [];
  for (let i = 0; i < 7; i++) { card = SRS.review(card, 'correct', day); seen.push(U.diffDays(day, card.due)); day = card.due; }
  deq(seen, [1, 2, 4, 7, 15, 30, 60]);
});
test('erreur : retour à l\'étape 0, due le jour même ; presque : même étape', function () {
  let c = SRS.review(null, 'correct', '2026-01-01');
  c = SRS.review(c, 'correct', c.due);
  const w = SRS.review(c, 'wrong', c.due);
  eq(w.step, 0); eq(w.due, c.due);
  const a = SRS.review(c, 'almost', c.due);
  eq(a.step, c.step);
});
test('sélection : dues d\'abord, puis nouvelles, puis en avance', function () {
  const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }];
  const cards = { a: { step: 1, due: '2026-01-10', seen: 1 }, b: { step: 2, due: '2026-01-02', seen: 2 }, c: { step: 3, due: '2026-03-01', seen: 3, last: '2026-01-01' } };
  const out = Q.pickSRS(items, cards, '2026-01-10', 4, U.mulberry32(1));
  deq(out.map((x) => x.id), ['b', 'a', 'd', 'c']);
  eq(Q.countDue(items, cards, '2026-01-10'), 2);
});

/* ====================================================================== */
group('Gamification (sans cœurs)');
test('l\'objectif se compte en minutes d\'entraînement', function () {
  const s = fresh();
  s.settings.goalMinutes = 10;
  let r = G.addActivity(s, 10, 9 * 60000, '2026-02-01');
  ok(!r.reachedNow);
  r = G.addActivity(s, 10, 60000, '2026-02-01');
  ok(r.reachedNow); eq(s.streak.count, 1);
  eq(G.todayXp(s, '2026-02-01'), 20);
  ok(s.hearts === undefined, 'pas de cœurs dans l\'état');
});
test('série, gel gagné tous les 7 jours, gel consommé sur un jour manqué', function () {
  const s = fresh(); s.settings.goalMinutes = 10;
  let d = '2026-02-01';
  for (let i = 0; i < 7; i++) { G.addActivity(s, 0, 10 * 60000, d); d = U.addDays(d, 1); }
  eq(s.streak.count, 7); eq(s.streak.freezes, 1);
  G.settleStreak(s, U.addDays(d, 1)); // un jour manqué
  eq(s.streak.count, 7); eq(s.streak.freezes, 0);
  G.settleStreak(s, U.addDays(d, 4));
  eq(s.streak.count, 0);
});
test('les erreurs rapportent un peu d\'XP (on apprend en se trompant)', function () {
  ok(G.XP.wrong > 0 && G.XP.wrong < G.XP.correct);
  eq(G.level(0).level, 1); ok(G.level(5000).level > 5);
});

/* ====================================================================== */
group('Simulations : formats et notation');
test('formats : la simulation complète dure environ 51 minutes', function () {
  const c = SC.FORMATS.complete.sections;
  eq(c.reduce((s, x) => s + x.minutes, 0), 51);
  ok(SC.FORMATS.numerique.noBack);
  eq(SC.FORMATS.numerique.n, 18); eq(SC.FORMATS.verbal.minutes, 19);
});
test('bilan : score, non traitées, temps moyen, questions trop lentes, erreurs par type', function () {
  const a = [
    { points: 1, ms: 40000, targetSec: 60 }, { points: 0, ms: 100000, targetSec: 60, err: 'base' },
    { points: null, ms: 0, targetSec: 60 }, { points: 0.5, ms: 30000, targetSec: 90, err: 'pire' }
  ];
  const s = SC.summarize(a, 'numerique', 600000);
  eq(s.n, 4); eq(s.correct, 1.5); eq(s.skipped, 1); eq(s.pct, 37.5);
  eq(s.avgMs, Math.round((40000 + 100000 + 30000) / 3));
  deq(s.slow, [1]);
  deq(s.errors, { base: 1, pire: 1 });
});
test('percentile indicatif : borné, croissant, 50e à la moyenne', function () {
  eq(SC.percentile('numerique', 0.55), 50);
  ok(SC.percentile('numerique', 0.9) > SC.percentile('numerique', 0.7));
  eq(SC.percentile('numerique', 0), 1); eq(SC.percentile('numerique', 1), 99);
  ok(Math.abs(SC.normCdf(1.96) - 0.975) < 0.001);
});
test('SJT plus / moins efficace : 1, 0,5 ou 0 point', function () {
  const it = { type: 'best-worst', options: [{ score: 2 }, { score: 4 }, { score: 1 }, { score: 3 }] };
  eq(SC.scoreSJT(it, { best: 1, worst: 2 }).result, 'correct');
  eq(SC.scoreSJT(it, { best: 1, worst: 0 }).points, 0.5);
  eq(SC.scoreSJT(it, { best: 3, worst: 0 }).result, 'wrong');
});
test('SJT classement : exact, inversion voisine, classement éloigné', function () {
  const it = { type: 'rank', options: [{ score: 2 }, { score: 4 }, { score: 1 }, { score: 3 }] };
  deq(SC.sjtOrder(it), [1, 3, 0, 2]);
  eq(SC.scoreSJT(it, { order: [1, 3, 0, 2] }).result, 'correct');
  const near = SC.scoreSJT(it, { order: [3, 1, 0, 2] });
  eq(near.result, 'almost'); eq(near.points, 0.75);
  eq(SC.scoreSJT(it, { order: [2, 0, 3, 1] }).result, 'wrong');
  eq(SC.scoreSJT(it, { order: [1] }).points, 0);
});

/* ====================================================================== */
group('Statistiques et plan de préparation');
test('réussite, vitesse et erreurs par type depuis le journal', function () {
  const s = fresh();
  for (let i = 0; i < 12; i++) ST.logAnswer(s, { m: 'numerique', g: 'N01', ok: i % 3 ? 1 : 0, ms: 45000, tgt: 60, e: i % 3 ? null : 'base' }, i);
  const st = STATS.moduleStats(s.log, 'numerique');
  eq(st.n, 12); ok(Math.abs(st.acc - 8 / 12) < 1e-9); ok(Math.abs(st.speed - 0.75) < 1e-9);
  deq(STATS.errorStats(s.log, 'numerique'), { base: 4 });
  eq(STATS.levelLabel(st).key, 'mid'); eq(STATS.speedLabel(st), 'rapide');
  eq(STATS.weakest(s.log, ['numerique', 'verbal'])[0], 'verbal');
});
test('plan sur 4 semaines : 28 jours, simulation à J−2 et chaque semaine, veille légère', function () {
  const p = PL.buildPlan({ today: '2026-11-17', testDate: '2026-12-31', weeks: 4, weak: ['sjt', 'numerique', 'verbal', 'abstrait', 'technique'], minutes: 20 });
  eq(p.length, 28);
  eq(p[0].date, '2026-12-03');
  eq(p[p.length - 1].type, 'leger');
  eq(p.filter((d) => d.daysLeft === 2)[0].type, 'simulation');
  deq(p.filter((d) => d.type === 'simulation').map((d) => d.daysLeft), [28, 21, 14, 7, 2]);
  const train = p.filter((d) => d.type === 'entrainement');
  const cnt = {}; train.forEach((d) => d.focus.forEach((m) => { cnt[m] = (cnt[m] || 0) + 1; }));
  ok(cnt.sjt > cnt.technique, 'le module le plus faible revient plus souvent');
  ok(train.every((d) => d.focus[0] !== d.focus[1]));
});
test('plan sur 2 semaines, test proche ou passé', function () {
  eq(PL.buildPlan({ today: '2026-11-17', testDate: '2026-12-31', weeks: 2 }).length, 14);
  eq(PL.buildPlan({ today: '2026-11-17', testDate: '2026-11-22', weeks: 4 }).length, 5);
  eq(PL.buildPlan({ today: '2026-11-17', testDate: '2026-11-17', weeks: 4 }).length, 0);
});

/* ====================================================================== */
group('Stockage, export / import, candidatures');
test('état par défaut et migration d\'un état abîmé', function () {
  const s = ST.migrate({ settings: { goalMinutes: 7, questionLang: 'de' }, log: [{ id: 'x', m: 'inconnu' }, { id: 'y-1', m: 'verbal', ok: 1, ms: 9e9 }], apps: [{ id: 'a', cabinet: 'EY', statut: 'bidon', date: '2026-13-45' }] }, 0);
  eq(s.settings.goalMinutes, 20); eq(s.settings.questionLang, 'mix');
  eq(s.log.length, 1); eq(s.log[0].ms, 600000);
  eq(s.apps[0].statut, 'a-passer'); eq(s.apps[0].date, null);
});
test('export puis import : progression identique', function () {
  const s = fresh();
  ST.logAnswer(s, { m: 'sjt', g: 'S01', ok: 0.5, ms: 60000, tgt: 90, e: 'pire' }, 5);
  s.cards.S01 = SRS.review(null, 'almost', '2026-01-02', 5);
  ST.saveApp(s, { cabinet: 'PwC', poste: 'Auditeur junior', date: '2026-12-01', statut: 'a-passer' }, 10);
  s.plan = { testDate: '2026-12-01', weeks: 2, updatedAt: 11 };
  const back = ST.importState(ST.exportState(s, 99), 100);
  ok(back.ok); deq(back.state.log, s.log); deq(back.state.apps, s.apps); deq(back.state.plan, s.plan); deq(back.state.cards, s.cards);
});
test('import refusé : JSON invalide, sauvegarde d\'English Pro, version future', function () {
  eq(ST.importState('{oups', 0).ok, false);
  ok(/English Pro/.test(ST.importState(JSON.stringify({ app: 'english-pro', state: {} }), 0).error));
  eq(ST.importState(JSON.stringify({ app: 'big4-prep', version: 99, state: {} }), 0).ok, false);
});
test('stockage local et simulation en cours (reprise après fermeture)', function () {
  const mem = memStorage(), store = ST.createStore(mem);
  ok(store.persistent);
  const s = fresh(); s.sessions = 3; store.save(s);
  eq(store.load(0).sessions, 3);
  store.saveSim({ id: 'run-1', sections: [{ start: 123 }] });
  eq(store.loadSim().sections[0].start, 123);
  store.saveSim(null); eq(store.loadSim(), null);
  const broken = ST.createStore(null);
  ok(!broken.persistent); broken.save(s); eq(broken.load(0).sessions, 3);
});
test('candidatures : ajout, modification, suppression, tri par date', function () {
  const s = fresh();
  eq(ST.saveApp(s, { cabinet: '' }, 1).ok, false);
  const a = ST.saveApp(s, { cabinet: 'KPMG', date: '2026-12-10' }, 1).app;
  ST.saveApp(s, { cabinet: 'EY', date: '2026-12-02' }, 2);
  ST.saveApp(s, { cabinet: 'Deloitte' }, 3);
  deq(ST.activeApps(s).map((x) => x.cabinet), ['EY', 'KPMG', 'Deloitte']);
  ST.saveApp(s, { id: a.id, cabinet: 'KPMG', date: '2026-12-10', statut: 'passe' }, 4);
  eq(s.apps.filter((x) => x.id === a.id)[0].statut, 'passe');
  ok(ST.deleteApp(s, a.id, 5));
  eq(ST.activeApps(s).length, 2);
  eq(s.apps.length, 3, 'la suppression laisse une trace pour la synchronisation');
});
test('journal : identifiants uniques préfixés par l\'appareil, taille plafonnée', function () {
  const s = fresh();
  for (let i = 0; i < ST.LOG_MAX + 50; i++) ST.logAnswer(s, { m: 'abstrait', g: 'A01', ok: 1, ms: 1000, tgt: 40 }, i);
  eq(s.log.length, ST.LOG_MAX);
  eq(new Set(s.log.map((e) => e.id)).size, ST.LOG_MAX);
  ok(s.log[0].id.indexOf(s.deviceId + '-') === 0);
});

/* ====================================================================== */
group('Fusion pour la synchronisation');
function twoDevices() {
  const a = fresh(), b = fresh();
  a.deviceId = 'telephone'; b.deviceId = 'ordinateur';
  return [a, b];
}
test('XP et minutes : maximum par appareil et par jour, jamais de double comptage', function () {
  const [a, b] = twoDevices();
  G.addActivity(a, 50, 5 * 60000, '2026-02-01');
  G.addActivity(b, 30, 4 * 60000, '2026-02-01');
  let m = MG.mergeStates(a, b, '2026-02-01');
  for (let i = 0; i < 5; i++) m = MG.mergeStates(m, b, '2026-02-01');
  eq(G.todayXp(m, '2026-02-01'), 80);
  eq(G.todayMinutes(m, '2026-02-01'), 9);
  const back = MG.mergeStates(b, m, '2026-02-01');
  eq(G.todayXp(back, '2026-02-01'), 80);
});
test('la série est validée quand les minutes cumulées des deux appareils atteignent l\'objectif', function () {
  const [a, b] = twoDevices();
  a.settings.goalMinutes = 10;
  G.addActivity(a, 0, 6 * 60000, '2026-02-01');
  G.addActivity(b, 0, 5 * 60000, '2026-02-01');
  const m = MG.mergeStates(a, b, '2026-02-01');
  eq(m.streak.count, 1); eq(m.streak.last, '2026-02-01');
});
test('journal et simulations : union sans doublon', function () {
  const [a, b] = twoDevices();
  ST.logAnswer(a, { m: 'verbal', g: 'V01-1', ok: 1, ms: 1, tgt: 45 }, 1);
  ST.logAnswer(b, { m: 'verbal', g: 'V01-2', ok: 0, ms: 1, tgt: 45 }, 2);
  a.sims.push({ id: 'run-telephone-1', ts: 1, module: 'verbal', n: 30, pct: 60 });
  let m = MG.mergeStates(a, b);
  m = MG.mergeStates(m, b); m = MG.mergeStates(m, a);
  eq(m.log.length, 2); eq(m.sims.length, 1);
  deq(m.log.map((e) => e.ts), [1, 2]);
});
test('fiches de révision : la plus récente l\'emporte', function () {
  const [a, b] = twoDevices();
  a.cards.T001 = { step: 3, due: '2026-02-10', seen: 3, ok: 3, ko: 0, last: '2026-02-03', ts: 100 };
  b.cards.T001 = { step: 0, due: '2026-02-05', seen: 4, ok: 3, ko: 1, last: '2026-02-05', ts: 200 };
  eq(MG.mergeStates(a, b).cards.T001.step, 0);
  eq(MG.mergeStates(b, a).cards.T001.step, 0);
});
test('candidatures : la modification la plus récente l\'emporte, la suppression se propage', function () {
  const [a, b] = twoDevices();
  const app = ST.saveApp(a, { cabinet: 'PwC', date: '2026-12-01' }, 10).app;
  let mb = MG.mergeStates(b, a);
  ST.saveApp(mb, { id: app.id, cabinet: 'PwC', date: '2026-12-01', statut: 'passe' }, 20);
  ST.deleteApp(a, app.id, 30);
  const m1 = MG.mergeStates(a, mb), m2 = MG.mergeStates(mb, a);
  eq(ST.activeApps(m1).length, 0); eq(ST.activeApps(m2).length, 0);
});
test('plan : le plus récemment modifié l\'emporte ; numéro de journal préservé', function () {
  const [a, b] = twoDevices();
  a.plan = { testDate: '2026-12-01', weeks: 4, updatedAt: 5 };
  b.plan = { testDate: '2026-12-15', weeks: 2, updatedAt: 9 };
  eq(MG.mergeStates(a, b).plan.testDate, '2026-12-15');
  const remote = fresh(); remote.deviceId = 'x';
  remote.log = [{ id: 'telephone-40', ts: 1, m: 'sjt', g: 'S01', ok: 1, ms: 1, tgt: 90, e: null, s: 't', l: 'fr' }];
  const m = MG.mergeStates(a, remote);
  eq(m.logSeq, 40);
  const e = ST.logAnswer(m, { m: 'sjt', g: 'S02', ok: 1, ms: 1, tgt: 90 }, 2);
  eq(e.id, 'telephone-41');
});
test('import d\'une sauvegarde d\'un autre appareil : compteurs rangés sous cet appareil', function () {
  const [a, b] = twoDevices();
  G.addActivity(b, 40, 60000, '2026-02-01');
  const imported = ST.importState(ST.exportState(b, 0), 0).state;
  const s = MG.adoptImported(imported, 'telephone');
  eq(s.deviceId, 'telephone'); eq(s.xp.total, 0); eq(s.peers.ordinateur.xp.total, 40);
  eq(G.totalXp(s), 40);
});

/* ====================================================================== */
group('Synchronisation (GitHub simulé)');
function fakeGitHub() {
  const gists = {}; let seq = 0; const calls = [];
  function res(status, body) { return Promise.resolve({ status, ok: status >= 200 && status < 300, json: () => Promise.resolve(body), text: () => Promise.resolve(JSON.stringify(body)), headers: { get: () => null } }); }
  function fetch(url, init) {
    calls.push((init && init.method || 'GET') + ' ' + url);
    const auth = init && init.headers && init.headers.Authorization;
    if (auth !== 'Bearer ghp_' + 'a'.repeat(36)) return res(401, {});
    const p = url.replace('https://api.github.com', '');
    if (p === '/user') return res(200, { login: 'lmontaud' });
    if (p.indexOf('/gists?') === 0) return res(200, Object.keys(gists).map((id) => ({ id, files: gists[id].files, updated_at: '2026' })));
    if (p === '/gists' && init.method === 'POST') { const id = 'g' + (++seq); gists[id] = { id, files: JSON.parse(init.body).files }; return res(201, gists[id]); }
    const m = p.match(/^\/gists\/(\w+)$/);
    if (m && init.method === 'PATCH') { Object.assign(gists[m[1]].files, JSON.parse(init.body).files); return res(200, gists[m[1]]); }
    if (m) return gists[m[1]] ? res(200, gists[m[1]]) : res(404, {});
    return res(404, {});
  }
  return { fetch, gists, calls };
}
atest('connexion : crée un Gist avec le fichier big4-prep-progression.json (distinct d\'English Pro)', async function () {
  const gh = fakeGitHub();
  gh.gists.ep = { id: 'ep', files: { 'english-pro-progression.json': { content: '{}' } } };
  const client = SY.createClient({ fetch: gh.fetch, storage: memStorage() });
  const r = await client.connect('ghp_' + 'a'.repeat(36), ST.exportState(fresh(), 0));
  ok(r.created); eq(r.login, 'lmontaud');
  const mine = Object.values(gh.gists).filter((g) => g.files['big4-prep-progression.json']);
  eq(mine.length, 1);
  ok(gh.gists.ep.files['english-pro-progression.json'], 'le Gist d\'English Pro n\'est pas touché');
  eq(SY.FILE, 'big4-prep-progression.json');
});
atest('deux appareils, même clé : la progression est fusionnée', async function () {
  const gh = fakeGitHub(), token = 'ghp_' + 'a'.repeat(36);
  const [a, b] = twoDevices();
  G.addActivity(a, 30, 60000, '2026-02-01');
  G.addActivity(b, 20, 60000, '2026-02-01');
  const ca = SY.createClient({ fetch: gh.fetch, storage: memStorage() }), cb = SY.createClient({ fetch: gh.fetch, storage: memStorage() });
  const merge = (l, r) => MG.mergeStates(l, r, '2026-02-01'), exp = (s) => ST.exportState(s, 0), imp = (t) => ST.importState(t, 0);
  await ca.connect(token, exp(a)); await ca.sync(a, merge, exp, imp);
  await cb.connect(token, exp(b));
  const rb = await cb.sync(b, merge, exp, imp);
  eq(G.todayXp(rb.state, '2026-02-01'), 50);
  const ra = await ca.sync(a, merge, exp, imp);
  eq(G.todayXp(ra.state, '2026-02-01'), 50);
});
test('clé partagée : la clé enregistrée par English Pro est retrouvée', function () {
  const mem = memStorage();
  eq(SY.sharedToken(mem), null);
  mem.setItem('english-pro-sync-v1', JSON.stringify({ token: 'ghp_' + 'b'.repeat(36), gistId: 'x', login: 'lmontaud' }));
  const s = SY.sharedToken(mem);
  eq(s.login, 'lmontaud'); eq(s.from, 'English Pro');
  eq(SY.CONFIG_KEY, 'big4-prep-sync-v1');
});

/* ====================================================================== */
group('Rappels calendrier (.ics)');
test('rappel quotidien et date de test : format iCalendar valide', function () {
  const d = R.buildICS({ time: '19:00', now: new Date(2026, 10, 17, 10) });
  ok(/RRULE:FREQ=DAILY/.test(d) && /DTSTART:20261117T190000/.test(d));
  const e = R.buildEventICS({ date: '2026-12-03', title: 'Test en ligne PwC, numérique ; verbal', description: 'x'.repeat(200), now: new Date(2026, 10, 17) });
  ok(/DTSTART;VALUE=DATE:20261203/.test(e) && /DTEND;VALUE=DATE:20261204/.test(e));
  ok(/TRIGGER:-PT15H/.test(e) && /TRIGGER:PT9H/.test(e));
  ok(/SUMMARY:Test en ligne PwC\\, numérique \\; verbal/.test(e));
  e.split('\r\n').forEach((l) => ok(Buffer.byteLength(l, 'utf8') <= 75, 'ligne trop longue'));
  eq(R.buildEventICS({ date: 'demain' }), null);
});

/* ====================================================================== */
group('Contenu rédigé');
test('volumes : 40 textes verbaux, 50 SJT, 150 questions techniques', function () {
  const passages = Object.values(content.passages);
  ok(passages.length >= 40, passages.length + ' textes');
  eq(passages.filter((p) => p.lang === 'fr').length, passages.filter((p) => p.lang === 'en').length, 'moitié FR, moitié EN');
  passages.forEach((p) => ok(p.statements.length >= 3 && p.statements.length <= 4, p.id + ' : 3 ou 4 affirmations'));
  ok(content.items.filter((i) => i.module === 'sjt').length >= 50);
  ok(content.items.filter((i) => i.module === 'technique').length >= 150);
  ok(content.items.filter((i) => i.module === 'anglais').length >= 15);
});
test('chaque item : champs complets, une seule bonne réponse, propositions distinctes', function () {
  eq(content.errors.length, 0, content.errors.join('; '));
  const problems = [];
  content.items.forEach((it) => problems.push.apply(problems, C.validateItem(it, content.passages)));
  eq(problems.length, 0, problems.slice(0, 10).join('\n'));
});
test('fichiers JSON : identifiants uniques et cohérents avec le module', function () {
  const ids = new Set();
  files.forEach((f) => (f.items || []).forEach((it) => { ok(!ids.has(it.id), 'double ' + it.id); ids.add(it.id); if (it.module) eq(it.module, f.module); }));
});
test('verbal : les trois réponses sont représentées, « On ne peut pas savoir » au moins 20 %', function () {
  const v = content.items.filter((i) => i.module === 'verbal'), c = { vrai: 0, faux: 0, nsp: 0 };
  v.forEach((i) => { c[i.answer]++; });
  ok(c.nsp / v.length >= 0.2, JSON.stringify(c)); ok(c.vrai > 0 && c.faux > 0);
});
test('SJT : meilleure et pire réponses uniques, les deux formats présents', function () {
  const s = content.items.filter((i) => i.module === 'sjt');
  ok(s.some((i) => i.type === 'rank') && s.some((i) => i.type === 'best-worst'));
  s.forEach((i) => { const sc = i.options.map((o) => o.score); eq(new Set(sc).size, 4, i.id); });
});
test('technique : les réponses chiffrées sont cohérentes (aucun doublon numérique)', function () {
  content.items.filter((i) => i.module === 'technique' && i.type === 'calcul').forEach((i) => {
    const vals = i.answers.concat(i.distractors).map((t) => t.replace(/\s/g, ''));
    eq(new Set(vals).size, vals.length, i.id);
  });
});
test('fiches : personnalité, jeux, stratégie, formats, méthode verbale', function () {
  ['personnalite', 'jeux', 'strategie', 'formats', 'verbal'].forEach((id) => ok(content.fiches.some((f) => f.id === id), id));
  ok(!content.fiches.some((f) => f.quiz), 'pas de quiz sur la personnalité');
});

/* ====================================================================== */
group('Questions normalisées (moteur commun)');
test('files de questions pour chaque module, en entraînement et en simulation', function () {
  const s = fresh();
  ['numerique', 'verbal', 'abstrait', 'sjt', 'technique', 'anglais'].forEach((m) => {
    const qs = Q.buildQueue(m, { content, state: s, today: '2026-11-17', rng: U.mulberry32(3), pref: 'mix', n: 10 });
    eq(qs.length, 10, m);
    qs.forEach((q) => { ok(q.qid && q.module === m && q.targetSec > 0, m); });
  });
  const sim = Q.buildQueue('verbal', { content, state: s, today: '2026-11-17', rng: U.mulberry32(4), pref: 'mix', n: 30, sim: true });
  eq(sim.length, 30);
});
test('numérique : langues alternées en mode « mix », imposées sinon', function () {
  const s = fresh();
  const mix = Q.buildQueue('numerique', { content, state: s, today: '2026-11-17', rng: U.mulberry32(5), pref: 'mix', n: 6 });
  deq(mix.map((q) => q.lang), ['fr', 'en', 'fr', 'en', 'fr', 'en']);
  ok(Q.buildQueue('numerique', { content, state: s, today: '2026-11-17', rng: U.mulberry32(5), pref: 'en', n: 4 }).every((q) => q.lang === 'en'));
});
test('évaluation : bonne réponse, type d\'erreur, réponse passée', function () {
  const s = fresh();
  const q = Q.buildQueue('numerique', { content, state: s, today: '2026-11-17', rng: U.mulberry32(6), pref: 'fr', n: 1 })[0];
  eq(Q.evaluate(q, { idx: q.answer }).result, 'correct');
  const wrong = q.answer === 0 ? 1 : 0;
  const ev = Q.evaluate(q, { idx: wrong });
  eq(ev.points, 0); eq(ev.err, q.choices[wrong].err);
  eq(Q.evaluate(q, null).points, null);
});
test('verbal : les pièges sont étiquetés (« On ne peut pas savoir » manqué ou en excès)', function () {
  const it = content.items.find((i) => i.module === 'verbal' && i.answer === 'nsp');
  const q = Q.fromVerbal(it, content.passages[it.passage]);
  eq(Q.evaluate(q, { idx: 0 }).err, 'nsp-manque');
  const it2 = content.items.find((i) => i.module === 'verbal' && i.answer === 'vrai');
  const q2 = Q.fromVerbal(it2, content.passages[it2.passage]);
  eq(Q.evaluate(q2, { idx: 2 }).err, 'nsp-exces');
  eq(Q.evaluate(q2, { idx: 1 }).err, 'inversion');
});
test('SJT : réponse incomplète refusée, notation partielle', function () {
  const it = content.items.find((i) => i.module === 'sjt' && i.type === 'best-worst');
  const q = Q.fromItem(it, U.mulberry32(1));
  ok(!Q.isComplete(q, { best: 0, worst: null }));
  ok(!Q.isComplete(q, { best: 1, worst: 1 }));
  const order = SC.sjtOrder(it);
  eq(Q.evaluate(q, { best: order[0], worst: order[3] }).result, 'correct');
  eq(Q.evaluate(q, { best: order[1], worst: order[3] }).err, 'meilleure');
});

/* ====================================================================== */
group('Graphiques');
test('graphique SVG : valeurs au format français, aucune valeur non numérique', function () {
  const svg = CH.chartSVG({ kind: 'bar', lang: 'fr', decimals: 1, title: 'Test', labels: ['A', 'B'], series: [{ name: '', values: [1234.5, 12.25] }] });
  ok(/1 235/.test(svg) && /12,3/.test(svg)); ok(!/NaN/.test(svg));
});

/* ====================================================================== */
(async function () {
  // les tests asynchrones ont été lancés au fil de l'eau ; on attend la fin de la file
  await new Promise((r) => setTimeout(r, 200));
  console.log('\n' + passed + ' tests réussis, ' + failed + ' en échec.');
  if (failed) { console.log('\nÉchecs :\n' + failures.map((f) => '  - ' + f).join('\n')); process.exit(1); }
})();
