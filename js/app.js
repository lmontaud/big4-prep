/* Big4 Prep — application : chargement du contenu, écrans, entraînement, simulations, suivi. */
(function () {
  'use strict';
  var BP = window.BP;
  var U = BP.util, SRS = BP.srs, G = BP.game, C = BP.content, ST = BP.store, MG = BP.merge, SC = BP.scoring,
    STATS = BP.stats, PL = BP.plan, R = BP.reminder, TM = BP.timer, CALC = BP.calc, UI = BP.ui, Q = BP.q, h = UI.h;

  var APP_VERSION = '1.0.0';
  var ENGLISH_PRO_URL = 'https://lmontaud.github.io/english-pro/';
  var MAIN_MODULES = ['numerique', 'verbal', 'abstrait', 'sjt', 'technique'];
  var TRAIN_SIZE = 10;

  // Horloge décalable (utilisée par les tests de bout en bout pour simuler des dates).
  BP.clock = BP.clock || { offset: 0 };
  function now() { return Date.now() + (BP.clock.offset || 0); }
  function today() { return U.dayKey(new Date(now())); }

  var app = BP.app = {
    version: APP_VERSION, state: null, store: null, content: null, tab: 'accueil', sub: null, subData: null,
    run: null, report: null, pendingSim: null, contentErrors: [], installPrompt: null, swRegistration: null,
    tick: null, notifTimer: null, stopGame: null, sheet: null
  };
  var main, nav;

  function save() {
    var ok = app.store.save(app.state);
    scheduleSync();
    return ok;
  }

  /* ====================== Synchronisation entre appareils (reprise d'English Pro) ====================== */

  var syncTimer = null;
  var sync = BP.sync = {
    client: null, running: false, pending: false, error: null, storage: null,
    available: function () { return typeof fetch === 'function' && /^https?:$/.test(location.protocol) && !UI.inFrame(); },
    isConnected: function () { return !!(sync.client && sync.client.isConnected()); }
  };

  function initSync() {
    var storage;
    try { storage = window.localStorage; storage.getItem('x'); } catch (e) {
      var mem = {};
      storage = { getItem: function (k) { return k in mem ? mem[k] : null; }, setItem: function (k, v) { mem[k] = String(v); }, removeItem: function (k) { delete mem[k]; } };
    }
    sync.storage = storage;
    sync.client = BP.syncCore.createClient({ fetch: function (u, o) { return window.fetch(u, o); }, storage: storage });
  }

  function busy() { return app.sub === 'run' || app.sub === 'game'; }

  function scheduleSync(delay) {
    if (!sync.isConnected() || !sync.available()) return;
    clearTimeout(syncTimer);
    syncTimer = setTimeout(function () { runSync(false); }, delay == null ? 4000 : delay);
  }

  function runSync(manual) {
    if (!sync.isConnected()) return Promise.resolve(null);
    if (!sync.available()) { if (manual) UI.toast(BP.syncCore.MESSAGES.blocked); return Promise.resolve(null); }
    if (sync.running || busy()) { sync.pending = true; return Promise.resolve(null); }
    sync.running = true; sync.pending = false;
    if (manual) UI.toast('Synchronisation…', 1500);
    return sync.client.sync(app.state,
      function (l, r) { return MG.mergeStates(l, r, today()); },
      function (s) { return ST.exportState(s, now()); },
      function (t) { return ST.importState(t, now()); }
    ).then(function (res) {
      sync.running = false; sync.error = null;
      if (busy()) { sync.pending = true; return res; }
      var before = MG.fingerprint(app.state);
      Object.keys(res.state).forEach(function (k) { app.state[k] = res.state[k]; });
      app.store.save(app.state);
      if (MG.fingerprint(app.state) !== before || (!app.sub && app.tab === 'reglages')) { if (!app.sub) render(); }
      if (manual) UI.toast('Progression synchronisée.');
      return res;
    }, function (err) {
      sync.running = false; sync.error = err;
      if (err.code === 'offline' || err.code === 'network') sync.pending = true;
      if (manual) UI.modal({ title: 'Synchronisation impossible', body: err.message });
      else if (!app.sub && (err.code === 'auth' || err.code === 'scope')) render();
      return null;
    });
  }

  function syncIfStale() {
    var c = sync.client && sync.client.config;
    if (sync.isConnected() && (sync.pending || !c.lastSync || Date.now() - c.lastSync > 60000)) runSync(false);
  }

  var ICONS = {
    flame: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M12.4 2.2c.6 3.2 4.9 5.4 4.9 10.3a5.3 5.3 0 0 1-10.6 0c0-1.7.6-3.1 1.5-4.2.2 1.4.9 2.2 1.8 2.5-.3-3.3 1-6.6 2.4-8.6z"/></svg>',
    bolt: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M13.5 2 5 13.6h5.6L9.8 22 19 10.2h-5.8z"/></svg>',
    clock: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
    snow: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    home: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M4 11 12 4l8 7v8.5a.5.5 0 0 1-.5.5H15v-6H9v6H4.5a.5.5 0 0 1-.5-.5z"/></svg>',
    train: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h5M8 17h3"/></svg>',
    apps: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16"/></svg>',
    stats: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 20V11M12 20V4M19 20v-6"/></svg>',
    gear: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/></svg>',
    calc: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M8 7h8M8.5 11.5h.01M12 11.5h.01M15.5 11.5h.01M8.5 15h.01M12 15h.01M15.5 15h.01M8.5 18h.01M12 18h.01M15.5 18h.01"/></svg>'
  };
  function icon(name, cls) { return h('span', { class: 'icon ' + (cls || ''), html: ICONS[name] }); }

  /* ====================== Contenu ====================== */

  function fetchJSON(url, isRetry) {
    return fetch(url).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status + ' pour ' + url);
      return r.json();
    }).catch(function (err) {
      if (isRetry) throw err;
      return new Promise(function (resolve) { setTimeout(resolve, 500); }).then(function () { return fetchJSON(url, true); });
    });
  }

  function loadContent() {
    if (window.BP_CONTENT) return Promise.resolve(window.BP_CONTENT);
    return fetchJSON('content/index.json').then(function (index) {
      return Promise.all((index.files || []).map(function (file) {
        return fetchJSON('content/' + file).catch(function (err) { app.contentErrors.push(file + ' : ' + err.message); return null; });
      }));
    });
  }

  function itemsOf(module) { return app.content.items.filter(function (it) { return it.module === module; }); }

  /* ====================== Navigation ====================== */

  var TABS = [
    { id: 'accueil', label: 'Accueil', icon: 'home' },
    { id: 'entrainer', label: 'S\'entraîner', icon: 'train' },
    { id: 'candidatures', label: 'Candidatures', icon: 'apps' },
    { id: 'stats', label: 'Progrès', icon: 'stats' },
    { id: 'reglages', label: 'Réglages', icon: 'gear' }
  ];

  function renderNav() {
    UI.clear(nav);
    nav.hidden = !!app.sub;
    TABS.forEach(function (t) {
      nav.appendChild(h('button', {
        class: 'tab', type: 'button', id: 'tab-' + t.id, 'aria-current': app.tab === t.id && !app.sub ? 'page' : null,
        onclick: function () { goTab(t.id); }
      }, [h('span', { class: 'icon', html: ICONS[t.icon] }), h('span', { text: t.label })]));
    });
  }

  function goTab(id) {
    closeSheet();
    app.sub = null; app.subData = null;
    app.tab = id;
    syncHash();
    render();
    window.scrollTo(0, 0);
  }

  function inSubState() { try { return !!(history.state && history.state.bp === 'sub'); } catch (e) { return false; } }

  function openSub(name, data) {
    if (!app.sub && !inSubState()) { try { history.pushState({ bp: 'sub' }, ''); } catch (e) { /* rien */ } }
    app.sub = name; app.subData = data || null;
    render();
    window.scrollTo(0, 0);
  }

  function closeSub() {
    closeSheet();
    if (app.stopGame) { app.stopGame(); app.stopGame = null; }
    app.sub = null; app.subData = null;
    if (inSubState()) { try { history.back(); } catch (e) { /* rien */ } }
    render();
    window.scrollTo(0, 0);
    if (sync.pending) scheduleSync(500);
  }

  function syncHash() {
    try { history.replaceState(history.state, '', '#' + app.tab); } catch (e) { /* rien */ }
  }

  function render() {
    renderNav();
    document.body.classList.toggle('in-sub', !!app.sub);
    if (app.sub === 'run') return renderRun();
    if (app.sub === 'report') return renderReport();
    if (app.sub === 'module') return renderModule(app.subData);
    if (app.sub === 'fiche') return renderFiche(app.subData);
    if (app.sub === 'game') return renderGame(app.subData);
    if (app.sub === 'plan') return renderPlan();
    if (app.tab === 'entrainer') return renderModules();
    if (app.tab === 'candidatures') return renderApps();
    if (app.tab === 'stats') return renderStats();
    if (app.tab === 'reglages') return renderSettings();
    return renderHome();
  }

  function setMain(children, cls) {
    main.className = 'main' + (cls ? ' ' + cls : '');
    UI.clear(main);
    UI.append(main, children);
  }

  function subHeader(title, onBack) {
    return h('div', { class: 'sub-head' }, [
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Retour', onclick: onBack || closeSub, html: ICONS.back }),
      h('h1', { text: title })
    ]);
  }

  function statBox(value, label) {
    return h('div', { class: 'stat-box' }, [h('strong', { text: value }), h('span', { text: label })]);
  }

  function progressBar(value, max, cls) {
    var pct = max ? Math.min(100, Math.round(value / max * 100)) : 0;
    return h('div', { class: 'bar ' + (cls || '') + (pct >= 100 ? ' bar-done' : ''), role: 'progressbar', 'aria-valuemin': '0', 'aria-valuemax': String(max), 'aria-valuenow': String(Math.round(value)) },
      h('div', { class: 'bar-fill', style: 'width:' + pct + '%' }));
  }

  function banner(kind, text, action) {
    return h('div', { class: 'banner banner-' + kind }, [
      h('span', { text: text }),
      action ? h('button', { class: 'link', type: 'button', onclick: action.onClick }, action.label) : null
    ]);
  }

  function levelChip(module) {
    var st = STATS.moduleStats(app.state.log, module), lv = STATS.levelLabel(st);
    return h('span', { class: 'level level-' + lv.key, text: lv.label });
  }

  function speedText(module) {
    var st = STATS.moduleStats(app.state.log, module), sp = STATS.speedLabel(st);
    if (!st.n) return h('span', { class: 'speed', text: 'Pas encore commencé' });
    return h('span', { class: 'speed' + (sp === 'trop lent' ? ' speed-slow' : '') }, [Math.round(st.acc * 100) + ' % de réussite' + (sp ? ' · ' + sp : '')]);
  }

  /* ====================== Candidatures : utilitaires ====================== */

  var FIRMS = ['Deloitte', 'PwC', 'EY', 'KPMG', 'Autre'];
  var STATUS_LABEL = { 'a-passer': 'Test à passer', passe: 'Test passé', reussi: 'Réussi', refuse: 'Refusé' };

  /** Prochaine candidature dont le test reste à passer, à partir d'aujourd'hui. */
  function nextApp() {
    var t = today();
    return ST.activeApps(app.state).filter(function (a) { return a.statut === 'a-passer' && a.date && a.date >= t; })[0] || null;
  }

  /** Simulation adaptée au cabinet (dominante des tests rapportés pour l'audit, voir DECISIONS.md). */
  function simFor(cabinet) {
    var N = { module: 'numerique', n: 12, minutes: 16 }, V = { module: 'verbal', n: 16, minutes: 11 },
      A = { module: 'abstrait', n: 12, minutes: 12 }, S = { module: 'sjt', n: 8, minutes: 12 }, T = { module: 'technique', n: 10, minutes: 10 };
    var map = { PwC: [N, V, A, T], Deloitte: [N, A, S, T], EY: [N, V, S], KPMG: [S, N, V] };
    return map[cabinet] || SC.FORMATS.complete.sections;
  }

  /* ====================== Accueil ====================== */

  function pills() {
    var st = app.state, t = today();
    var streak = G.currentStreak(st, t), min = G.todayMinutes(st, t), goal = G.goalMinutes(st), lvl = G.level(G.totalXp(st));
    return h('div', { class: 'pills' }, [
      h('div', { class: 'pill pill-streak' + (streak > 0 ? ' is-on' : ''), title: 'Série' }, [
        icon('flame'), h('strong', { text: String(streak) }), h('span', { class: 'pill-label', text: streak > 1 ? 'jours' : 'jour' }),
        st.streak.freezes ? h('span', { class: 'freeze', title: st.streak.freezes + ' gel(s) de série', html: ICONS.snow }) : null
      ]),
      h('div', { class: 'pill pill-goal', title: 'Objectif du jour' }, [icon('clock'), h('strong', { text: Math.floor(min) + '/' + goal }), h('span', { class: 'pill-label', text: 'min' })]),
      h('div', { class: 'pill pill-xp', title: G.totalXp(st) + ' XP' }, [icon('bolt'), h('strong', { text: String(G.totalXp(st)) }), h('span', { class: 'pill-label', text: 'XP' })])
    ]);
  }

  /** Séance proposée aujourd'hui : celle du plan s'il existe, sinon le module le plus faible. */
  function todaySuggestion() {
    var st = app.state, t = today();
    if (st.plan.testDate) {
      var plan = PL.buildPlan({ today: t, testDate: st.plan.testDate, weeks: st.plan.weeks, weak: STATS.weakest(st.log, MAIN_MODULES), minutes: G.goalMinutes(st) });
      var d = plan.filter(function (x) { return x.date === t; })[0];
      if (d) return { fromPlan: true, day: d, module: d.focus[0] };
    }
    return { fromPlan: false, module: STATS.weakest(st.log, MAIN_MODULES)[0] };
  }

  function startSuggestion(sug) {
    if (sug.module === 'complete') return startSim('complete');
    startTraining(sug.module);
  }

  function renderHome() {
    var st = app.state, t = today();
    G.settleStreak(st, t);
    var min = G.todayMinutes(st, t), goal = G.goalMinutes(st);
    var banners = [];
    if (app.pendingSim) banners.push(banner('warn', 'Une simulation est en cours : le chronomètre a continué.', { label: 'Reprendre', onClick: resumeSim }));
    if (!app.store.persistent) banners.push(banner('warn', 'Le stockage local est indisponible (navigation privée ?) : la progression sera perdue à la fermeture.'));
    if (app.contentErrors.length) banners.push(banner('warn', 'Une partie du contenu n\'a pas pu être chargée.'));
    if (sync.error && (sync.error.code === 'auth' || sync.error.code === 'scope')) banners.push(banner('warn', 'Synchronisation arrêtée : ' + sync.error.message, { label: 'Réglages', onClick: function () { goTab('reglages'); } }));
    var na = nextApp();
    if (na) {
      var left = U.diffDays(t, na.date);
      if (left <= 5) banners.push(banner('info', 'Test ' + na.cabinet + (left === 0 ? ' aujourd\'hui' : ' dans ' + left + ' jour' + (left > 1 ? 's' : '')) + ' : faites une simulation adaptée.', { label: 'Lancer', onClick: function () { startSim('custom', { sections: simFor(na.cabinet), label: 'Simulation adaptée ' + na.cabinet }); } }));
    }
    if (!sync.isConnected() && st.log.length > 150 && (!st.lastExport || now() - st.lastExport > 14 * 86400000)) {
      banners.push(banner('info', 'Pensez à sauvegarder votre progression.', { label: 'Exporter', onClick: function () { goTab('reglages'); } }));
    }

    var sug = todaySuggestion();
    var sugTitle = sug.module === 'complete' ? 'Simulation complète' : Q.MODULES[sug.module].title;
    var goalCard = h('section', { class: 'card' }, [
      h('div', { class: 'goal-top' }, [h('h2', { text: 'Objectif du jour' }), h('span', { class: 'goal-xp', text: Math.floor(min) + ' / ' + goal + ' min' })]),
      progressBar(min, goal),
      h('p', { class: 'due-line' }, sug.fromPlan ? ['Plan de préparation : ', h('strong', { text: sug.day.note })] : ['Séance conseillée : ', h('strong', { text: sugTitle }), ' (votre module le plus faible).']),
      h('button', { class: 'btn btn-primary btn-block', id: 'start-today', type: 'button', onclick: function () { startSuggestion(sug); } }, sug.module === 'complete' ? 'Lancer la simulation du jour' : 'S\'entraîner : ' + sugTitle)
    ]);

    var appCard = na ? h('section', { class: 'card' }, [
      h('div', { class: 'next-app' }, [
        h('div', {}, [h('p', { class: 'muted', text: 'Prochain test' }), h('h2', { text: na.cabinet + (na.poste ? ' — ' + na.poste : '') }), h('p', { class: 'muted', text: 'Date limite : ' + UI.formatDay(na.date) })]),
        h('p', { class: 'countdown' }, [String(U.diffDays(t, na.date)), h('small', { text: U.diffDays(t, na.date) > 1 ? 'jours' : 'jour' })])
      ])
    ]) : h('section', { class: 'card' }, [
      h('h2', { text: 'Prochain test' }),
      h('p', { class: 'muted', text: 'Ajoutez vos candidatures pour voir le compte à rebours et recevoir une simulation adaptée avant chaque test.' }),
      h('button', { class: 'btn btn-soft btn-block', type: 'button', onclick: function () { goTab('candidatures'); } }, 'Ajouter une candidature')
    ]);

    var levels = h('section', { class: 'card' }, [
      h('h2', { text: 'Niveau par module' }),
      h('div', { class: 'theme-list' }, Q.ORDER.map(function (m) {
        var M = Q.MODULES[m];
        return h('button', { class: 'theme-row', type: 'button', 'data-module': m, onclick: function () { openSub('module', m); } }, [
          h('span', { class: 'theme-icon', text: M.icon }),
          h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: M.title }), speedText(m)]),
          levelChip(m)
        ]);
      }))
    ]);

    setMain([
      h('header', { class: 'home-head' }, [h('p', { class: 'brand', text: 'Big4 Prep' }), pills()]),
      banners,
      goalCard,
      h('button', { class: 'btn btn-primary btn-block btn-hero', id: 'start-complete', type: 'button', onclick: function () { startSim('complete'); } }, 'Simulation complète (≈ 51 min)'),
      appCard,
      levels,
      h('div', { class: 'duo' }, [
        h('button', { class: 'btn btn-soft', type: 'button', onclick: function () { openSub('plan'); } }, [h('span', { class: 'btn-title', text: 'Plan de préparation' }), h('span', { class: 'btn-sub', text: st.plan.testDate ? 'Test le ' + UI.formatDay(st.plan.testDate) : '2 ou 4 semaines' })]),
        h('button', { class: 'btn btn-soft', type: 'button', onclick: function () { openSub('fiche', 'strategie'); } }, [h('span', { class: 'btn-title', text: 'Stratégie de temps' }), h('span', { class: 'btn-sub', text: 'Fiche à relire' })])
      ])
    ]);
  }

  /* ====================== Liste des modules ====================== */

  function renderModules() {
    var fiches = app.content.fiches;
    function ficheRow(id) {
      var f = fiches.filter(function (x) { return x.id === id; })[0];
      if (!f) return null;
      return h('button', { class: 'theme-row', type: 'button', onclick: function () { openSub('fiche', id); } }, [
        h('span', { class: 'theme-icon', text: f.icon }), h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: f.title }), h('span', { class: 'theme-meta', text: 'Fiche' })])
      ]);
    }
    setMain([
      h('h1', { class: 'page-title', text: 'S\'entraîner' }),
      h('p', { class: 'lead', text: 'Chaque module propose un entraînement avec correction détaillée et une simulation en conditions réelles.' }),
      h('div', { class: 'theme-list' }, Q.ORDER.map(function (m) {
        var M = Q.MODULES[m];
        var due = (m === 'technique' || m === 'sjt' || m === 'anglais') ? Q.countDue(itemsOf(m), app.state.cards, today()) : 0;
        return h('button', { class: 'theme-row', type: 'button', 'data-module': m, onclick: function () { openSub('module', m); } }, [
          h('span', { class: 'theme-icon', text: M.icon }),
          h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: M.title }), h('span', { class: 'theme-meta', text: due ? due + ' révision' + (due > 1 ? 's' : '') + ' à faire' : M.desc.split('.')[0] + '.' })]),
          levelChip(m)
        ]);
      })),
      h('h2', { class: 'section-title', text: 'Tests de personnalité et jeux' }),
      h('div', { class: 'theme-list' }, [
        ficheRow('personnalite'),
        h('button', { class: 'theme-row', type: 'button', id: 'open-games', onclick: function () { openSub('game', null); } }, [
          h('span', { class: 'theme-icon', text: '🎮' }), h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: 'Tests « jeux » : fiche et mini-jeux' }), h('span', { class: 'theme-meta', text: 'Familiarisation, pas une reproduction' })])
        ])
      ]),
      h('h2', { class: 'section-title', text: 'Fiches' }),
      h('div', { class: 'theme-list' }, [ficheRow('formats'), ficheRow('strategie'), ficheRow('verbal')])
    ]);
  }

  /* ====================== Écran d'un module ====================== */

  function renderModule(m) {
    var M = Q.MODULES[m], st = app.state, s = STATS.moduleStats(st.log, m), lv = STATS.levelLabel(s);
    var F = SC.FORMATS[m];
    var parts = [subHeader(M.title), h('p', { class: 'theme-desc', text: M.desc })];
    parts.push(h('div', { class: 'stat-row' }, [
      statBox(s.n ? Math.round(s.acc * 100) + ' %' : '–', 'réussite récente'),
      statBox(s.n ? Math.round(s.avgMs / 1000) + ' s' : '–', 'temps moyen'),
      statBox(lv.label, 'niveau')
    ]));
    parts.push(h('p', { class: 'cta-note', text: 'Temps cible : environ ' + M.target + ' s par question. ' + (s.n ? 'Vitesse : ' + (STATS.speedLabel(s) || '–') + '.' : '') }));

    if (m === 'anglais') {
      parts.push(h('section', { class: 'card' }, [
        h('h2', { text: 'Anglais : allez plus loin avec English Pro' }),
        h('p', { class: 'cta-note', text: 'Ce module ne contient que quelques questions de type test de recrutement. Votre application English Pro couvre l\'anglais professionnel en profondeur.' }),
        h('a', { class: 'btn btn-soft btn-block', href: ENGLISH_PRO_URL, target: '_blank', rel: 'noopener' }, 'Ouvrir English Pro')
      ]));
    }
    var actions = [h('button', { class: 'btn btn-primary btn-block', id: 'train-btn', type: 'button', onclick: function () { startTraining(m); } }, 'Entraînement (' + TRAIN_SIZE + ' questions)')];
    if (F) actions.push(h('button', { class: 'btn btn-soft btn-block', id: 'sim-btn', type: 'button', onclick: function () { startSim(m); } }, [
      h('span', { class: 'btn-title', text: 'Simulation' }), h('span', { class: 'btn-sub', text: F.n + ' questions en ' + F.minutes + ' minutes, sans retour en arrière' })
    ]));
    if (m === 'verbal') actions.push(h('button', { class: 'btn btn-quiet btn-block', type: 'button', onclick: function () { openSub('fiche', 'verbal'); } }, 'Fiche méthode : Vrai / Faux / On ne peut pas savoir'));
    parts.push(h('section', { class: 'card' }, actions));

    if (m === 'numerique' || m === 'abstrait') {
      var gens = m === 'numerique' ? BP.gen.numeric.GENS : BP.gen.abstract.GENS, gs = STATS.genStats(st.log, m);
      var errs = STATS.errorStats(st.log, m);
      var errKeys = Object.keys(errs).sort(function (a, b) { return errs[b] - errs[a]; });
      if (errKeys.length) {
        var maxE = errs[errKeys[0]];
        parts.push(h('section', { class: 'card' }, [
          h('h2', { text: 'Vos erreurs les plus fréquentes' }),
          h('div', { class: 'err-bars' }, errKeys.slice(0, 5).map(function (k) {
            return h('div', { class: 'err-row' }, [h('span', { text: Q.errLabel(m, k) }), h('strong', { text: String(errs[k]) }), progressBar(errs[k], maxE, 'bar-thin')]);
          })),
          h('p', { class: 'cta-note', text: 'L\'entraînement fait revenir plus souvent les types de questions que vous réussissez le moins.' })
        ]));
      }
      parts.push(h('h2', { class: 'section-title', text: 'S\'entraîner sur un type précis' }));
      parts.push(h('div', { class: 'theme-list' }, gens.map(function (g) {
        var x = gs[g.id];
        return h('button', { class: 'theme-row', type: 'button', 'data-gen': g.id, onclick: function () { startTraining(m, { gen: g.id, label: g.title }); } }, [
          h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: g.title }), h('span', { class: 'theme-meta', text: (g.skill ? g.skill + ' · ' : '') + 'difficulté ' + g.difficulty + '/3 · ' + g.targetSec + ' s' })]),
          h('span', { class: 'theme-pct', text: x && x.n ? Math.round(x.ok / x.n * 100) + ' %' : '–' })
        ]);
      })));
    }
    if (m === 'technique') {
      var themes = {};
      itemsOf('technique').forEach(function (it) { themes[it.theme] = (themes[it.theme] || 0) + 1; });
      var terr = STATS.errorStats(st.log, 'technique');
      parts.push(h('h2', { class: 'section-title', text: 'Par thème' }));
      parts.push(h('div', { class: 'theme-list' }, Object.keys(themes).sort(function (a, b) { return (terr[b] || 0) - (terr[a] || 0) || themes[b] - themes[a]; }).map(function (th) {
        return h('button', { class: 'theme-row', type: 'button', onclick: function () { startTraining('technique', { filter: function (it) { return it.theme === th; }, label: Q.THEMES[th] || th }); } }, [
          h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: Q.THEMES[th] || th }), h('span', { class: 'theme-meta', text: themes[th] + ' questions' + (terr[th] ? ' · ' + terr[th] + ' erreur(s) récente(s)' : '') })])
        ]);
      })));
    }
    setMain(parts, 'main-sub');
  }

  /* ====================== Lancement d'une série de questions ====================== */

  function newRunId() { return 'run-' + app.state.deviceId + '-' + now().toString(36); }

  function queueFor(module, n, opts) {
    return Q.buildQueue(module, {
      content: app.content, state: app.state, today: today(), rng: Math.random, pref: app.state.settings.questionLang,
      n: n, gen: opts && opts.gen, filter: opts && opts.filter, sim: !!(opts && opts.sim)
    });
  }

  /** Entraînement : correction après chaque question, chrono indicatif. */
  function startTraining(module, opts) {
    opts = opts || {};
    var queue = queueFor(module, TRAIN_SIZE, opts);
    if (!queue.length) { UI.toast('Aucune question disponible pour ce module.'); return; }
    closeSheet();
    app.run = {
      id: newRunId(), mode: 'train', module: module, label: opts.label || Q.MODULES[module].title, opts: { gen: opts.gen || null },
      filter: opts.filter || null,
      sections: [{ module: module, n: queue.length, minutes: null, start: now(), queue: queue, answers: [] }],
      sec: 0, idx: 0, qStart: now(), phase: 'answer', scratch: {}, startedAt: now()
    };
    openSub('run');
  }

  /**
   * Simulation : conditions réelles. kind = module | 'complete' | 'custom' (opts.sections, opts.label).
   * Chaque section a son propre chronomètre, lancé quand on commence la section.
   */
  function startSim(kind, opts) {
    opts = opts || {};
    var F = SC.FORMATS[kind], sections;
    if (kind === 'complete' || kind === 'custom') sections = (opts.sections || SC.FORMATS.complete.sections).map(function (s) { return { module: s.module, n: s.n, minutes: s.minutes }; });
    else sections = [{ module: kind, n: F.n, minutes: F.minutes }];
    sections.forEach(function (s) {
      s.queue = queueFor(s.module, s.n, { sim: true });
      s.n = s.queue.length; s.start = null; s.answers = [];
    });
    closeSheet();
    app.run = {
      id: newRunId(), mode: 'sim', module: kind === 'custom' ? 'complete' : kind,
      label: opts.label || (F ? 'Simulation — ' + F.label : 'Simulation'),
      sections: sections, sec: 0, idx: 0, qStart: null, phase: 'intro', scratch: {}, startedAt: now()
    };
    app.pendingSim = null;
    app.store.saveSim(app.run);
    openSub('run');
  }

  function resumeSim() {
    if (!app.pendingSim) return;
    app.run = app.pendingSim; app.pendingSim = null;
    openSub('run');
    checkExpiry();
  }

  function curSection() { return app.run.sections[app.run.sec]; }
  function curQ() { var s = curSection(); return s.queue[app.run.idx]; }

  function persistSim() { if (app.run && app.run.mode === 'sim') app.store.saveSim(app.run); }

  /** Enregistre la réponse à la question en cours. resp = null : question passée ou non traitée. */
  function record(resp, reason) {
    var run = app.run, s = curSection(), q = curQ(), t = now();
    var ms = run.qStart ? TM.questionTime(run.qStart, t) : 0;
    var ev = Q.evaluate(q, resp);
    var ans = { resp: resp, points: ev.points, err: ev.err, ms: ms, targetSec: q.targetSec, module: q.module, result: ev.result };
    s.answers[run.idx] = ans;
    var st = app.state;
    // Journal (statistiques, adaptation) — une question non traitée compte comme ratée sans type d'erreur
    ST.logAnswer(st, { m: q.module, g: q.g, ok: ev.points == null ? 0 : (ev.points >= 1 ? 1 : ev.points >= 0.5 ? 0.5 : 0), ms: ms, tgt: q.targetSec, e: ev.points == null ? (reason || 'non-repondu') : ev.err, s: run.mode === 'sim' ? 's' : 't', l: q.lang }, t);
    // Répétition espacée (technique, SJT, anglais)
    if (q.srs && ev.points != null) st.cards[q.srs] = SRS.review(st.cards[q.srs], ev.result === 'correct' ? 'correct' : ev.result === 'almost' ? 'almost' : 'wrong', today(), t);
    if (q.passage) st.seenPassages[q.passage.id] = today();
    var xp = ev.points == null ? 0 : ev.result === 'correct' ? G.XP.correct : ev.result === 'almost' ? G.XP.almost : G.XP.wrong;
    var g = G.addActivity(st, xp, ms, today());
    app.store.save(st);
    if (g.reachedNow) UI.toast(g.freezeEarned ? 'Objectif du jour atteint ! Un gel de série gagné.' : 'Objectif du jour atteint !');
    return { ans: ans, ev: ev };
  }

  /* ---------- Chronomètre ---------- */

  function startTick() {
    stopTick();
    app.tick = setInterval(function () { updateClock(); checkExpiry(); }, 500);
  }
  function stopTick() { if (app.tick) { clearInterval(app.tick); app.tick = null; } }

  function updateClock() {
    var el = document.getElementById('run-clock');
    if (!el || !app.run) return;
    var run = app.run, s = curSection(), t = now();
    if (run.mode === 'sim' && s.start != null) {
      var rem = TM.remaining(TM.countdown(s.start, s.minutes * 60000), t);
      el.textContent = TM.format(rem);
      el.className = 'clock' + (rem < 60000 ? ' is-low' : '');
    } else if (run.mode === 'train' && run.qStart && run.phase === 'answer') {
      var q = curQ(), e = t - run.qStart;
      el.textContent = TM.format(e) + ' / ' + TM.format(q.targetSec * 1000);
      el.className = 'clock' + (e > q.targetSec * 1000 ? ' is-over' : '');
    }
  }

  /** Temps écoulé en simulation : la section se termine, les questions restantes sont non traitées. */
  function checkExpiry() {
    var run = app.run;
    if (!run || run.mode !== 'sim' || run.phase !== 'answer') return;
    var s = curSection();
    if (s.start == null || !TM.expired(TM.countdown(s.start, s.minutes * 60000), now())) return;
    // Une réponse complète déjà sélectionnée mais non validée est prise en compte.
    var pending = app.currentView ? app.currentView.response() : null;
    record(pending, 'non-repondu');
    for (var i = run.idx + 1; i < s.queue.length; i++) {
      s.answers[i] = { resp: null, points: null, err: null, ms: 0, targetSec: s.queue[i].targetSec, module: s.queue[i].module, result: 'skipped' };
      ST.logAnswer(app.state, { m: s.queue[i].module, g: s.queue[i].g, ok: 0, ms: 0, tgt: s.queue[i].targetSec, e: 'non-repondu', s: 's', l: s.queue[i].lang }, now());
    }
    app.store.save(app.state);
    UI.toast('Temps écoulé pour cette section.');
    endSection();
  }

  function endSection() {
    var run = app.run;
    if (run.sec < run.sections.length - 1) {
      run.sec++; run.idx = 0; run.phase = 'intro'; run.qStart = null;
      persistSim(); renderRun();
    } else finishRun();
  }

  /* ---------- Écran de question ---------- */

  function renderRun() {
    var run = app.run;
    if (!run) { closeSub(); return; }
    var s = curSection();
    if (run.phase === 'intro') return renderSectionIntro();
    var q = curQ();
    if (!run.qStart) run.qStart = now();
    var calcAllowed = q.module === 'numerique' || q.module === 'technique';
    var head = h('div', { class: 'run-head' }, [
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Quitter', onclick: quitRun, html: ICONS.close }),
      h('div', { class: 'bar bar-session' }, h('div', { class: 'bar-fill', style: 'width:' + Math.round(run.idx / s.queue.length * 100) + '%' })),
      h('span', { class: 'run-count', text: (run.idx + 1) + '/' + s.queue.length }),
      (run.mode === 'sim' || app.state.settings.indicativeTimer) ? h('span', { class: 'clock', id: 'run-clock', 'aria-live': 'off' }) : null,
      calcAllowed ? h('button', { class: 'calc-btn', type: 'button', id: 'calc-open', 'aria-label': 'Calculatrice et brouillon', onclick: function () { openSheet('calc'); }, html: ICONS.calc }) : null
    ]);
    var meta = h('div', { class: 'ex-meta row' }, [
      h('span', { class: 'tag', text: Q.MODULES[q.module].short + (run.sections.length > 1 ? ' · section ' + (run.sec + 1) + '/' + run.sections.length : '') }),
      q.lang === 'en' ? h('span', { class: 'tag', text: 'EN' }) : null
    ]);
    var view, checkBtn, skipBtn;
    view = Q.renderQuestion(q, { onChange: function () { if (checkBtn) checkBtn.disabled = !view.response(); } });
    app.currentView = view;
    var foot;
    if (run.mode === 'train') {
      checkBtn = h('button', { class: 'btn btn-primary btn-block', id: 'check', type: 'button', disabled: true, onclick: function () {
        var resp = view.response();
        if (!resp) return;
        var r = record(resp);
        run.phase = 'feedback';
        view.lock(r.ev);
        showFeedback(q, resp, r);
      } }, 'Valider');
      foot = h('div', { class: 'session-foot', id: 'foot' }, [checkBtn]);
    } else {
      checkBtn = h('button', { class: 'btn btn-primary btn-block', id: 'check', type: 'button', disabled: true, onclick: function () {
        var resp = view.response();
        if (!resp) return;
        record(resp); next();
      } }, run.idx === s.queue.length - 1 ? 'Valider et terminer la section' : 'Valider et suivante');
      skipBtn = h('button', { class: 'btn btn-quiet btn-block', id: 'skip', type: 'button', onclick: function () { record(null, 'passe'); next(); } }, 'Passer (sans retour possible)');
      foot = h('div', { class: 'session-foot', id: 'foot' }, [checkBtn, skipBtn]);
    }
    setMain([head, meta, h('div', { class: 'session-body', 'data-q': q.qid, 'data-module': q.module }, view.el), foot], 'main-sub main-session' + (app.sheet ? ' with-sheet' : ''));
    updateClock();
    if (app.sheet) renderSheet();
    startTick();
  }

  function next() {
    var run = app.run, s = curSection();
    if (app.sheet && app.sheet.tab === 'calc') { /* la calculatrice reste ouverte */ }
    if (run.idx < s.queue.length - 1) {
      run.idx++; run.qStart = now(); run.phase = 'answer';
      persistSim();
      renderRun();
      window.scrollTo(0, 0);
    } else if (run.mode === 'sim') endSection();
    else finishRun();
  }

  function showFeedback(q, resp, r) {
    var foot = document.getElementById('foot');
    var res = r.ev.result;
    var title = res === 'correct' ? 'Bonne réponse' : res === 'almost' ? 'Presque' : 'Réponse incorrecte';
    var cont = h('button', { class: 'btn btn-block btn-continue', id: 'continue', type: 'button', onclick: function () { next(); } }, app.run.idx === curSection().queue.length - 1 ? 'Voir le bilan' : 'Continuer');
    var fb = h('div', { class: 'feedback fb-' + (res === 'correct' ? 'correct' : res === 'almost' ? 'almost' : 'wrong'), role: 'status' }, [
      h('p', { class: 'fb-title', text: title }),
      Q.feedbackBody(q, resp, r.ev, r.ans.ms),
      cont
    ]);
    UI.clear(foot);
    foot.className = 'session-foot has-feedback';
    foot.appendChild(fb);
    var clock = document.getElementById('run-clock');
    if (clock) clock.textContent = TM.format(r.ans.ms);
    setTimeout(function () { try { fb.scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (e) { /* rien */ } }, 50);
  }

  function renderSectionIntro() {
    var run = app.run, s = curSection(), M = Q.MODULES[s.module];
    stopTick();
    var tips = {
      numerique: 'Lisez la question avant le tableau. Calculatrice et brouillon : bouton en haut à droite.',
      verbal: 'Jugez uniquement d\'après le texte. « On ne peut pas savoir » quand le texte ne permet pas de trancher.',
      abstrait: 'Isolez chaque élément (forme, couleur, nombre, position) et cherchez sa règle séparément.',
      sjt: 'Pas de piège de vitesse : lisez toutes les options. Pensez qualité, intégrité, transparence avec le responsable.',
      technique: 'Questions de cours et petits calculs. Calculatrice disponible.',
      anglais: 'Questions courtes : répondez vite et passez.'
    };
    setMain([
      subHeader(run.label, quitRun),
      h('section', { class: 'card' }, [
        h('p', { class: 'muted', text: run.sections.length > 1 ? 'Section ' + (run.sec + 1) + ' sur ' + run.sections.length : 'Simulation' }),
        h('h2', { text: M.icon + ' ' + M.title }),
        h('div', { class: 'stat-row' }, [statBox(String(s.queue.length), 'questions'), statBox(s.minutes + ' min', 'chronomètre'), statBox(Math.round(s.minutes * 60 / s.queue.length) + ' s', 'par question')]),
        h('p', { class: 'cta-note', text: tips[s.module] }),
        h('p', { class: 'cta-note', text: 'Pas de correction avant la fin. Une question validée ou passée ne peut plus être modifiée. Le chronomètre continue même si vous quittez l\'application.' }),
        h('button', { class: 'btn btn-primary btn-block btn-hero', id: 'start-section', type: 'button', onclick: function () {
          s.start = now(); run.phase = 'answer'; run.idx = 0; run.qStart = now();
          persistSim(); renderRun();
        } }, 'Démarrer le chronomètre')
      ])
    ], 'main-sub');
  }

  function quitRun() {
    var run = app.run;
    if (!run) return closeSub();
    if (run.mode === 'train') {
      var done = run.sections[0].answers.filter(Boolean).length;
      if (!done) { stopTick(); app.run = null; closeSub(); return; }
      UI.confirmModal('Arrêter l\'entraînement ?', 'Vos ' + done + ' réponse(s) sont enregistrées. Vous verrez le bilan de cette série.', 'Voir le bilan', function () { finishRun(); });
      return;
    }
    UI.modal({
      title: 'Quitter la simulation ?',
      body: 'Le chronomètre ne s\'arrête pas : comme dans un vrai test, il continue de tourner. Vous pouvez revenir plus tard depuis l\'accueil, ou terminer maintenant (les questions restantes seront comptées comme non traitées).',
      actions: [
        { label: 'Continuer le test' },
        { label: 'Revenir plus tard', onClick: function () { persistSim(); stopTick(); app.pendingSim = app.run; app.run = null; closeSheet(); closeSub(); } },
        { label: 'Terminer maintenant', kind: 'danger', onClick: function () { abandonSim(); } }
      ]
    });
  }

  function abandonSim() {
    var run = app.run;
    run.sections.forEach(function (s, si) {
      if (si < run.sec) return;
      for (var i = 0; i < s.queue.length; i++) {
        if (si === run.sec && i < run.idx) continue;
        if (s.answers[i]) continue;
        s.answers[i] = { resp: null, points: null, err: null, ms: 0, targetSec: s.queue[i].targetSec, module: s.queue[i].module, result: 'skipped' };
        ST.logAnswer(app.state, { m: s.queue[i].module, g: s.queue[i].g, ok: 0, ms: 0, tgt: s.queue[i].targetSec, e: 'non-repondu', s: 's', l: s.queue[i].lang }, now());
      }
    });
    finishRun();
  }

  /** Fin d'une série : bilan (et XP de simulation). */
  function finishRun() {
    var run = app.run;
    stopTick(); closeSheet();
    var all = [];
    run.sections.forEach(function (s) { s.queue.forEach(function (q, i) { all.push({ q: q, a: s.answers[i] || { resp: null, points: null, ms: 0, targetSec: q.targetSec, module: q.module, result: 'skipped' } }); }); });
    if (run.mode === 'train') all = all.filter(function (x) { return x.a && x.a.result !== 'skipped'; });
    var summary = SC.summarize(all.map(function (x) { return x.a; }), run.module, now() - run.startedAt);
    var st = app.state;
    st.sessions = (st.sessions | 0) + 1;
    if (run.mode === 'sim') {
      G.addActivity(st, G.XP.simulation, 0, today());
      st.sims.push({ id: run.id, ts: now(), module: run.module, n: summary.n, correct: summary.correct, skipped: summary.skipped, pct: summary.pct, avgMs: summary.avgMs, percentile: summary.percentile, durMs: summary.durMs, label: run.label });
      if (st.sims.length > 300) st.sims = st.sims.slice(-300);
      app.store.saveSim(null);
    }
    app.store.save(st);
    app.report = { run: run, all: all, summary: summary };
    app.run = null;
    app.sub = 'report';
    render();
    window.scrollTo(0, 0);
    if (sync.pending || sync.isConnected()) scheduleSync(1500);
  }

  /* ====================== Bilan ====================== */

  function renderReport() {
    var rep = app.report;
    if (!rep) return closeSub();
    var run = rep.run, sm = rep.summary, isSim = run.mode === 'sim';
    var parts = [subHeader(isSim ? 'Bilan de la simulation' : 'Bilan de l\'entraînement', function () { app.report = null; closeSub(); })];
    parts.push(h('section', { class: 'card center' }, [
      h('p', { class: 'muted', text: run.label }),
      h('p', { class: 'big-score', text: U.fmtNum(sm.correct, 'fr', sm.correct % 1 ? 1 : 0) + ' / ' + sm.n }),
      h('p', { text: U.fmtNum(sm.pct, 'fr', 0) + ' % de réussite' + (sm.skipped ? ' · ' + sm.skipped + ' non traitée(s)' : '') }),
      isSim ? h('p', { class: 'percentile' }, ['Percentile indicatif : ', h('strong', { text: sm.percentile + 'e' })]) : null,
      isSim ? h('p', { class: 'note-estim', text: 'Estimation calculée sur un groupe de référence fictif (voir DECISIONS.md) : les éditeurs comparent à leurs propres normes, inconnues. Utilisez-la pour suivre votre progression, pas comme une prévision.' }) : null
    ]));
    var slow = sm.slow.length;
    parts.push(h('div', { class: 'stat-row' }, [
      statBox(Math.round(sm.avgMs / 1000) + ' s', 'par question'),
      statBox(String(slow), 'trop lente' + (slow > 1 ? 's' : '')),
      statBox(TM.format(sm.durMs), 'durée totale')
    ]));
    if (isSim && run.sections.length > 1) {
      parts.push(h('section', { class: 'card' }, [h('h2', { text: 'Par section' }), h('table', { class: 'table' }, [
        h('thead', {}, h('tr', {}, [h('th', { text: 'Module' }), h('th', { text: 'Score' }), h('th', { text: 'Percentile' })])),
        h('tbody', {}, run.sections.map(function (s) {
          var b = sm.byModule[s.module] || { n: 0, points: 0 };
          var rate = b.n ? b.points / b.n : 0;
          return h('tr', {}, [h('th', { text: Q.MODULES[s.module].short }), h('td', { text: U.fmtNum(b.points, 'fr', b.points % 1 ? 1 : 0) + '/' + b.n }), h('td', { text: SC.percentile(s.module, rate) + 'e' })]);
        }))
      ])]));
    }
    // Erreurs par type
    var errs = {};
    rep.all.forEach(function (x) {
      if (x.a.points != null && x.a.points < 1 && x.a.err) { var k = x.q.module + '|' + x.a.err; errs[k] = (errs[k] || 0) + 1; }
    });
    var keys = Object.keys(errs).sort(function (a, b) { return errs[b] - errs[a]; });
    if (keys.length) {
      parts.push(h('section', { class: 'card' }, [h('h2', { text: 'Erreurs par type' }), h('div', { class: 'err-bars' }, keys.map(function (k) {
        var p = k.split('|');
        return h('div', { class: 'err-row' }, [h('span', { text: (run.sections.length > 1 ? Q.MODULES[p[0]].short + ' — ' : '') + Q.errLabel(p[0], p[1]) }), h('strong', { text: String(errs[k]) }), progressBar(errs[k], errs[keys[0]], 'bar-thin')]);
      }))]));
    }
    if (slow) parts.push(h('p', { class: 'cta-note', text: 'Questions trop lentes (plus de 1,5 fois le temps cible) : ' + sm.slow.map(function (i) { return '#' + (i + 1); }).join(', ') + '. Revoyez les raccourcis dans la correction.' }));
    // Revue question par question
    parts.push(h('h2', { class: 'section-title', text: 'Correction détaillée' }));
    parts.push(h('div', { class: 'review-list' }, rep.all.map(function (x, i) {
      var a = x.a, cls = a.result === 'skipped' ? 'tag-skip' : a.points >= 1 ? 'tag-ok' : 'tag-ko';
      var lab = a.result === 'skipped' ? 'Non traitée' : a.points >= 1 ? 'Juste' : a.points > 0 ? 'Partiel' : 'Faux';
      var body = [];
      if (x.q.passage) body.push(h('p', { class: 'muted', text: 'Texte : ' + x.q.passage.title }));
      if (x.q.kind !== 'sjt-bw' && x.q.kind !== 'sjt-rank' && a.resp && a.resp.idx != null) body.push(h('p', { text: 'Votre réponse : ' + (x.q.choices[a.resp.idx].text || Q.LETTERS.charAt(a.resp.idx)) }));
      if (a.resp && a.resp.best != null) body.push(h('p', { text: 'Votre choix : plus efficace ' + Q.LETTERS.charAt(a.resp.best) + ', moins efficace ' + Q.LETTERS.charAt(a.resp.worst) }));
      if (a.resp && a.resp.order) body.push(h('p', { text: 'Votre classement : ' + a.resp.order.map(function (k) { return Q.LETTERS.charAt(k); }).join(' > ') }));
      body = body.concat(Q.feedbackBody(x.q, a.resp, { points: a.points, err: a.err }, a.ms));
      return h('details', { class: 'review-item' }, [h('summary', {}, [h('span', { class: 'tag ' + cls, text: lab }), h('span', { text: (i + 1) + '. ' + Q.shortLabel(x.q) })]), h('div', { class: 'modal-body' }, body)]);
    })));
    var again = h('button', { class: 'btn btn-primary btn-block', id: 'again', type: 'button', onclick: function () {
      app.report = null; app.sub = null;
      if (isSim) startSim(run.module === 'complete' ? 'complete' : run.module);
      else startTraining(run.module, { gen: run.opts && run.opts.gen, filter: run.filter, label: run.label });
    } }, isSim ? 'Nouvelle simulation' : 'Enchaîner 10 questions');
    parts.push(again);
    parts.push(h('button', { class: 'btn btn-quiet btn-block', type: 'button', onclick: function () { app.report = null; closeSub(); } }, 'Retour'));
    setMain(parts, 'main-sub');
  }

  /* ====================== Calculatrice et brouillon ====================== */

  var calcState = { expr: '', ans: null, last: '' };

  function openSheet(tab) { app.sheet = { tab: tab || 'calc' }; renderSheet(); main.classList.add('with-sheet'); }
  function closeSheet() {
    app.sheet = null;
    var layer = document.getElementById('sheet-layer');
    if (layer) UI.clear(layer);
    if (main) main.classList.remove('with-sheet');
  }

  function calcPress(k) {
    var e = calcState.expr;
    if (k === 'C') { calcState.expr = ''; calcState.last = ''; }
    else if (k === '⌫') calcState.expr = e.slice(0, -1);
    else if (k === '=') {
      var r = CALC.evaluate(e);
      if (r.ok) { calcState.last = e.replace(/\*/g, '×').replace(/\//g, '÷') + ' ='; calcState.ans = r.value; calcState.expr = CALC.display(r.value).replace('−', '-'); }
      else calcState.last = r.error;
    } else if (k === 'ANS') { if (calcState.ans != null) calcState.expr = e + CALC.display(calcState.ans).replace('−', '-'); }
    else if (k === '±') calcState.expr = e ? '-(' + e + ')' : '-';
    else calcState.expr = e + k;
    paintCalc();
  }

  function paintCalc() {
    var ex = document.getElementById('calc-expr'), val = document.getElementById('calc-val');
    if (!ex || !val) return;
    var shown = calcState.expr.replace(/\*/g, '×').replace(/\//g, '÷').replace(/-/g, '−');
    ex.textContent = calcState.last || '';
    var r = calcState.expr ? CALC.evaluate(calcState.expr) : null;
    val.textContent = shown || '0';
    if (r && r.ok && /[+\-*/%()]/.test(calcState.expr.replace(/^-/, ''))) ex.textContent = (calcState.last ? calcState.last + '  ' : '') + '= ' + CALC.display(r.value);
  }

  function renderSheet() {
    var layer = document.getElementById('sheet-layer');
    UI.clear(layer);
    if (!app.sheet || !app.run) return;
    var q = curQ(), tab = app.sheet.tab;
    var tabs = h('div', { class: 'sheet-tabs' }, [
      h('button', { class: 'sheet-tab', type: 'button', 'aria-pressed': String(tab === 'calc'), onclick: function () { app.sheet.tab = 'calc'; renderSheet(); } }, 'Calculatrice'),
      h('button', { class: 'sheet-tab', type: 'button', id: 'scratch-tab', 'aria-pressed': String(tab === 'scratch'), onclick: function () { app.sheet.tab = 'scratch'; renderSheet(); } }, 'Brouillon')
    ]);
    var body;
    if (tab === 'calc') {
      var K = [['C', 'fn'], ['(', 'op'], [')', 'op'], ['%', 'op'], ['/', 'op', '÷'],
        ['7'], ['8'], ['9'], ['⌫', 'fn'], ['*', 'op', '×'],
        ['4'], ['5'], ['6'], ['ANS', 'fn'], ['-', 'op', '−'],
        ['1'], ['2'], ['3'], ['±', 'fn'], ['+', 'op'],
        ['0'], ['00'], [','], ['=', 'eq', '=']];
      body = h('div', {}, [
        h('div', { class: 'calc-screen', 'aria-live': 'polite' }, [h('div', { class: 'calc-expr', id: 'calc-expr' }), h('div', { class: 'calc-val', id: 'calc-val' })]),
        h('div', { class: 'calc-keys' }, K.map(function (k) {
          return h('button', { class: 'ck' + (k[1] ? ' ck-' + k[1] : ''), type: 'button', 'data-k': k[0], style: k[0] === '=' ? 'grid-column: span 2' : null, onclick: function () { calcPress(k[0]); } }, k[2] || k[0]);
        }))
      ]);
    } else {
      var ta = h('textarea', { class: 'input scratch', id: 'scratch', placeholder: 'Notez vos calculs intermédiaires…', 'aria-label': 'Brouillon' });
      ta.value = app.run.scratch[q.qid] || '';
      ta.addEventListener('input', function () { app.run.scratch[q.qid] = ta.value; });
      body = h('div', {}, [ta, h('p', { class: 'cta-note', text: 'Le brouillon est propre à chaque question et n\'est pas noté.' })]);
    }
    layer.appendChild(h('div', { class: 'sheet', role: 'dialog', 'aria-label': 'Calculatrice et brouillon' }, [
      h('div', { class: 'sheet-head' }, [tabs, h('button', { class: 'icon-btn', type: 'button', id: 'calc-close', 'aria-label': 'Fermer', onclick: closeSheet, html: ICONS.close })]),
      body
    ]));
    if (tab === 'calc') paintCalc();
  }

  document.addEventListener('keydown', function (ev) {
    if (!app.sheet || app.sheet.tab !== 'calc' || /input|textarea|select/i.test((ev.target && ev.target.tagName) || '')) return;
    var map = { Enter: '=', '=': '=', Backspace: '⌫', Escape: 'C', 'x': '*', 'X': '*' };
    var k = map[ev.key] || (/^[0-9+\-*/().,%]$/.test(ev.key) ? ev.key : null);
    if (k) { ev.preventDefault(); calcPress(k); }
  });

  /* ====================== Fiches ====================== */

  function renderFiche(id) {
    var f = app.content.fiches.filter(function (x) { return x.id === id; })[0];
    if (!f) return closeSub();
    setMain([
      subHeader(f.title),
      h('p', { class: 'lead', text: f.intro }),
      f.sections.map(function (s) {
        return h('section', { class: 'card fiche' }, [h('h2', { text: s.h }), h('ul', {}, s.p.map(function (p) { return h('li', { text: p }); }))]);
      }),
      id === 'jeux' ? h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: function () { openSub('game', null); } }, 'Essayer les mini-jeux') : null
    ], 'main-sub');
  }

  /* ====================== Mini-jeux ====================== */

  function renderGame(id) {
    if (app.stopGame) { app.stopGame(); app.stopGame = null; }
    if (!id) {
      var f = app.content.fiches.filter(function (x) { return x.id === 'jeux'; })[0];
      setMain([
        subHeader('Tests « jeux »'),
        h('p', { class: 'lead', text: f ? f.intro : '' }),
        h('div', { class: 'theme-list' }, BP.games.GAMES.map(function (g) {
          return h('button', { class: 'theme-row', type: 'button', 'data-game': g.id, onclick: function () { app.subData = g.id; render(); } }, [
            h('span', { class: 'theme-icon', text: g.icon }), h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: g.title }), h('span', { class: 'theme-meta', text: g.skill })])
          ]);
        })),
        h('button', { class: 'btn btn-soft btn-block', type: 'button', onclick: function () { openSub('fiche', 'jeux'); } }, 'Lire la fiche : ce que mesurent ces tests')
      ], 'main-sub');
      return;
    }
    var g = BP.games.GAMES.filter(function (x) { return x.id === id; })[0];
    var zone = h('div', { class: 'ex', id: 'game-zone' });
    var started = now();
    setMain([
      subHeader(g.title, function () { if (app.stopGame) app.stopGame(); app.stopGame = null; app.subData = null; render(); }),
      h('p', { class: 'theme-desc', text: g.desc }),
      h('p', { class: 'note-estim', text: 'Familiarisation uniquement : ce jeu s\'inspire des compétences mesurées, il ne reproduit pas un test d\'éditeur.' }),
      zone
    ], 'main-sub');
    app.stopGame = BP.games.start(id, zone, function (res) {
      app.stopGame = null;
      var gl = G.addActivity(app.state, G.XP.game, TM.questionTime(started, now(), 15 * 60000), today());
      save();
      if (gl.reachedNow) UI.toast('Objectif du jour atteint !');
      UI.clear(zone);
      UI.append(zone, [
        h('section', { class: 'card' }, [h('h2', { text: 'Résultat' }), h('p', { text: res.text }), h('p', { class: 'fb-tip', text: res.tip })]),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: function () { render(); } }, 'Rejouer'),
        h('button', { class: 'btn btn-quiet btn-block', type: 'button', onclick: function () { app.subData = null; render(); } }, 'Autres jeux')
      ]);
    });
  }

  /* ====================== Plan de préparation ====================== */

  var TYPE_LABEL = { entrainement: 'Entraînement', simulation: 'Simulation complète', leger: 'Révision légère' };

  function renderPlan() {
    var st = app.state, t = today();
    var dateInput = h('input', { class: 'input', type: 'date', id: 'plan-date', value: st.plan.testDate || '', min: U.addDays(t, 1), 'aria-label': 'Date du test' });
    dateInput.addEventListener('change', function () {
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateInput.value)) { st.plan.testDate = dateInput.value; st.plan.updatedAt = now(); save(); renderPlan(); }
    });
    var na = nextApp();
    var weeksSeg = segmented('Durée de préparation', [{ value: 2, label: '2 semaines' }, { value: 4, label: '4 semaines' }], st.plan.weeks, function (v) { st.plan.weeks = v; st.plan.updatedAt = now(); save(); renderPlan(); }, 'weeks-seg');
    var plan = st.plan.testDate ? PL.buildPlan({ today: t, testDate: st.plan.testDate, weeks: st.plan.weeks, weak: STATS.weakest(st.log, MAIN_MODULES), minutes: G.goalMinutes(st) }) : [];
    var list = plan.length ? h('ol', { class: 'plan-list' }, plan.map(function (d) {
      var isToday = d.date === t;
      return h('li', { class: 'plan-day plan-type-' + d.type + (isToday ? ' is-today' : '') }, [
        h('span', { class: 'plan-date' }, [UI.formatDay(d.date).slice(0, 5), h('br'), h('small', { class: 'muted', text: 'J−' + d.daysLeft })]),
        h('span', {}, [
          h('strong', { text: TYPE_LABEL[d.type] + ' · ' + d.minutes + ' min' }), h('br'),
          h('span', { class: 'muted', text: d.note }),
          isToday ? h('button', { class: 'btn btn-primary btn-block', type: 'button', style: 'margin-top:8px', onclick: function () { startSuggestion({ module: d.focus[0] }); } }, 'Commencer') : null
        ])
      ]);
    })) : h('p', { class: 'empty', text: st.plan.testDate ? 'La date du test est passée ou trop proche : choisissez une date future.' : 'Indiquez la date de votre prochain test pour obtenir un plan jour par jour.' });
    setMain([
      subHeader('Plan de préparation'),
      h('section', { class: 'card form' }, [
        h('label', { class: 'field' }, [h('span', { text: 'Date du test' }), dateInput]),
        na ? h('button', { class: 'btn btn-soft btn-block', type: 'button', onclick: function () { st.plan.testDate = na.date; st.plan.updatedAt = now(); save(); renderPlan(); } }, 'Utiliser la date de ' + na.cabinet + ' (' + UI.formatDay(na.date) + ')') : null,
        weeksSeg,
        h('p', { class: 'cta-note', text: 'Le plan suit votre objectif quotidien (' + G.goalMinutes(st) + ' min) et donne plus de place à vos modules les plus faibles. Une simulation complète chaque semaine et à J−2 ; la veille, révision légère.' })
      ]),
      list
    ], 'main-sub');
  }

  /* ====================== Candidatures ====================== */

  function appForm(existing) {
    var a = existing || { cabinet: 'Deloitte', poste: 'Auditeur financier junior', date: '', statut: 'a-passer', note: '' };
    var firm = h('select', { class: 'input', id: 'app-firm' }, FIRMS.map(function (f) { return h('option', { value: f, selected: a.cabinet === f || (f === 'Autre' && FIRMS.indexOf(a.cabinet) === -1) ? true : null }, f); }));
    var other = h('input', { class: 'input', id: 'app-other', placeholder: 'Nom du cabinet', value: FIRMS.indexOf(a.cabinet) === -1 ? a.cabinet : '' });
    var poste = h('input', { class: 'input', id: 'app-poste', value: a.poste || '', placeholder: 'Intitulé du poste' });
    var date = h('input', { class: 'input', id: 'app-date', type: 'date', value: a.date || '' });
    var statut = h('select', { class: 'input', id: 'app-statut' }, ST.STATUSES.map(function (s) { return h('option', { value: s, selected: a.statut === s ? true : null }, STATUS_LABEL[s]); }));
    var note = h('textarea', { class: 'input', id: 'app-note', rows: '2', placeholder: 'Note (lien de l\'invitation, type de tests annoncés…)' });
    note.value = a.note || '';
    var err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    function syncOther() { other.hidden = firm.value !== 'Autre'; }
    firm.addEventListener('change', syncOther); syncOther();
    UI.modal({
      title: existing ? 'Modifier la candidature' : 'Nouvelle candidature',
      body: h('div', { class: 'form' }, [
        h('label', { class: 'field' }, [h('span', { text: 'Cabinet' }), firm, other]),
        h('label', { class: 'field' }, [h('span', { text: 'Poste' }), poste]),
        h('label', { class: 'field' }, [h('span', { text: 'Date limite du test' }), date]),
        h('label', { class: 'field' }, [h('span', { text: 'Statut' }), statut]),
        h('label', { class: 'field' }, [h('span', { text: 'Note' }), note]),
        err
      ]),
      actions: [{ label: 'Annuler' }, { label: 'Enregistrer', kind: 'primary', onClick: function () {
        var res = ST.saveApp(app.state, { id: existing && existing.id, cabinet: firm.value === 'Autre' ? other.value : firm.value, poste: poste.value, date: date.value || null, statut: statut.value, note: note.value }, now());
        if (!res.ok) { err.textContent = res.error; err.hidden = false; return false; }
        save(); renderApps(); UI.toast('Candidature enregistrée.');
      } }]
    });
  }

  function appICS(a) {
    var url = /^https?:/.test(location.href) && !UI.inFrame() ? location.href.split('#')[0] : '';
    var ics = R.buildEventICS({ date: a.date, title: 'Test en ligne ' + a.cabinet, description: (a.poste || '') + (a.note ? ' — ' + a.note : '') + '\nFaites une simulation adaptée dans Big4 Prep avant le test.', uid: 'big4-prep-' + a.id, now: new Date(now()), url: url });
    var ok = UI.downloadText('test-' + a.cabinet.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + a.date + '.ics', ics, 'text/calendar');
    UI.modal({ title: 'Rappel dans le calendrier', body: h('div', {}, [
      h('p', { text: ok && !UI.inFrame() ? 'Le fichier .ics a été généré : ouvrez-le pour ajouter la date limite du test à votre calendrier, avec une alerte la veille et une le jour même à 9 h.' : 'Le téléchargement est bloqué dans cette prévisualisation. Il fonctionnera une fois l\'application déployée.' }),
      h('p', { class: 'cta-note', text: 'iPhone : touchez le fichier puis « Ajouter au calendrier ». Android : ouvrez-le avec Google Agenda.' })
    ]) });
  }

  function renderApps() {
    var t = today(), list = ST.activeApps(app.state);
    setMain([
      h('h1', { class: 'page-title', text: 'Mes candidatures' }),
      h('button', { class: 'btn btn-primary btn-block', id: 'app-add', type: 'button', onclick: function () { appForm(null); } }, 'Ajouter une candidature'),
      list.length ? list.map(function (a) {
        var left = a.date ? U.diffDays(t, a.date) : null;
        var soon = a.statut === 'a-passer' && left != null && left >= 0 && left <= 7;
        return h('article', { class: 'app-card', 'data-app': a.id }, [
          h('div', { class: 'app-top' }, [h('span', { class: 'app-firm', text: a.cabinet }), h('span', { class: 'status status-' + a.statut, text: STATUS_LABEL[a.statut] })]),
          h('p', { class: 'muted', text: (a.poste || '') + (a.date ? ' · test avant le ' + UI.formatDay(a.date) + (left != null && left >= 0 && a.statut === 'a-passer' ? ' (J−' + left + ')' : '') : ' · date du test à préciser') }),
          a.note ? h('p', { class: 'cta-note', text: a.note }) : null,
          soon ? h('p', { class: 'banner banner-info', text: 'Le test approche : une simulation adaptée à ' + a.cabinet + ' est proposée.' }) : null,
          h('div', { class: 'app-actions' }, [
            a.statut === 'a-passer' ? h('button', { class: 'btn ' + (soon ? 'btn-primary' : 'btn-soft'), type: 'button', onclick: function () { startSim('custom', { sections: simFor(a.cabinet), label: 'Simulation adaptée ' + a.cabinet }); } }, 'Simulation adaptée') : null,
            a.date ? h('button', { class: 'btn btn-soft', type: 'button', onclick: function () { appICS(a); } }, 'Rappel .ics') : null,
            h('button', { class: 'btn btn-soft', type: 'button', onclick: function () { appForm(a); } }, 'Modifier'),
            h('button', { class: 'btn btn-quiet', type: 'button', onclick: function () {
              UI.confirmModal('Supprimer cette candidature ?', a.cabinet + ' — ' + (a.poste || '') + ' sera retirée de la liste.', 'Supprimer', function () { ST.deleteApp(app.state, a.id, now()); save(); renderApps(); }, true);
            } }, 'Supprimer')
          ])
        ]);
      }) : h('p', { class: 'empty', text: 'Aucune candidature pour l\'instant. Ajoutez-en une pour suivre la date limite de chaque test.' }),
      h('p', { class: 'cta-note', text: 'La simulation adaptée reprend les épreuves le plus souvent rapportées pour ce cabinet en audit (voir la fiche « Ce qui vous attend chez chaque cabinet »).' })
    ]);
  }

  /* ====================== Statistiques ====================== */

  function renderStats() {
    var st = app.state, t = today(), streak = G.currentStreak(st, t);
    var days = [], vals = [];
    for (var i = 6; i >= 0; i--) { var d = U.addDays(t, -i); days.push(UI.formatDay(d).slice(0, 5)); vals.push(Math.round(G.todayMinutes(st, d))); }
    var week = h('figure', { class: 'chart-card', html: BP.chart.chartSVG({ kind: 'bar', lang: 'fr', decimals: 0, title: 'Minutes d\'entraînement', labels: days, series: [{ name: '', values: vals }] }) });
    var rows = Q.ORDER.map(function (m) {
      var s = STATS.moduleStats(st.log, m);
      return h('tr', {}, [h('th', { scope: 'row', text: Q.MODULES[m].short }), h('td', { text: s.n ? Math.round(s.acc * 100) + ' %' : '–' }), h('td', { text: s.n ? Math.round(s.avgMs / 1000) + ' s' : '–' }), h('td', { text: String(STATS.moduleStats(st.log, m, 100000).n) })]);
    });
    function errCard(m, title) {
      var e = STATS.errorStats(st.log, m), keys = Object.keys(e).filter(function (k) { return k !== 'non-repondu' && k !== 'passe'; }).sort(function (a, b) { return e[b] - e[a]; }).slice(0, 5);
      if (!keys.length) return null;
      return h('section', { class: 'card' }, [h('h2', { text: title }), h('div', { class: 'err-bars' }, keys.map(function (k) {
        return h('div', { class: 'err-row' }, [h('span', { text: Q.errLabel(m, k) }), h('strong', { text: String(e[k]) }), progressBar(e[k], e[keys[0]], 'bar-thin')]);
      }))]);
    }
    var gs = STATS.genStats(st.log, 'numerique'), weakGens = Object.keys(gs).filter(function (k) { return gs[k].n >= 3; }).sort(function (a, b) { return gs[a].ok / gs[a].n - gs[b].ok / gs[b].n; }).slice(0, 5);
    var sims = st.sims.slice(-8).reverse();
    setMain([
      h('h1', { class: 'page-title', text: 'Progrès' }),
      h('div', { class: 'stat-grid' }, [
        statBox(String(streak), streak > 1 ? 'jours de série' : 'jour de série'), statBox(String(st.streak.best), 'série record'),
        statBox(String(G.totalXp(st)), 'XP · niveau ' + G.level(G.totalXp(st)).level), statBox(Math.round(G.totalMinutes(st)) + ' min', 'd\'entraînement'),
        statBox(String(st.sims.length), 'simulations'), statBox(String(st.log.length), 'réponses enregistrées')
      ]),
      h('section', { class: 'card' }, [h('h2', { text: 'Sept derniers jours' }), week, h('p', { class: 'cta-note', text: 'Objectif : ' + G.goalMinutes(st) + ' min par jour. Gels de série disponibles : ' + st.streak.freezes + '.' })]),
      h('section', { class: 'card' }, [h('h2', { text: 'Par module (60 dernières réponses)' }), h('table', { class: 'table' }, [
        h('thead', {}, h('tr', {}, [h('th', { text: 'Module' }), h('th', { text: 'Réussite' }), h('th', { text: 'Temps moy.' }), h('th', { text: 'Total' })])), h('tbody', {}, rows)])]),
      sims.length ? h('section', { class: 'card' }, [h('h2', { text: 'Dernières simulations' }), h('table', { class: 'table' }, [
        h('thead', {}, h('tr', {}, [h('th', { text: 'Date' }), h('th', { text: 'Simulation' }), h('th', { text: 'Score' }), h('th', { text: 'Pctl.' })])),
        h('tbody', {}, sims.map(function (s) { return h('tr', {}, [h('td', { text: UI.formatDay(U.dayKey(new Date(s.ts))).slice(0, 5) }), h('th', { text: (s.label || s.module).replace('Simulation — ', '').replace('Simulation ', '') }), h('td', { text: Math.round(s.pct) + ' %' }), h('td', { text: s.percentile + 'e' })]); }))
      ]), h('p', { class: 'note-estim', text: 'Percentile indicatif : estimation sur un groupe de référence fictif.' })]) : null,
      errCard('numerique', 'Numérique : erreurs les plus fréquentes'),
      weakGens.length ? h('section', { class: 'card' }, [h('h2', { text: 'Numérique : types les moins réussis' }), h('div', { class: 'theme-list' }, weakGens.map(function (g) {
        var G0 = BP.gen.numeric.byId[g];
        return h('button', { class: 'theme-row', type: 'button', onclick: function () { startTraining('numerique', { gen: g, label: G0.title }); } }, [h('span', { class: 'theme-body' }, [h('span', { class: 'theme-title', text: G0.title }), h('span', { class: 'theme-meta', text: gs[g].n + ' questions' })]), h('span', { class: 'theme-pct', text: Math.round(gs[g].ok / gs[g].n * 100) + ' %' })]);
      }))]) : null,
      errCard('verbal', 'Verbal : pièges les plus fréquents'),
      errCard('technique', 'Technique : thèmes les plus ratés'),
      errCard('sjt', 'Mises en situation : erreurs')
    ]);
  }

  /* ====================== Réglages ====================== */

  function segmented(label, options, value, onChange, id) {
    var group = h('div', { class: 'seg', role: 'group', 'aria-label': label, id: id || null }, options.map(function (o) {
      return h('button', { class: 'seg-btn', type: 'button', 'aria-pressed': String(o.value === value), 'data-value': String(o.value), onclick: function () { onChange(o.value); } }, o.label);
    }));
    return h('div', { class: 'setting' }, [h('p', { class: 'setting-label', text: label }), group]);
  }

  function formatSyncTime(ms) {
    if (!ms) return 'jamais';
    var d = new Date(ms), t = U.dayKey(d) === today() ? 'aujourd\'hui' : 'le ' + UI.formatDay(U.dayKey(d));
    return t + ' à ' + U.pad(d.getHours()) + ' h ' + U.pad(d.getMinutes());
  }

  function connectWith(token, btn, err) {
    if (btn) { btn.disabled = true; btn.textContent = 'Connexion…'; }
    sync.client.connect(token, ST.exportState(app.state, now())).then(function (r) {
      return runSync(false).then(function () {
        sync.error = null;
        UI.toast(r.created ? 'Connecté. Votre progression est sauvegardée en ligne.' : 'Connecté. Progression fusionnée avec celle de vos autres appareils.');
        renderSettings();
      });
    }, function (e) {
      if (btn) { btn.disabled = false; btn.textContent = 'Connecter cet appareil'; }
      if (err) { err.textContent = UI.typo(e.message); err.hidden = false; } else UI.modal({ title: 'Connexion impossible', body: e.message });
    });
  }

  function syncSection() {
    var title = h('h2', { text: 'Synchronisation entre appareils' });
    if (!sync.available()) {
      return h('section', { class: 'card', id: 'sync-card' }, [title, h('p', { class: 'cta-note', text: 'Disponible une fois l\'application en ligne (GitHub Pages) : votre progression est alors partagée entre votre téléphone et votre ordinateur, via un Gist GitHub privé, avec la même clé qu\'English Pro.' })]);
    }
    if (sync.isConnected()) {
      var c = sync.client.config;
      return h('section', { class: 'card', id: 'sync-card' }, [title,
        h('p', {}, ['Connecté au compte GitHub ', h('strong', { text: c.login || '?' }), '.']),
        h('p', { class: 'cta-note', id: 'sync-last', text: 'Dernière synchronisation : ' + formatSyncTime(c.lastSync) + '. Elle se fait seule à l\'ouverture et après chaque série de questions. Fichier en ligne : ' + BP.syncCore.FILE + '.' }),
        sync.error ? h('p', { class: 'form-error', text: sync.error.message }) : null,
        h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'sync-now', onclick: function () { runSync(true); } }, 'Synchroniser maintenant'),
        h('button', { class: 'btn btn-soft btn-block', type: 'button', id: 'sync-off', onclick: function () {
          UI.confirmModal('Déconnecter cet appareil ?', 'La progression reste sur cet appareil et dans votre Gist, mais ils ne seront plus synchronisés.', 'Déconnecter', function () { sync.client.disconnect(); sync.error = null; renderSettings(); });
        } }, 'Déconnecter cet appareil')
      ]);
    }
    var shared = BP.syncCore.sharedToken(sync.storage);
    var input = h('input', { class: 'input code-input', id: 'sync-token', type: 'password', autocomplete: 'off', autocapitalize: 'none', spellcheck: 'false', placeholder: 'ghp_…', 'aria-label': 'Clé GitHub' });
    var err = h('p', { class: 'form-error', role: 'alert', hidden: true });
    var btn = h('button', { class: 'btn btn-primary btn-block', type: 'submit', id: 'sync-connect' }, 'Connecter cet appareil');
    function submit(ev) { ev.preventDefault(); err.hidden = true; connectWith(input.value, btn, err); }
    return h('section', { class: 'card', id: 'sync-card' }, [title,
      h('p', { class: 'cta-note', text: 'Même principe qu\'English Pro : la progression est rangée dans un Gist privé de votre compte GitHub (fichier ' + BP.syncCore.FILE + ', distinct de celui d\'English Pro). La même clé GitHub sert aux deux applications.' }),
      shared ? h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'sync-shared', onclick: function () { connectWith(shared.token, null, null); } }, 'Utiliser la clé déjà enregistrée par English Pro' + (shared.login ? ' (' + shared.login + ')' : '')) : null,
      h('details', { class: 'howto' }, [
        h('summary', { text: 'Retrouver ou créer la clé GitHub' }),
        h('ol', {}, [
          h('li', { text: 'Reprenez la clé utilisée pour English Pro (notée dans vos notes) : elle fonctionne telle quelle.' }),
          h('li', { text: 'Sinon, sur github.com : photo de profil → Settings → Developer settings → Personal access tokens → Tokens (classic) → Generate new token (classic), en cochant uniquement « gist ».' })
        ])
      ]),
      h('form', { class: 'form', onsubmit: submit, novalidate: true }, [h('label', { class: 'field' }, [h('span', { text: 'Clé GitHub' }), input]), err, btn]),
      h('p', { class: 'cta-note', text: 'La clé reste sur cet appareil et n\'est jamais incluse dans vos exports.' })
    ]);
  }

  function renderSettings() {
    var keepY = window.scrollY || 0;
    setTimeout(function () { window.scrollTo(0, keepY); }, 0);
    var st = app.state, set = st.settings, notif = R.notificationSupport(window), framed = UI.inFrame();
    function update(key, value) { set[key] = value; var g = G.checkGoal(st, today()); save(); renderSettings(); if (g.reachedNow) UI.toast('Objectif du jour atteint.'); }

    var timeInput = h('input', { class: 'input input-time', type: 'time', id: 'reminder-time', value: set.reminderTime, 'aria-label': 'Heure du rappel' });
    timeInput.addEventListener('change', function () { if (R.parseTime(timeInput.value)) { set.reminderTime = timeInput.value; save(); scheduleNotification(); } });
    function makeICS() {
      var url = /^https?:/.test(location.href) && !framed ? location.href.split('#')[0] : '';
      var ics = R.buildICS({ time: set.reminderTime, now: new Date(now()), url: url });
      var ok = UI.downloadText('rappel-big4-prep.ics', ics, 'text/calendar');
      UI.modal({ title: 'Rappel dans le calendrier', body: h('div', {}, [
        h('p', { text: ok && !framed ? 'Le fichier rappel-big4-prep.ics a été généré. Ouvrez-le : votre téléphone propose d\'ajouter un événement quotidien à ' + set.reminderTime + ' avec une alerte.' : 'Le téléchargement est bloqué dans cette prévisualisation. Il fonctionnera une fois l\'application déployée.' }),
        h('p', { class: 'cta-note', text: 'Sur iPhone : touchez le fichier téléchargé puis « Ajouter au calendrier ». Sur Android : ouvrez-le avec Google Agenda.' })
      ]) });
    }
    var notifToggle = h('button', {
      class: 'switch', type: 'button', role: 'switch', 'aria-checked': String(!!set.notifications && notif.permission === 'granted'), disabled: !notif.supported, id: 'notif-switch',
      onclick: function () {
        if (set.notifications) { set.notifications = false; save(); scheduleNotification(); return renderSettings(); }
        var p; try { p = window.Notification.requestPermission(); } catch (e) { p = null; }
        Promise.resolve(p).then(function (perm) { set.notifications = perm === 'granted'; save(); scheduleNotification(); renderSettings(); if (perm !== 'granted') UI.toast('Notifications refusées par le navigateur.'); });
      }
    }, h('span', { class: 'switch-knob' }));
    var timerToggle = h('button', { class: 'switch', type: 'button', role: 'switch', id: 'timer-switch', 'aria-checked': String(!!set.indicativeTimer), onclick: function () { update('indicativeTimer', !set.indicativeTimer); } }, h('span', { class: 'switch-knob' }));

    function doExport() {
      var text = ST.exportState(st, now());
      st.lastExport = now(); save();
      var ok = UI.downloadText('big4-prep-progression-' + today() + '.json', text, 'application/json');
      UI.toast(ok && !framed ? 'Fichier de sauvegarde téléchargé.' : 'Téléchargement bloqué ici : utilisez « Copier la sauvegarde ».');
    }
    function doCopy() {
      var text = ST.exportState(st, now());
      UI.copyText(text).then(function (ok) {
        if (ok) { st.lastExport = now(); save(); UI.toast('Sauvegarde copiée : collez-la dans une note ou un mail.'); }
        else { var ta = h('textarea', { class: 'input code', rows: '8', readonly: true }); ta.value = text; UI.modal({ title: 'Votre sauvegarde', body: h('div', {}, [h('p', { text: 'Sélectionnez tout le texte et copiez-le.' }), ta]) }); }
      });
    }
    function applyImport(text) {
      var res = ST.importState(text, now());
      if (!res.ok) { UI.modal({ title: 'Import impossible', body: res.error }); return; }
      UI.confirmModal('Remplacer la progression actuelle ?', 'La sauvegarde contient ' + res.state.log.length + ' réponses, ' + Object.keys(res.state.cards).length + ' fiches de révision, ' + res.state.sims.length + ' simulations et ' + ST.activeApps(res.state).length + ' candidatures. Elle remplacera la progression de cet appareil.', 'Importer', function () {
        var keep = app.state.deviceId;
        Object.keys(app.state).forEach(function (k) { delete app.state[k]; });
        Object.assign(app.state, MG.adoptImported(res.state, keep));
        save(); scheduleNotification(); UI.toast('Progression importée.'); goTab('accueil');
      });
    }
    var fileInput = h('input', { type: 'file', accept: '.json,application/json', id: 'import-file', class: 'visually-hidden' });
    fileInput.addEventListener('change', function () {
      var file = fileInput.files && fileInput.files[0];
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () { applyImport(String(reader.result)); };
      reader.onerror = function () { UI.modal({ title: 'Import impossible', body: 'Le fichier n\'a pas pu être lu.' }); };
      reader.readAsText(file); fileInput.value = '';
    });
    function pasteImport() {
      var ta = h('textarea', { class: 'input code', rows: '8', id: 'import-text', placeholder: 'Collez ici le contenu de votre sauvegarde' });
      UI.modal({ title: 'Coller une sauvegarde', body: ta, actions: [{ label: 'Annuler' }, { label: 'Importer', kind: 'primary', onClick: function () { var v = ta.value; setTimeout(function () { applyImport(v); }, 0); } }] });
    }
    var standalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) || window.navigator.standalone === true;

    setMain([
      h('h1', { class: 'page-title', text: 'Réglages' }),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Objectif quotidien' }),
        segmented('Temps d\'entraînement par jour', G.GOALS.map(function (m) { return { value: m, label: m + ' min' }; }), set.goalMinutes, function (v) { update('goalMinutes', v); }, 'goal-seg'),
        h('p', { class: 'cta-note', text: 'Seul compte le temps passé à répondre (plafonné par question) : laisser l\'app ouverte ne suffit pas.' })
      ]),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Questions' }),
        segmented('Langue des questions (numérique et verbal)', [{ value: 'mix', label: 'Alternée' }, { value: 'fr', label: 'Français' }, { value: 'en', label: 'Anglais' }], set.questionLang, function (v) { update('questionLang', v); }, 'lang-seg'),
        h('div', { class: 'setting setting-row' }, [h('div', {}, [h('p', { class: 'setting-label', text: 'Chrono indicatif en entraînement' }), h('p', { class: 'cta-note', text: 'Affiche le temps passé et le temps cible de chaque question.' })]), timerToggle])
      ]),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Rappel quotidien' }),
        h('label', { class: 'field field-row' }, [h('span', { text: 'Heure du rappel' }), timeInput]),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'ics-btn', onclick: makeICS }, 'Créer le rappel dans mon calendrier (.ics)'),
        h('p', { class: 'cta-note', text: 'Méthode fiable : le calendrier du téléphone sonne chaque jour, même application fermée. Les dates de test se mettent au calendrier depuis l\'onglet Candidatures.' }),
        h('div', { class: 'setting setting-row' }, [h('div', {}, [h('p', { class: 'setting-label', text: 'Notification de l\'application' }), h('p', { class: 'cta-note', text: notif.supported ? 'Appoint seulement : sans serveur, elle ne s\'affiche que si l\'application est ouverte ou encore en arrière-plan.' : notif.reason })]), notifToggle])
      ]),
      syncSection(),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Sauvegarde de ma progression' }),
        h('p', { class: 'cta-note', text: 'Réponses, révisions, simulations, candidatures et plan sont stockés sur cet appareil. Exportez-les de temps en temps.' }),
        h('button', { class: 'btn btn-primary btn-block', type: 'button', id: 'export-btn', onclick: doExport }, 'Exporter ma progression (fichier JSON)'),
        h('button', { class: 'btn btn-soft btn-block', type: 'button', id: 'copy-btn', onclick: doCopy }, 'Copier la sauvegarde'),
        fileInput,
        h('button', { class: 'btn btn-soft btn-block', type: 'button', id: 'import-btn', onclick: function () { fileInput.click(); } }, 'Importer un fichier de sauvegarde'),
        h('button', { class: 'btn btn-soft btn-block', type: 'button', id: 'paste-btn', onclick: pasteImport }, 'Coller une sauvegarde'),
        h('p', { class: 'cta-note', text: st.lastExport ? 'Dernière sauvegarde : ' + UI.formatDay(U.dayKey(new Date(st.lastExport))) + '.' : 'Aucune sauvegarde effectuée pour l\'instant.' })
      ]),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Installer sur le téléphone' }),
        standalone ? h('p', { text: 'L\'application est installée et fonctionne hors ligne.' }) : h('div', {}, [
          app.installPrompt ? h('button', { class: 'btn btn-primary btn-block', type: 'button', onclick: function () { app.installPrompt.prompt(); app.installPrompt = null; } }, 'Installer l\'application') : null,
          h('p', { text: 'iPhone (Safari) : bouton Partager, puis « Sur l\'écran d\'accueil ».' }),
          h('p', { text: 'Android (Chrome) : menu ⋮, puis « Installer l\'application ».' })
        ])
      ]),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Anglais' }),
        h('a', { class: 'btn btn-soft btn-block', href: ENGLISH_PRO_URL, target: '_blank', rel: 'noopener' }, 'Ouvrir English Pro')
      ]),
      h('section', { class: 'card' }, [
        h('h2', { text: 'Remise à zéro' }),
        h('button', { class: 'btn btn-danger btn-block', type: 'button', id: 'reset-btn', onclick: function () {
          var linked = sync.isConnected();
          UI.confirmModal('Effacer toute la progression ?', 'Réponses, révisions, simulations, candidatures, XP et série seront supprimés de cet appareil. Action définitive : exportez d\'abord en cas de doute.' + (linked ? ' Cet appareil sera aussi déconnecté de la synchronisation ; la sauvegarde en ligne n\'est pas touchée.' : ''), 'Tout effacer', function () {
            if (linked) sync.client.disconnect();
            var fresh = ST.defaultState(now());
            Object.keys(app.state).forEach(function (k) { delete app.state[k]; });
            Object.assign(app.state, fresh);
            app.store.saveSim(null); app.pendingSim = null;
            save(); goTab('accueil');
          }, true);
        } }, 'Effacer ma progression'),
        h('p', { class: 'cta-note', text: 'Big4 Prep ' + APP_VERSION + ' · ' + BP.gen.numeric.GENS.length + ' générateurs numériques, ' + BP.gen.abstract.GENS.length + ' abstraits, ' + app.content.items.length + ' questions rédigées. ' + (sync.isConnected() ? 'Seule la synchronisation envoie votre progression, dans votre Gist privé.' : 'Aucune donnée ne quitte votre appareil.') })
      ])
    ]);
  }

  /* ====================== Rappels (appoint) ====================== */

  function scheduleNotification() {
    clearTimeout(app.notifTimer);
    var st = app.state;
    if (!st.settings.notifications) return;
    var sup = R.notificationSupport(window);
    if (!sup.supported || sup.permission !== 'granted') return;
    var ms = R.msUntil(st.settings.reminderTime, new Date(now()));
    if (ms == null) return;
    app.notifTimer = setTimeout(function () { if (!G.goalReached(app.state, today())) showNotification(); scheduleNotification(); }, Math.min(ms, 2147483000));
  }

  function showNotification() {
    var options = { body: 'Votre entraînement du jour vous attend.', icon: 'icons/icon-192.png', badge: 'icons/icon-192.png', tag: 'big4-prep-daily' };
    try {
      if (app.swRegistration && app.swRegistration.showNotification) app.swRegistration.showNotification('Big4 Prep', options);
      else new window.Notification('Big4 Prep', options);
    } catch (e) { /* rien */ }
  }

  /* ====================== Démarrage ====================== */

  function registerServiceWorker() {
    if (!('serviceWorker' in navigator) || UI.inFrame()) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') return;
    navigator.serviceWorker.register('sw.js').then(function (reg) { app.swRegistration = reg; }).catch(function (err) { console.warn('[Big4 Prep] Service worker non enregistré :', err); });
  }

  function boot() {
    main = document.getElementById('main');
    nav = document.getElementById('nav');
    var storage = null;
    try { storage = window.localStorage; } catch (e) { storage = null; }
    app.store = ST.createStore(storage);
    initSync();
    app.state = app.store.load(now());
    if (!app.state.createdAt) app.state.createdAt = now();
    var pending = app.store.loadSim();
    if (pending && pending.sections && pending.sections.length) app.pendingSim = pending;

    var initial = (location.hash || '').replace('#', '');
    if (TABS.some(function (t) { return t.id === initial; })) app.tab = initial;

    window.addEventListener('hashchange', function () {
      var id = (location.hash || '').replace('#', '');
      if (!app.sub && id !== app.tab && TABS.some(function (t) { return t.id === id; })) { app.tab = id; render(); }
    });
    window.addEventListener('popstate', function () {
      if (!app.sub) { syncHash(); return; }
      if (app.sub === 'run' && app.run) { try { history.pushState({ bp: 'sub' }, ''); } catch (e) { /* rien */ } quitRun(); }
      else closeSub();
    });
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'visible') {
        if (app.run) { updateClock(); checkExpiry(); }
        else if (!app.sub && app.tab === 'accueil') render();
        syncIfStale();
      } else {
        if (app.run) persistSim();
        if (sync.isConnected() && !busy()) { clearTimeout(syncTimer); runSync(false); }
      }
    });
    window.addEventListener('online', function () { if (sync.pending) scheduleSync(1000); });
    window.addEventListener('beforeinstallprompt', function (ev) { ev.preventDefault(); app.installPrompt = ev; if (!app.sub && app.tab === 'reglages') render(); });

    loadContent().then(function (files) {
      app.content = C.install((files || []).filter(Boolean));
      if (app.content.errors.length) app.contentErrors = app.contentErrors.concat(app.content.errors);
      G.settleStreak(app.state, today());
      save();
      document.body.classList.remove('is-loading');
      render();
      scheduleNotification();
      registerServiceWorker();
      if (sync.isConnected()) runSync(false);
    }).catch(function (err) {
      console.error(err);
      document.body.classList.remove('is-loading');
      setMain([
        h('h1', { class: 'page-title', text: 'Contenu introuvable' }),
        h('p', { class: 'lead', text: 'Les fichiers de contenu n\'ont pas pu être chargés. Si vous avez ouvert index.html directement depuis un dossier, ouvrez plutôt apercu.html ou déployez l\'application (voir le README).' }),
        h('p', { class: 'form-error', text: String(err && err.message || err) })
      ]);
    });
  }

  app.startTraining = startTraining;
  app.startSim = startSim;
  app.goTab = goTab;
  app.render = render;
  app.runSync = runSync;
  app.openSub = openSub;
  app.finishRun = finishRun;
  app.checkExpiry = checkExpiry;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
