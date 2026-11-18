"""Big4 Prep — test de bout en bout dans un vrai navigateur (facultatif).

Prérequis : Python 3, Playwright (pip install playwright) et Chrome/Chromium.
Lancement :
    python3 -m http.server 8766          # dans le dossier du projet
    python3 tests/e2e.py                 # dans un autre terminal
Variables : BP_URL (adresse de l'app), BP_SHOTS (dossier de captures), BP_CHROME (chemin de Chrome).
"""
import json
import os
import sys

from playwright.sync_api import sync_playwright

URL = os.environ.get('BP_URL', 'http://localhost:8766/index.html')
SHOTS = os.environ.get('BP_SHOTS', '')
CHROME = os.environ.get('BP_CHROME', '/usr/bin/google-chrome')
MIN = 60000

results = []


def check(name, cond, detail=''):
    results.append((name, bool(cond)))
    print(('  ✓ ' if cond else '  ✗ ') + name + ('' if cond else '   → ' + str(detail)))


def shot(page, name, full=False):
    if SHOTS:
        os.makedirs(SHOTS, exist_ok=True)
        page.screenshot(path=os.path.join(SHOTS, name + '.png'), full_page=full)


# Répond à la question affichée, juste ou faux, en lisant la question en cours dans l'application.
ANSWER_JS = r"""
(correct) => {
  const run = BP.app.run; const s = run.sections[run.sec]; const q = s.queue[run.idx];
  const main = document.getElementById('main');
  if (q.kind === 'sjt-bw') {
    const order = BP.scoring.sjtOrder({ options: q.options });
    const rows = main.querySelectorAll('.sjt-opt');
    const best = correct ? order[0] : order[1], worst = order[3];
    rows[best].querySelector('.best').click(); rows[worst].querySelector('.worst').click();
  } else if (q.kind === 'sjt-rank') {
    let order = BP.scoring.sjtOrder({ options: q.options });
    if (!correct) order = order.slice().reverse();
    const btns = main.querySelectorAll('.rank-btn');
    order.forEach(i => btns[i].click());
  } else {
    const idx = correct ? q.answer : (q.answer === 0 ? 1 : 0);
    const sel = q.kind === 'fig' ? '.fig-choice' : (q.kind === 'vfn' ? '.vfn .choice' : '.choices .choice');
    main.querySelectorAll(sel)[idx].click();
  }
  document.getElementById('check').click();
  return q.kind;
}
"""


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, args=['--no-sandbox'])
        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, accept_downloads=True)
        page = ctx.new_page()
        page.on('pageerror', lambda e: errors.append(str(e)))
        page.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'favicon' not in m.text else None)

        print('\nDémarrage')
        page.goto(URL)
        page.wait_for_selector('#start-complete')
        check('accueil affiché', page.is_visible('#start-complete'))
        check('contenu chargé (≥ 360 items)', page.evaluate('BP.app.content.items.length') >= 360)
        shot(page, '01-accueil', True)

        print('\nEntraînement numérique (10 questions)')
        page.click('#tab-entrainer')
        page.click('[data-module=numerique]')
        page.click('#train-btn')
        page.wait_for_selector('#check')
        check('chrono indicatif visible', page.is_visible('#run-clock'))
        page.click('#calc-open')
        for k in ['1', '2', '*', '3', '=']:
            page.click('.ck[data-k="%s"]' % k)
        check('calculatrice : 12 × 3 = 36', page.inner_text('#calc-val').strip() == '36')
        shot(page, '02-numerique-calculatrice')
        page.click('#scratch-tab')
        page.fill('#scratch', 'brouillon test')
        page.click('#calc-close')
        for i in range(10):
            page.evaluate(ANSWER_JS, i % 3 != 0)
            page.wait_for_selector('#continue')
            if i == 1:
                shot(page, '03-numerique-correction', True)
            page.click('#continue')
        page.wait_for_selector('#again')
        check('bilan d\'entraînement affiché', page.is_visible('.big-score'))
        st = page.evaluate('BP.app.state')
        check('10 réponses journalisées', len([e for e in st['log'] if e['m'] == 'numerique']) == 10, len(st['log']))
        check('XP gagnée', page.evaluate('BP.game.totalXp(BP.app.state)') > 0)
        check('erreurs étiquetées par type', any(e['e'] for e in st['log'] if e['ok'] == 0))
        shot(page, '04-bilan-entrainement', True)
        page.click('text=Retour')

        print('\nVerbal, abstrait, SJT, technique')
        for mod in ['verbal', 'abstrait', 'sjt', 'technique']:
            page.click('#tab-entrainer')
            page.click('[data-module=%s]' % mod)
            page.click('#train-btn')
            page.wait_for_selector('#check')
            if mod == 'verbal':
                check('texte support affiché', page.is_visible('.passage'))
            kind = page.evaluate(ANSWER_JS, True)
            page.wait_for_selector('#continue')
            check(mod + ' : correction affichée (' + kind + ')', page.is_visible('.feedback'))
            shot(page, '05-' + mod, True)
            if mod == 'sjt':
                page.click('#continue')
                page.wait_for_selector('#check')
                kind2 = page.evaluate(ANSWER_JS, False)
                page.wait_for_selector('#continue')
                check('SJT : principe expliqué', 'Principe' in page.inner_text('.feedback'))
            page.click('[aria-label=Quitter]')
            page.click('.modal .btn-primary')
            page.wait_for_selector('#again')
            page.click('text=Retour')
        cards = page.evaluate('Object.keys(BP.app.state.cards)')
        check('répétition espacée : fiches créées (SJT et technique)', any(c.startswith('S') for c in cards) and any(c.startswith('T') for c in cards), cards)

        print('\nSimulation numérique : chrono global, sans retour, temps écoulé')
        page.click('#tab-entrainer')
        page.click('[data-module=numerique]')
        page.click('#sim-btn')
        page.wait_for_selector('#start-section')
        shot(page, '06-simulation-intro')
        page.click('#start-section')
        page.wait_for_selector('#skip')
        check('pas de bouton « précédent »', page.query_selector('text=Précédent') is None)
        page.evaluate(ANSWER_JS, True)
        page.wait_for_function('BP.app.run.idx === 1')
        check('pas de correction pendant la simulation', page.query_selector('.feedback') is None)
        page.click('#skip')
        page.wait_for_function('BP.app.run.idx === 2')
        shot(page, '07-simulation-question')
        # 26 minutes passent (application en arrière-plan) : la section se termine seule
        page.evaluate('BP.clock.offset += 26 * 60000; document.dispatchEvent(new Event("visibilitychange"))')
        page.wait_for_selector('.big-score', timeout=5000)
        txt = page.inner_text('#main')
        check('temps écoulé : bilan de simulation', 'Bilan de la simulation' in txt)
        check('percentile indicatif affiché', 'Percentile indicatif' in txt)
        check('questions non traitées comptées', 'non traitée' in txt, txt[:300])
        sims = page.evaluate('BP.app.state.sims')
        check('bilan enregistré (18 questions, 1 juste)', len(sims) == 1 and sims[0]['n'] == 18 and sims[0]['correct'] == 1, sims)
        shot(page, '08-bilan-simulation', True)
        page.evaluate('BP.clock.offset = 0')
        page.click('text=Retour')

        print('\nSimulation complète : reprise après fermeture de l\'application')
        page.click('#tab-accueil')
        page.click('#start-complete')
        page.click('#start-section')
        page.evaluate(ANSWER_JS, True)
        page.wait_for_function('BP.app.run.idx === 1')
        page.reload()
        page.wait_for_selector('text=Reprendre')
        check('bannière « simulation en cours »', page.is_visible('text=Reprendre'))
        page.click('text=Reprendre')
        page.wait_for_selector('#check')
        check('reprise à la 2e question, chrono conservé', page.evaluate('BP.app.run.idx') == 1 and page.evaluate('BP.app.run.sections[0].start') is not None)
        page.click('[aria-label=Quitter]')
        page.click('.modal-actions button:has-text("Terminer maintenant")')
        page.wait_for_selector('.big-score')
        check('simulation complète notée par section', 'Par section' in page.inner_text('#main'))
        check('simulation terminée : plus de reprise en attente', page.evaluate('BP.app.store.loadSim()') is None)
        page.click('text=Retour')

        print('\nCandidatures, rappel .ics, plan de préparation')
        page.click('#tab-candidatures')
        page.click('#app-add')
        page.select_option('#app-firm', 'PwC')
        in3 = page.evaluate('BP.util.addDays(BP.util.dayKey(new Date()), 3)')
        page.fill('#app-date', in3)
        page.click('.modal .btn-primary')
        page.wait_for_selector('[data-app]')
        check('candidature ajoutée', 'PwC' in page.inner_text('[data-app]'))
        with page.expect_download() as dl:
            page.click('text=Rappel .ics')
        ics = open(dl.value.path(), encoding='utf-8').read()
        check('fichier .ics de la date de test', 'DTSTART;VALUE=DATE:' + in3.replace('-', '') in ics)
        page.click('.modal .btn')
        shot(page, '09-candidatures', True)
        page.click('#tab-accueil')
        check('accueil : compte à rebours et simulation adaptée proposée', 'Test PwC dans 3 jours' in page.inner_text('#main') and 'Prochain test' in page.inner_text('#main'))
        page.click('text=Plan de préparation')
        page.fill('#plan-date', page.evaluate('BP.util.addDays(BP.util.dayKey(new Date()), 20)'))
        page.dispatch_event('#plan-date', 'change')
        page.wait_for_selector('.plan-day')
        check('plan jour par jour (20 jours)', len(page.query_selector_all('.plan-day')) == 20)
        shot(page, '10-plan', True)
        page.click('[aria-label=Retour]')

        print('\nMini-jeux, fiches, statistiques')
        page.click('#tab-entrainer')
        page.click('#open-games')
        page.click('[data-game=risque]')
        for _ in range(10):
            page.click('text=Encaisser')
        page.wait_for_selector('text=Résultat')
        check('jeu « risque mesuré » terminé', 'Total encaissé' in page.inner_text('#main'))
        page.click('[aria-label=Retour]')
        page.click('[data-game=memoire]')
        page.wait_for_selector('.game-cell')
        check('jeu de mémoire lancé', len(page.query_selector_all('.game-cell')) == 9)
        page.click('[aria-label=Retour]')
        page.click('[aria-label=Retour]')
        page.click('#tab-stats')
        txt = page.inner_text('#main')
        check('statistiques : simulations et erreurs', 'Dernières simulations' in txt and 'Numérique' in txt)
        shot(page, '11-progres', True)

        print('\nRéglages : objectif, export et import')
        page.click('#tab-reglages')
        page.click('#goal-seg [data-value="10"]')
        check('objectif réglé à 10 min', page.evaluate('BP.app.state.settings.goalMinutes') == 10)
        with page.expect_download() as dl:
            page.click('#export-btn')
        data = json.load(open(dl.value.path(), encoding='utf-8'))
        check('export JSON complet', data['app'] == 'big4-prep' and len(data['state']['log']) > 20 and len(data['state']['apps']) == 1)
        before = page.evaluate('BP.app.state.log.length')
        page.click('#paste-btn')
        page.fill('#import-text', json.dumps(data))
        page.click('.modal .btn-primary')
        page.click('.modal .btn-primary')
        page.wait_for_selector('#start-complete')
        check('import : progression restaurée', page.evaluate('BP.app.state.log.length') == before)
        shot(page, '12-reglages', True)

        print('\nHors ligne (service worker)')
        page.reload()
        page.wait_for_function('navigator.serviceWorker && navigator.serviceWorker.controller !== null', timeout=10000)
        ctx.set_offline(True)
        page.reload()
        page.wait_for_selector('#start-complete', timeout=10000)
        check('l\'application s\'ouvre hors ligne', page.is_visible('#start-complete'))
        page.click('#tab-entrainer')
        page.click('[data-module=sjt]')
        page.click('#train-btn')
        page.wait_for_selector('#check')
        check('contenu disponible hors ligne', page.is_visible('.sjt-situation'))
        ctx.set_offline(False)

        print('\nThème sombre')
        dark = browser.new_context(viewport={'width': 390, 'height': 844}, color_scheme='dark')
        dp = dark.new_page()
        dp.goto(URL)
        dp.wait_for_selector('#start-complete')
        dp.click('#tab-entrainer')
        dp.click('[data-module=abstrait]')
        dp.click('#train-btn')
        dp.wait_for_selector('#check')
        shot(dp, '13-abstrait-sombre', True)
        check('thème sombre : figures lisibles (couleur de trait claire)', dp.evaluate("getComputedStyle(document.documentElement).getPropertyValue('--ink').trim()") == '#e9f3f1')
        dark.close()

        browser.close()

    check('aucune erreur JavaScript', not errors, errors[:5])
    ok = sum(1 for _, c in results if c)
    print('\n%d / %d vérifications réussies.' % (ok, len(results)))
    sys.exit(0 if ok == len(results) else 1)


if __name__ == '__main__':
    main()
