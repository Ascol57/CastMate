# Roadmap — Internationalisation de CastMate

## Phase 0 — Préparation (1-2 jours)

**Objectif** : Mettre en place l'infrastructure i18n sans rien traduire encore.

- [ ] Ajouter `vue-i18n@^9` aux dépendances de `packages/castmate` et `libs/castmate-ui-core`
- [ ] Créer la structure `packages/castmate/src/renderer/i18n/`
  - `index.ts` — instance i18n, config, liste des locales supportées
  - `locales/en.json` — **locale de référence (source des clés, fallback)**
  - `locales/fr.json`
  - `locales/de.json`
  - `locales/es.json`
  - `locales/pt.json`
- [ ] Initialiser vue-i18n dans [packages/castmate/src/renderer/index.ts](packages/castmate/src/renderer/index.ts) après PrimeVue, avec `fallbackLocale: 'en'`
- [ ] **Détection auto** au premier lancement : lire `navigator.language`, mapper sur les locales supportées (`fr-FR` → `fr`, `pt-BR` → `pt`, etc.), fallback `en` si non supportée
- [ ] Créer un **store Pinia `useLocaleStore`** : locale active + persistance via les préférences CastMate existantes
- [ ] Brancher la locale PrimeVue sur le store (réactivité automatique sur changement, import des locales PrimeVue correspondantes)
- [ ] Ajouter un **sélecteur de langue** dans les Settings (Settings → General → Language) avec drapeaux/noms natifs (Français, English, Deutsch, Español, Português)

**Critère de sortie** : on peut changer de langue dans Settings, PrimeVue suit, persistance OK, mais l'UI reste en anglais.

---

## Phase 1 — App principale (3-5 jours)

**Objectif** : Traduire tout ce qui est dans `packages/castmate` (hors plugins).

- [ ] **Convention de clés** : `<scope>.<feature>.<key>` — ex: `system.menu.file`, `dialog.newProfile.title`
- [ ] [App.vue](packages/castmate/src/renderer/App.vue) : titre fenêtre, "Loading CastMate"
- [ ] [SystemBar.vue](packages/castmate/src/renderer/components/system/SystemBar.vue) (lignes 152–256) : menus File / Help / About / Discord + dialogues "New Profile", "New Automation"
- [ ] Autres composants système (settings panels, onboarding, error boundaries)
- [ ] Toasts et notifications globaux
- [ ] **Tooling** : script `yarn i18n:extract` (à écrire) qui scanne les `.vue` pour repérer les chaînes oubliées

**Critère de sortie** : l'application "vide" (sans plugins activés) est entièrement traduite en FR.

---

## Phase 2 — Bibliothèque UI partagée (3-4 jours)

**Objectif** : Traduire `libs/castmate-ui-core` — composants réutilisés par tous les plugins.

- [ ] Audit des chaînes dans `libs/castmate-ui-core/src/components/`
- [ ] Convention : préfixe `uiCore.*` pour éviter les collisions avec les plugins
- [ ] Composants prioritaires : data inputs, sélecteurs (Trigger, Profile, Automation), éditeurs de schéma
- [ ] Messages de validation (form errors)
- [ ] Autres `libs/` à traiter : `castmate-dashboard-renderer`, `castmate-overlay-renderer` si UI utilisateur

**Critère de sortie** : tous les widgets génériques sont traduits, indépendamment des plugins.

---

## Phase 3 — Stratégie plugins (2-3 jours, infra + prototype)

**Objectif** : Mettre en place l'architecture i18n par plugin et valider sur un plugin pilote.

### Principe retenu : traductions embarquées dans chaque plugin

Chaque plugin héberge ses propres fichiers de traduction dans son dossier. Au chargement du plugin côté renderer, ses traductions sont fusionnées dans l'instance i18n globale.

**Structure par plugin** :
```
plugins/obs/
├── main/
│   └── src/
│       └── main.ts              ← émet des CLÉS (ex: "obs.plugin.name")
└── renderer/
    └── src/
        ├── main.ts              ← appelle registerPluginLocales() au init
        └── locales/
            ├── en.json          ← source de référence
            ├── fr.json
            ├── de.json
            ├── es.json
            └── pt.json
```

**Avantages de cette approche** :
- Les traductions vivent à côté du code qui les utilise (cohésion)
- Un contributeur qui ajoute un plugin tiers fournit ses propres traductions sans toucher au cœur
- Pas de fichier de traduction monolithique géant à maintenir
- Suppression d'un plugin = suppression automatique de ses traductions

### Convention de clés

- Plugin metadata : `<pluginId>.plugin.name`, `<pluginId>.plugin.description`
- États : `<pluginId>.states.<stateId>.name`, `<pluginId>.states.<stateId>.description`
- Actions : `<pluginId>.actions.<actionId>.name`, `<pluginId>.actions.<actionId>.description`
- Triggers : `<pluginId>.triggers.<triggerId>.name`, `<pluginId>.triggers.<triggerId>.description`
- Settings : `<pluginId>.settings.<settingId>.label`
- UI custom du plugin : `<pluginId>.ui.<...>`

### Mécanisme d'injection côté renderer

Helper à créer dans `castmate-ui-core` :
```ts
import en from "./locales/en.json"
import fr from "./locales/fr.json"
import de from "./locales/de.json"
import es from "./locales/es.json"
import pt from "./locales/pt.json"

registerPluginLocales("obs", { en, fr, de, es, pt })
```
Appelé dans le `initPlugin(app)` de chaque plugin renderer (cf. [packages/castmate/src/renderer/index.ts](packages/castmate/src/renderer/index.ts) lignes 200–229 où les plugins sont initialisés). Le helper fait un `i18n.mergeLocaleMessage()` pour chaque locale, en namespacant sous l'ID du plugin.

### Stratégie côté main process

Le `main` émet des **clés** (pas des chaînes traduites). Cela évite tout IPC de locale et garde le main agnostique. Le renderer résout la clé au moment de l'affichage via `$t()`.
- `castmate-core` n'a aucune modification de fond — il transporte juste des strings
- Si une chaîne dynamique doit être construite côté main (rare), utiliser un format de clé + paramètres : `{ key: "obs.error.cantConnect", params: { host: "..." } }`

### Tâches Phase 3

- [ ] Créer le helper `registerPluginLocales()` dans `castmate-ui-core`
- [ ] Le câbler à l'instance i18n principale (merge automatique)
- [ ] Prototyper sur **1 plugin pilote** : `plugins/time` (petit, peu de chaînes)
- [ ] Vérifier le hot-reload des traductions en dev
- [ ] Documenter le workflow dans [DEVELOPERS.md](DEVELOPERS.md) section "Translating a plugin"
- [ ] Optionnel : script `yarn i18n:check` qui audite la cohérence des clés `en.json`/`fr.json` de chaque plugin

**Critère de sortie** : plugin `time` entièrement traduit avec ses traductions dans `plugins/time/renderer/src/locales/`, doc claire pour reproduire sur les autres plugins.

---

## Phase 4 — Plugins prioritaires (1-2 semaines)

**Objectif** : Traduire les plugins les plus utilisés, par ordre d'impact.

Ordre suggéré (du plus utilisé au moins utilisé) :
1. [ ] `plugins/obs` — central pour le streaming
2. [ ] `plugins/twitch` — central pour les streamers Twitch
3. [ ] `plugins/discord`
4. [ ] `plugins/overlays`
5. [ ] `plugins/input` (raccourcis, hotkeys)
6. [ ] `plugins/sound` + `plugins/tts`
7. [ ] `plugins/variables`, `plugins/time`, `plugins/random`
8. [ ] `plugins/http`, `plugins/os`

**Critère de sortie** : un streamer FR/DE/ES/PT peut utiliser CastMate avec OBS + Twitch entièrement dans sa langue.

---

## Phase 5 — Plugins restants (1 semaine)

**Objectif** : Couvrir les 15-20 plugins restants (Spotify, PhilipsHue, Minecraft, etc.).

- [ ] Itérer plugin par plugin avec le pattern établi
- [ ] Possibilité de parallélisation si plusieurs contributeurs

---

## Phase 6 — Process Electron main (2-3 jours)

**Objectif** : Traduire les chaînes côté Node (rares mais existantes).

- [ ] Boîtes de dialogue Electron natives (erreurs critiques au démarrage)
- [ ] Messages de logs utilisateur (si exposés dans l'UI)
- [ ] Notifications système (tray icon, etc.)
- [ ] **Mécanisme** : main reçoit la locale au startup + sur changement via IPC

---

## Phase 7 — Qualité & livraison (5-8 jours)

- [ ] **Relecture native** par langue :
  - FR : relecture par toi-même
  - EN : source — relecture rédactionnelle
  - DE / ES / PT : à faire relire par des locuteurs natifs (communauté, traducteurs pro, ou IA en première passe puis review humaine)
- [ ] **Tests visuels** : vérifier les débordements de texte sur les 5 langues
  - DE typiquement +30% vs EN (mots longs)
  - FR / ES / PT typiquement +15-25% vs EN
  - Vérifier les boutons, menus, tooltips, labels de formulaires
- [ ] **Tooling de complétude** :
  - Script `yarn i18n:check` qui détecte les clés manquantes entre `en.json` (référence) et les autres locales, pour chaque plugin et pour l'app principale
  - Output : tableau des % de complétude par langue × par plugin
  - Linter custom pour interdire les nouvelles chaînes hard-codées dans les `.vue`
- [ ] **Fallback** : EN reste le fallback automatique si une clé manque dans une autre locale (config vue-i18n)
- [ ] **Documentation contributeur** : section "Adding translations" dans [DEVELOPERS.md](DEVELOPERS.md) — comment ajouter une langue, comment traduire un plugin
- [ ] **Tests** : tester les scénarios critiques sur chacune des 5 langues (création profil, automation, connexion OBS/Twitch)

---

## Phase 8 — Extension communautaire (futur)

**Objectif** : Permettre à la communauté d'ajouter des langues au-delà des 5 initiales (JA, ZH, RU, IT, NL, PL, etc.).

- [ ] Architecture déjà prête (5 langues opérationnelles dès la v1 valident le pattern)
- [ ] Possibilité d'utiliser une plateforme type Crowdin/Weblate pour faciliter les contributions
- [ ] Doc pour les traducteurs : comment ajouter une nouvelle langue (ajout du fichier, enregistrement dans la liste des locales, soumission via PR)

---

## Estimation totale

| Phase | Durée |
|-------|-------|
| Phase 0 — Infra (5 locales) | 2-3 jours |
| Phase 1 — App principale (×5 langues) | 5-7 jours |
| Phase 2 — UI Core (×5 langues) | 4-6 jours |
| Phase 3 — Stratégie plugins | 2-3 jours |
| Phase 4 — Plugins prioritaires (×5 langues) | 2-3 semaines |
| Phase 5 — Plugins restants (×5 langues) | 1.5-2 semaines |
| Phase 6 — Main process | 2-3 jours |
| Phase 7 — Qualité (5 relectures) | 5-8 jours |
| **Total** | **~7-10 semaines** à temps plein |

> ⚠️ **Impact du choix 5 langues** : volume de traduction multiplié par ~2.5 vs FR+EN seulement. Stratégie possible pour accélérer : traduire d'abord FR (par toi) et EN (source), puis utiliser une IA (Claude/DeepL) pour DE/ES/PT en première passe, et faire reviewer par des locuteurs natifs en Phase 7.

---

## Décisions actées

- **Stratégie plugins** : traductions embarquées **dans chaque plugin** (`plugins/<id>/renderer/src/locales/`), enregistrées dans l'i18n global au chargement via un helper `registerPluginLocales()`. Le main émet des clés, le renderer résout.
- **Langues v1** : **FR, EN, DE, ES, PT** (5 langues dès le départ). EN reste la langue de référence (fallback) et la source des clés.
- **Locale par défaut** : **détection automatique via `navigator.language`** au premier lancement, avec fallback EN si la langue détectée n'est pas supportée. Choix utilisateur ensuite persisté dans les préférences.
- **Format de fichiers** : **JSON** (natif vue-i18n, compatible outils de traduction tiers type Crowdin/Weblate).
- **Workflow Git** : **PR par phase + PR par plugin**. Branche `translation` comme branche d'intégration. Chaque phase merge dans `translation`, et `translation` merge dans `main` à des jalons stables.
- **Branche actuelle** : `translation`
