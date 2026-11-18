# Décisions prises pendant la construction

Aucune question n'a été posée : chaque point ambigu a été tranché ici. Tout est modifiable ; le fichier concerné est indiqué entre parenthèses.

## Formats des tests Big 4 en France (vérification du 17 novembre 2026)

Recherche web rapide (sites carrières, agrégateurs de retours de candidats, avis Glassdoor récents). Sources secondaires : les cabinets publient peu le détail de leurs tests, et les formats changent selon l'année, le poste et le bureau.

- **Deloitte** : tests en ligne cognitifs (numérique, logique) et situationnels en première étape ; des candidats en audit citent aussi anglais, personnalité et parfois un test de connaissances comptables et d'audit.
- **PwC** : tests d'aptitude type SHL (numérique, verbal, logique inductive) combinés à une évaluation sous forme de jeux (Arctic Shores selon les guides spécialisés). Des candidats auditeurs juniors à Neuilly (fin 2025) citent un test d'anglais niveau B2 minimum (écrit et oral), un test psychotechnique et un test de comptabilité.
- **EY** : numérique, verbal et jugement situationnel (parfois « job simulation ») ; à Paris, test d'anglais, de logique et de mise en situation, ou logique et personnalité à passer sous 72 heures.
- **KPMG** : tests Cappfinity (SJT, numérique, verbal) selon les guides, puis entretien vidéo ; en France, appel RH puis tests en ligne dont un psychotechnique.

Conséquences : l'application entraîne les **compétences** communes (numérique, verbal, logique, SJT, technique, anglais) et pas le format exact d'un éditeur. Ces constats sont repris dans la fiche « Ce qui vous attend chez chaque cabinet » (`content/fiches.json`) et dans les simulations adaptées par cabinet (`js/app.js`, fonction `simFor`) :
PwC = numérique + verbal + abstrait + technique ; Deloitte = numérique + abstrait + SJT + technique ; EY = numérique + verbal + SJT ; KPMG = SJT + numérique + verbal.

## Simulations (`js/core/scoring.js`)

1. **Formats** inspirés des tests d'aptitude classiques : numérique 18 questions / 25 min, verbal 30 affirmations / 19 min, abstrait 24 / 25 min, SJT 16 scénarios / 25 min, technique 20 / 20 min. **Simulation complète** : 4 sections chronométrées séparément (numérique 12 / 16 min, verbal 16 / 11 min, abstrait 12 / 12 min, SJT 8 / 12 min), soit 51 minutes.
2. **Pas de retour en arrière** dans toutes les simulations (cas le plus exigeant ; c'est la règle de nombreux tests actuels). « Passer » est possible mais définitif.
3. **Temps écoulé** : la section se termine ; une réponse complète déjà sélectionnée mais non validée est comptée ; les questions restantes sont « non traitées » (comptées fausses).
4. **Chronomètre** basé sur l'heure réelle (`js/core/timer.js`) : il compare l'heure de départ à l'heure actuelle, donc il continue quand l'app passe en arrière-plan ou que l'écran est verrouillé. La simulation en cours est sauvegardée après chaque réponse : si le téléphone ferme l'app, on la reprend depuis l'accueil, chrono toujours en marche. Quitter propose « Revenir plus tard » ou « Terminer maintenant » ; il n'y a pas de pause, comme dans un vrai test.
5. **Percentile indicatif** : loi normale sur un groupe de référence **fictif** (moyenne 55 à 65 % de réussite selon le module, écart-type 13 à 18 points). Il est présenté partout comme une estimation : les éditeurs utilisent des normes inconnues.
6. **Questions trop lentes** : plus de 1,5 fois le temps cible.

## Entraînement et méthode

7. **Numérique et abstrait générés** : 30 générateurs numériques (`js/gen/numeric.js`) et 14 abstraits (`js/gen/abstract.js`). Réponse calculée par le code ; distracteurs issus d'erreurs typiques étiquetées (base inversée, points vs %, mauvais sens, conversion, simple vs composé, nombre de périodes, mauvaise moyenne, mauvaise donnée lue). Si deux distracteurs donnent le même affichage, on complète par des valeurs voisines (« erreur de calcul »).
8. **Adaptation** : chaque type est tiré avec un poids 1 + 3 × taux d'échec lissé (types jamais vus : poids 3), sur les 400 dernières réponses du module ; les 3 derniers types tirés sont exclus pour varier. En simulation, tirage uniforme.
9. **Suivi par type d'erreur** : chaque réponse fausse enregistre le type d'erreur de la proposition choisie (numérique, abstrait), le piège (verbal : « On ne peut pas savoir » manqué ou en excès, Vrai/Faux inversés), le thème (technique) ou la partie ratée (SJT).
10. **Langue** : en mode « Alternée », les questions numériques alternent FR / EN et les textes verbaux alternent FR / EN. Explications toujours en français. L'abstrait est en français (il n'a pas de texte à traduire).
11. **Répétition espacée** (technique, SJT, anglais) : Leitner à 7 étapes d'English Pro (1, 2, 4, 7, 15, 30, 60 jours). SJT : tout juste = « correct », moitié (meilleure OU pire, ou classement à une inversion voisine près) = « presque », sinon « faux ». Le verbal n'est pas en répétition espacée (demande initiale) : les textes jamais lus passent d'abord, puis les plus anciens.
12. **Notation SJT** : plus/moins efficace = 0,5 point par choix juste ; classement = 1 − (somme des écarts de rang) ÷ 8.
13. **Chrono indicatif** en entraînement (désactivable) : temps passé / temps cible, en orange au-delà.
14. **Calculatrice** sans `eval` (analyse d'expression), avec %, parenthèses, ANS ; disponible pour le numérique et le technique. **Brouillon** par question, non conservé après la série.

## Gamification (`js/core/game.js`)

15. Reprise d'English Pro (XP, série, gels de série : 1 tous les 7 jours, 2 au maximum) **sans les cœurs**.
16. **Objectif quotidien en minutes** (10, 20, 30) mesurées sur le temps réellement passé à répondre, plafonné à 10 min par question : laisser l'app ouverte ne compte pas. Les mini-jeux comptent (plafond 15 min).
17. XP : 10 (juste), 6 (partiel), 2 (faux : on apprend en se trompant), 30 par simulation terminée, 5 par mini-jeu. Niveau : paliers croissants de 200 XP × 1,25.

## Plan de préparation (`js/core/plan.js`)

18. Sur 2 ou 4 semaines avant la date du test (ou à partir d'aujourd'hui si la date est plus proche). Simulation complète à J−28, J−21, J−14, J−7 et J−2 ; veille du test : SJT léger et repos ; les autres jours, deux modules, les plus faibles revenant deux fois plus souvent.

## Candidatures

19. Champs : cabinet, poste, date limite du test, statut (à passer, passé, réussi, refusé), note. Simulation adaptée proposée sur l'accueil dans les **5 jours** avant la date, et mise en avant sur la fiche dans les 7 jours.
20. Rappel `.ics` : événement « journée entière » avec alerte la veille à 9 h et le jour même à 9 h.

## Synchronisation (`js/sync.js`, `js/core/merge.js`)

21. Même mécanisme qu'English Pro, fichier Gist **`big4-prep-progression.json`** (distinct), clé de configuration `big4-prep-sync-v1`.
22. **Même clé GitHub pour les deux apps** : publiées sur `lmontaud.github.io`, elles partagent le stockage local du navigateur. Big4 Prep détecte la clé déjà enregistrée par English Pro et propose « Utiliser la clé déjà enregistrée par English Pro » (un seul appui). Sinon, on colle la même clé.
23. Fusion : fiches = la plus récente ; XP et minutes = compteurs par appareil (maximum par jour) ; journal des réponses et simulations = union par identifiant ; candidatures = modification la plus récente, suppressions propagées ; plan = le plus récent.
24. Journal limité aux 6 000 dernières réponses (environ 60 jours à 100 réponses par jour).

## Contenu

25. **Volumes** : 40 textes verbaux (20 FR, 20 EN, 143 affirmations dont 26 % « On ne peut pas savoir »), 50 SJT (35 plus/moins efficace, 15 classements), 150 questions techniques (50 PCG, 50 calculs, 50 audit et IFRS), 24 questions d'anglais, 5 fiches.
26. Textes et scénarios **originaux**, sociétés fictives (Alvéo, Norvane, Kerlis…). Aucune question d'éditeur reproduite.
27. **Prudence sur les références** : là où je n'étais pas certain d'un numéro d'article du PCG, la référence cite la règle (« PCG, amortissement des actifs ») et la norme IFRS ou ISA précise plutôt qu'un numéro incertain. Les articles du Code de commerce cités (L.123-12 à L.123-22, L.232-10), les NEP / ISA et les paragraphes IFRS ont été choisis parmi ceux dont je suis sûr.
28. **Sujets évités** car modifiés récemment ou incertains : comptes de cessions et résultat exceptionnel (règlement ANC 2022-06 applicable depuis 2025), seuils de nomination du commissaire aux comptes, numérotation des articles du Code de commerce sur les CAC (recodifiée en 2024).
29. Format des fichiers : le verbal est rangé par texte (affirmations à l'intérieur) ; l'application met chaque affirmation à plat avec tous les champs demandés (id, module, langue, type, énoncé, réponse, distracteurs, explication, difficulté, temps cible). Les tests vérifient ces champs sur les items mis à plat.

## Relecture « manager d'audit » (≥ 20 % de chaque banque)

Échantillon relu : 30 questions techniques, 8 textes verbaux (31 affirmations), 10 SJT, plus les items signalés pendant la rédaction. Corrections apportées :
- V13 : « toujours conclues à des conditions défavorables » jugé Faux à tort (le texte dit seulement « peuvent ») → reformulé, réponse « On ne peut pas savoir ».
- V09 : « a progressé chaque année » déduit de « progression régulière » → reformulé en « est en hausse depuis cinq ans ».
- V23 : « four times higher » (ambigu en anglais) → « four times the previous year's amount ».
- T034, T037, T055, T062 et références d'amortissement : numéros d'articles incertains remplacés par la règle et la norme IAS correspondante.
- T041 : référence aux livres comptables corrigée (Code de commerce, art. L.123-12).
- Générateurs : un distracteur « moyenne » mal libellé (« moyenne pondérée » pour un oubli de trimestre) → libellé « mauvaise moyenne ou mauvais dénominateur » ; ratio de liquidité ramené à des valeurs réalistes (≤ 6) ; part de marché limitée à ±60 % de variation relative ; bug de la règle « +2, −1 » corrigé (elle produisait +1).

## Ce qui n'a pas pu être testé

- Installation réelle sur iPhone et Android, et notifications (testé dans Chrome desktop en vue mobile, y compris le hors ligne via service worker).
- Synchronisation avec le vrai GitHub : testée avec un GitHub simulé (création du Gist, fusion entre deux appareils). La réutilisation de la clé d'English Pro suppose que les deux apps sont servies depuis la même adresse `lmontaud.github.io`.
- Ouverture du fichier `.ics` dans les calendriers iOS / Google (format validé par les tests).
