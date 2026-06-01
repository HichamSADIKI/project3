# Asterisk — Téléphonie Immobilier SGI (dev)

Service de téléphonie WebRTC pour le centre de contact intégré à la rubrique
**Communication** du backoffice. Image custom (Debian bookworm + Asterisk 20 LTS).

> ⚠️ **Dev only.** Certificat TLS auto-signé, secrets de dev, extensions de
> test. Pour la prod : trunk SIP opérateur UAE, certificats réels, comptes
> agents provisionnés dynamiquement, durcissement AMI (TLS + ACL).

## Composants

| Fichier | Rôle |
|---|---|
| `Dockerfile` | Image Asterisk 20 + notre config applicative |
| `entrypoint.sh` | Génère le cert TLS (WSS) + injecte le secret AMI, puis lance Asterisk |
| `config/http.conf` | Serveur HTTP → WebSocket SIP (ws 8088 / wss 8089) |
| `config/pjsip.conf` | Transports ws/wss/udp + 2 agents WebRTC de test (6001, 6002) |
| `config/manager.conf` | AMI `sgi-api` (template, secret injecté) — consommé par l'API en phase 2 |
| `config/extensions.conf` | Dialplan : `600` echo test · `6001/6002` appels internes · `700` file `support` |
| `config/rtp.conf` | Plage RTP 10000-10100 |
| `config/queues.conf` | File d'attente démo `support` |

## Ports

| Port | Usage | Publié ? |
|---|---|---|
| 8088 | WebSocket SIP (ws) | oui |
| 8089 | WebSocket SIP TLS (wss, WebRTC) | oui |
| 5038 | AMI | **non** (réseau `backend` uniquement) |
| 10000-10100/udp | RTP (média) | oui |

## Démarrer

```bash
docker compose up -d --build asterisk
docker compose logs -f asterisk     # vérifier le démarrage
```

## Vérification Phase 1 (critère de sortie)

1. **Service up** : `docker compose ps asterisk` → `running`.
2. **Modules WebRTC chargés** :
   ```bash
   docker compose exec asterisk asterisk -rx "module show like websocket"
   docker compose exec asterisk asterisk -rx "pjsip show transports"
   ```
3. **Endpoints de test présents** :
   ```bash
   docker compose exec asterisk asterisk -rx "pjsip show endpoints"
   ```
4. **Enregistrement softphone** : configurer un softphone WebRTC (ex. extension
   navigateur, ou le widget JsSIP de la phase 3) avec
   `wss://localhost:8089/ws`, user `6001`, secret `sgi-dev-6001` →
   l'AOR 6001 doit apparaître `Avail` :
   ```bash
   docker compose exec asterisk asterisk -rx "pjsip show aor 6001"
   ```
5. **Média** : appeler `600` (echo test) → on s'entend en écho.

> Le certificat étant auto-signé, le navigateur doit accepter
> `https://localhost:8089` une première fois (avertissement TLS).

## Notes WebRTC en Docker

Le média RTP traverse les ports publiés ; pour du dev local (navigateur et
Asterisk sur la même machine) les candidats ICE `host`/`srflx` vers `127.0.0.1`
suffisent. Pour un accès distant, prévoir `external_media_address` /
`external_signaling_address` (NAT) — à traiter quand la trunk opérateur sera
ajoutée.
