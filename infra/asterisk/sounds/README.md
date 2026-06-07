# Prompts vocaux personnalisés — annonce de consentement PDPL

Conformité **PDPL UAE** (Federal Decree-Law No. 45 of 2021) : tout appel
enregistré doit être précédé d'une **annonce de consentement** informant
l'interlocuteur. Sur le marché UAE elle est diffusée en **arabe puis anglais**.

## Assets attendus

Déposer deux fichiers audio dans le conteneur Asterisk sous
`/var/lib/asterisk/sounds/custom/` :

| Fichier | Contenu |
|---|---|
| `pdpl-notice-ar.wav` (ou `.ulaw`/`.gsm`) | Annonce de consentement en **arabe** |
| `pdpl-notice-en.wav` | Annonce de consentement en **anglais** |

Format recommandé : WAV PCM 8 kHz mono (ou `.ulaw`). Texte type :

> « Cet appel est susceptible d'être enregistré à des fins de qualité de service
>  et conformément à la loi UAE sur la protection des données. »

## Activation

Pointer les variables du dialplan (`infra/asterisk/config/extensions.conf`,
section `[globals]`) sur ces prompts (sans l'extension) :

```
PDPL_NOTICE_AR=custom/pdpl-notice-ar
PDPL_NOTICE_EN=custom/pdpl-notice-en
```

La macro `[macro-pdpl-record]` diffuse `PDPL_NOTICE_AR` puis `PDPL_NOTICE_EN`
avant d'armer `MixMonitor`.

## Provisioning dans l'image

Pour figer les prompts dans l'image, ajouter au `Dockerfile` :

```dockerfile
COPY sounds/custom/ /var/lib/asterisk/sounds/custom/
```

Tant qu'aucun asset n'est fourni, les variables valent `beep` (dev) : la chaîne
de consentement reste fonctionnelle mais neutre.

## Génération (optionnel)

Les prompts peuvent être générés via un service TTS (ex. Google Cloud
Text-to-Speech, voix `ar-XA` et `en-US`) puis convertis :

```bash
ffmpeg -i pdpl-ar.mp3 -ar 8000 -ac 1 pdpl-notice-ar.wav
```
