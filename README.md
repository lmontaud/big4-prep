# Big4 Prep

Application mobile d'entraînement aux **tests en ligne de recrutement des Big 4** (Deloitte, PwC, EY, KPMG) pour un poste d'auditeur financier junior en France. Elle fonctionne hors ligne, s'installe sur le téléphone comme une application, ne demande aucun compte et garde votre progression sur l'appareil (avec synchronisation facultative, comme English Pro).

Ce qu'elle contient :

- **Raisonnement numérique** : 30 types de questions générées à l'infini (pourcentages, variations, devises, ratios, croissance composée…), en français et en anglais, avec calculatrice et brouillon intégrés.
- **Raisonnement verbal** : 40 textes (20 FR, 20 EN), 143 affirmations Vrai / Faux / On ne peut pas savoir.
- **Raisonnement abstrait** : 14 types de suites de figures, intrus, suites de nombres et de lettres.
- **Mises en situation (SJT)** : 50 scénarios d'auditeur junior, correction argumentée.
- **Technique** : 150 questions PCG, IFRS, calculs, audit (NEP / ISA).
- **Anglais** : 24 questions, avec un lien vers English Pro.
- **Personnalité et jeux** : fiches d'explication et 3 mini-jeux de familiarisation.
- Simulations en conditions réelles, bilan avec percentile indicatif, suivi des candidatures, plan de préparation sur 2 ou 4 semaines.

Les choix faits pendant la construction sont expliqués dans **DECISIONS.md**.

## 1. Tester tout de suite, sans rien installer

Ouvrez **`apercu.html`** (double-clic) : toute l'application tient dans ce fichier. La synchronisation et l'installation sur le téléphone, elles, demandent la version en ligne.

## 2. Mettre l'application en ligne (GitHub Pages, compte `lmontaud`)

1. Connectez-vous sur **github.com** avec votre compte `lmontaud`.
2. En haut à droite : **+** → **New repository**. Nom : **`big4-prep`**. Visibilité : **Public** (obligatoire pour GitHub Pages gratuit ; votre progression, elle, n'est jamais dans ce dépôt). Cliquez **Create repository**.
3. Sur la page du dépôt vide : lien **uploading an existing file**. Décompressez le zip sur votre ordinateur, ouvrez le dossier `big4-prep` et **glissez tout son contenu** (les dossiers `css`, `js`, `content`, `icons`, `tests`, `tools` et les fichiers `index.html`, `sw.js`, `manifest.webmanifest`, `.nojekyll`…) dans la page. Cliquez **Commit changes**.
   - Le fichier `.nojekyll` est caché sur Mac : appuyez sur Cmd + Maj + . dans le Finder pour l'afficher. S'il manque, l'app fonctionne quand même.
4. Onglet **Settings** → **Pages** → *Source* : **Deploy from a branch** ; *Branch* : **main** et **/ (root)** → **Save**.
5. Après une à deux minutes, l'application est en ligne à : **https://lmontaud.github.io/big4-prep/**

Pour une mise à jour : déposez de nouveau les fichiers modifiés de la même façon. Le téléphone récupère la nouvelle version au lancement suivant.

## 3. Installer sur le téléphone

- **iPhone (Safari)** : ouvrez l'adresse ci-dessus, bouton **Partager** → **Sur l'écran d'accueil**.
- **Android (Chrome)** : menu **⋮** → **Installer l'application**.

Ouvrez-la une fois avec du réseau : ensuite, elle fonctionne hors ligne.

## 4. Synchroniser avec votre clé GitHub existante

La synchronisation range la progression dans un **Gist privé** de votre compte, dans un fichier `big4-prep-progression.json` distinct de celui d'English Pro. **La même clé GitHub sert aux deux applications.**

- Si English Pro est déjà connecté sur cet appareil (dans le même navigateur), allez dans **Réglages** → **Synchronisation** et touchez **« Utiliser la clé déjà enregistrée par English Pro »**. C'est tout.
- Sinon, collez la même clé que pour English Pro (elle commence par `ghp_`) et touchez **Connecter cet appareil**. Faites de même sur l'ordinateur.

Sur iPhone, l'application installée sur l'écran d'accueil a son propre stockage : il faut y coller la clé une fois, même si Safari la connaît déjà.

La synchronisation se fait seule à l'ouverture et après chaque série de questions. La clé n'est jamais incluse dans les exports.

## 5. Sauvegarde manuelle

**Réglages** → **Exporter ma progression** télécharge un fichier JSON (réponses, révisions, simulations, candidatures, plan). **Importer** ou **Coller une sauvegarde** le restaure sur n'importe quel appareil.

## 6. Utiliser l'application

- **Accueil** : série, minutes du jour, séance conseillée (celle du plan, sinon votre module le plus faible), compte à rebours jusqu'au prochain test, niveau et vitesse par module, bouton **Simulation complète**.
- **S'entraîner** : chaque module propose un entraînement de 10 questions (correction détaillée après chaque réponse, chrono indicatif) et une simulation en conditions réelles (chrono global, pas de correction avant la fin, pas de retour en arrière). Le numérique et l'abstrait permettent de travailler un type précis ; le technique, un thème.
- **Candidatures** : cabinet, poste, date limite, statut. Bouton **Rappel .ics** pour ajouter la date au calendrier, **Simulation adaptée** au cabinet (mise en avant les jours qui précèdent le test).
- **Progrès** : minutes par jour, réussite et temps moyen par module, erreurs les plus fréquentes par type, historique des simulations.
- **Réglages** : objectif (10, 20 ou 30 minutes), langue des questions (alternée, français, anglais), chrono indicatif, rappel quotidien (.ics), synchronisation, sauvegarde.

Le **percentile** affiché après une simulation est une estimation sur un groupe de référence fictif : utile pour suivre votre progression, pas pour prédire un résultat.

## 7. Ajouter ou modifier du contenu

Le contenu est dans le dossier **`content/`**, un fichier JSON par module. Après toute modification, lancez les tests (section 8) : ils signalent un champ manquant, une réponse en double ou une erreur de format.

**Question technique** (`technique-1.json`, `-2`, `-3`) ou **anglais** (`anglais.json`) — ajoutez un bloc dans `items` :

```json
{
  "id": "T151", "module": "technique", "lang": "fr", "type": "qcm", "theme": "provisions",
  "q": "Texte de la question",
  "answer": "La bonne réponse",
  "distractors": ["Mauvaise 1", "Mauvaise 2", "Mauvaise 3"],
  "explain": "Explication en français.",
  "ref": "IAS 37, § 14",
  "difficulty": 2, "time": 45
}
```

**Mise en situation** (`sjt.json`) : `situation`, `question`, `type` (`best-worst` ou `rank`) et 4 `options` avec chacune `t` (texte), `score` (4 = la plus efficace, 1 = la moins, chaque note une seule fois) et `why` (justification), plus `principle` et `explain`.

**Texte verbal** (`verbal.json`) : un bloc dans `passages` avec `id`, `lang` (`fr` ou `en`), `title`, `text`, `difficulty` et 3 ou 4 `statements` : `{ "id": "V41-1", "s": "affirmation", "answer": "vrai" | "faux" | "nsp", "why": "justification par le texte" }`.

Les identifiants doivent rester uniques. Pour un nouveau fichier, ajoutez son nom dans `content/index.json`. Après une modification, relancez `node tools/build-preview.js` pour mettre à jour `apercu.html`.

Les questions numériques et abstraites sont produites par du code (`js/gen/numeric.js`, `js/gen/abstract.js`) ; en ajouter demande un peu de JavaScript.

## 8. Tests

- `node tests/run-tests.js` : 105 tests (générateurs sur 100 tirages chacun, chronomètre, calculatrice, notation, répétition espacée, fusion, export/import, validité de chaque item rédigé…). Aucune installation nécessaire hormis Node.
- `tests/e2e.py` : parcours complet dans un vrai navigateur (Playwright + Chrome), y compris simulation, temps écoulé, reprise, candidatures, export/import et hors ligne. Mode d'emploi en tête du fichier.

## 9. Organisation des fichiers

```
index.html, manifest.webmanifest, sw.js   application, installation, hors ligne
apercu.html                                version tout-en-un (test et prévisualisation)
css/style.css                              charte d'English Pro, accent vert sapin / menthe
js/core/   util, srs, timer, calc, game, content, store, merge, scoring, stats, plan, reminder, chart
js/gen/    common, numeric (30 générateurs), abstract (14 générateurs)
js/        questions.js (questions et corrections), games.js, sync.js, ui.js, app.js (écrans)
content/   JSON par module + index.json
tests/     run-tests.js (Node), e2e.py (navigateur)
tools/     build-preview.js
```

## 10. Limites connues

- Les formats réels changent selon le cabinet et l'année : l'application entraîne les compétences, pas un test d'éditeur précis.
- Les notifications ne sont qu'un appoint (sans serveur) ; le rappel fiable est le fichier `.ics`.
- Sur iPhone, Safari peut effacer les données d'un site non installé et inutilisé pendant plusieurs semaines : installez l'app et activez la synchronisation ou exportez régulièrement.
