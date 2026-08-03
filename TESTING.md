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

### Proxy de flux (pour les chaînes bloquées par le navigateur)

Les navigateurs bloquent deux catégories de flux : ceux en `http://` non sécurisé (mixed content) et ceux dont le serveur n'envoie pas d'en-têtes CORS. Le lecteur intègre un **proxy de flux** qui contourne ces deux blocages :

- **Mode automatique (par défaut)** : si la lecture directe échoue, le lecteur retente via le proxy, sans intervention.
- Réglable via ⚙️ en haut de la page : toujours / automatique / désactivé, et URL du proxy.
- Par défaut le lecteur utilise un proxy public (corsproxy.io) — pratique mais lent et limité.

**Pour un proxy personnel fiable (gratuit, ~5 min)** : déploie [`proxy-worker.js`](proxy-worker.js) sur Cloudflare Workers (instructions en tête du fichier), puis colle son URL dans ⚙️ : `https://<ton-worker>.workers.dev/?url={url}`. Ce worker réécrit aussi les manifests HLS côté serveur, ce qui fait fonctionner la lecture HLS native (anciens iPhone).

### Ouvrir dans VLC en un tap

Chaque chaîne a un bouton **VLC** (et les messages d'erreur en proposent un gros) : sur iPhone il ouvre l'app VLC directement sur le flux (`vlc-x-callback://`), sur Android via un intent. VLC lit tout — http, CORS, DASH — c'est la valeur sûre quand le navigateur bloque.

> ⚠️ Ce qui restera illisible partout : les chaînes **mortes** (lien cassé) et les chaînes **géo-bloquées** hors de leur pays (ex. les chaînes marquées `[Geo-blocked]`). Utilise `npm run playlist:test -- streams/xx.m3u --fix` pour purger les liens morts.

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
