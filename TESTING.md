# Guide de test — Dpiptv

Ce dépôt est un fork de [iptv-org/iptv](https://github.com/iptv-org/iptv) : une collection de playlists IPTV (`streams/*.m3u`) accompagnée de scripts de validation et d'une suite de tests.

## Prérequis

- **Node.js 22** (version utilisée par la CI)
- Connexion internet (l'installation télécharge les données de l'API iptv-org, nécessaires à la validation)

## Installation

```bash
npm install
```

> Le hook `postinstall` exécute automatiquement `npm run api:load`, qui télécharge les données de référence (chaînes, pays, flux…) dans `temp/data`. Dans les sessions Claude Code sur le web, tout ceci est fait automatiquement au démarrage par le hook `.claude/hooks/session-start.sh`.

## Tester le code (scripts)

```bash
# Suite de tests complète (Jest) — ~20 s
npm test

# Un seul fichier de test
npx jest tests/commands/playlist/validate.test.ts

# Lint du code TypeScript (ESLint)
npm run lint
```

## Tester les playlists

```bash
# Lint M3U (syntaxe, ordre des chaînes…) — un fichier ou plusieurs
npm run playlist:lint -- streams/fr.m3u

# Validation contre la base iptv-org (IDs de chaînes, doublons…)
npm run playlist:validate -- streams/fr.m3u

# Formater une playlist selon les règles du projet
npm run playlist:format -- streams/fr.m3u
```

> Les *warnings* « is not in the database » sont non bloquants (présents aussi sur le repo upstream). Seuls les **errors** font échouer la CI.

## Tester les flux (est-ce que les chaînes marchent ?)

```bash
# Teste la disponibilité réelle de chaque flux d'une playlist
npm run playlist:test -- streams/fr.m3u

# Options utiles :
#   -t 10000        timeout de 10 s par flux
#   -p 8            8 flux testés en parallèle
#   --fix           supprime automatiquement les liens morts du fichier
npm run playlist:test -- streams/fr.m3u -- -t 10000 --fix
```

⚠️ Ce test nécessite un accès internet direct aux serveurs de streaming ; il peut être long sur les grosses playlists.

## Tester sur smartphone — lecteur web intégré 📱

Le fichier [`player.html`](player.html) est un mini lecteur IPTV (une seule page, sans dépendance à installer) pensé pour tester les playlists depuis un téléphone :

- sélection de playlist par pastilles (FR, CH, BE…) ou par code libre (`us`, `uk_sport`…)
- liste des chaînes avec logo, groupe et recherche instantanée
- lecture HLS directe dans le navigateur (hls.js, ou HLS natif sur iPhone)
- bouton ⧉ sur chaque chaîne pour copier le lien du flux et l'ouvrir dans VLC

**Pour l'activer** : dans GitHub → *Settings → Pages → Deploy from a branch*, choisir la branche et le dossier `/ (root)`. La page est ensuite accessible à :

```
https://dp287517.github.io/Dpiptv/player.html
```

> ⚠️ Limites du navigateur (pas de la playlist) : les flux en `http://` non sécurisé et les serveurs sans en-têtes CORS ne sont pas lisibles depuis une page web — la page l'indique et propose de copier le lien vers VLC. Une app IPTV (TiviMate, IPTV Smarters, GSE…) reste la référence pour un test complet.

## Tester dans un lecteur vidéo (VLC, etc.)

Colle l'URL brute d'une playlist de ton fork dans VLC (*Média → Ouvrir un flux réseau*) :

```
https://raw.githubusercontent.com/dp287517/Dpiptv/master/streams/fr.m3u
```

Remplace `fr.m3u` par n'importe quel fichier de `streams/` (voir [PLAYLISTS.md](PLAYLISTS.md) pour la liste complète).

## CI (GitHub Actions)

Le workflow `.github/workflows/check.yml` s'exécute sur chaque pull request : il lance `playlist:lint` puis `playlist:validate` sur les fichiers de `streams/` modifiés. Pour reproduire la CI en local sur tes fichiers modifiés :

```bash
git diff --diff-filter=ACMRT --name-only master -- streams/ | xargs npm run playlist:lint --
git diff --diff-filter=ACMRT --name-only master -- streams/ | xargs npm run playlist:validate --
```
