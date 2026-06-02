# Intégration SGI ↔ Asterisk 11 (chan_sip) — click-to-call via AMI

Ce runbook connecte SGI à un **Asterisk 11 existant** sur le LAN
(`192.168.1.160:5060`) en mode **click-to-call + journalisation** :

- L'**agent** parle sur son **téléphone/softphone** (poste physique, Zoiper,
  MicroSIP…) enregistré comme l'**extension SIP `1012`** (`infinity@1012`) sur
  `192.168.1.160:5060`. **SGI n'utilise PAS ces identifiants SIP.**
- **SGI** se connecte via l'**AMI** (Asterisk Manager Interface) pour
  **déclencher** l'appel (action `Originate`), recevoir les **événements**
  (sonnerie/décroché/raccroché) et **journaliser** le CDR + faire le screen-pop.
- L'audio ne transite **pas** par le navigateur (pas de WebRTC). Pour un
  softphone dans l'UI, voir les options « WebRTC » / « passerelle » (hors scope).

```
Navigateur SGI ──(REST /telephony/calls/click-to-call)──► API SGI
                                                            │ AMI (TCP 5038)
                                                            ▼
Téléphone agent (SIP 1012) ◄──── Asterisk 11 (192.168.1.160) ────► Client (n° composé)
```

## 1. Côté serveur Asterisk 11 — à faire par l'admin

### a) Créer un utilisateur AMI dédié à SGI

Éditer `/etc/asterisk/manager.conf` :

```ini
[general]
enabled = yes
port = 5038
bindaddr = 0.0.0.0          ; ou l'IP LAN 192.168.1.160

[sgi-ami]
secret = <CHOISIR_UN_SECRET_FORT>
; Autoriser UNIQUEMENT la machine qui héberge SGI (IP LAN de ce poste/serveur).
; En Docker Desktop, le trafic du conteneur sort via l'IP LAN de l'hôte.
deny = 0.0.0.0/0.0.0.0
permit = 192.168.1.0/255.255.255.0     ; ← restreindre au LAN (ou à l'IP exacte de SGI)
read = system,call,log,verbose,agent,user,dtmf,reporting,cdr,dialplan
write = system,call,agent,user,command,reporting,originate
```

Recharger sans couper les appels :

```bash
asterisk -rx "manager reload"
asterisk -rx "manager show users"      # vérifier que sgi-ami apparaît
```

### b) Confirmer l'extension SIP de l'agent (déjà existante)

Dans `sip.conf`, le peer `[1012]` existe déjà (c'est l'extension fournie). Le
téléphone de l'agent doit y être enregistré :

```bash
asterisk -rx "sip show peers"          # 1012 doit être "OK" (registered)
```

### c) Identifier le **contexte d'appel sortant**

L'`Originate` de SGI compose le numéro client dans un **contexte de dialplan**.
Il faut le contexte qui sait joindre l'extérieur (le trunk). Le trouver dans
`sip.conf` (`context=...` du peer 1012) puis dans `extensions.conf` :

```bash
asterisk -rx "dialplan show <contexte>"   # ex. from-internal
```

➡️ **Communiquer ce nom de contexte** : il va dans `TELEPHONY_ORIGINATE_CONTEXT`
(par défaut `from-internal` dans le `.env`).

### d) Réseau

Ouvrir le **TCP 5038** (AMI) de `192.168.1.160` vers la machine SGI (pare-feu LAN).
Le **5060** (SIP) reste pour le téléphone de l'agent, pas pour SGI.

## 2. Côté SGI — configuration (`.env`)

```bash
AMI_HOST=192.168.1.160
AMI_PORT=5038
AMI_USER=sgi-ami
AMI_PASSWORD=<le secret choisi en 1.a>
TELEPHONY_CHANNEL_TECH=SIP          # Asterisk 11 = chan_sip → canal SIP/1012
TELEPHONY_ORIGINATE_CONTEXT=from-internal   # ← le contexte trouvé en 1.c
TELEPHONY_AMI_ENABLED=true
TELEPHONY_ASSUME_RECORDING_CONSENT=false    # pas d'enregistrement distant
```

Puis redémarrer l'API : `docker compose up -d api` (ou `make up`).

## 3. Vérification

```bash
# Connectivité AMI depuis l'hôte SGI
nc -vz 192.168.1.160 5038

# Logs API : doit afficher "AMI connecté 192.168.1.160:5038"
make logs s=api | grep -i ami
```

Dans l'UI SGI : **Communication → Appels**, l'agent renseigne son extension
`1012`, puis lance un **click-to-call** vers un numéro. Le poste de l'agent
sonne d'abord ; en décrochant, Asterisk compose le client. Les événements
(sonnerie/décroché/raccroché) et le CDR apparaissent dans SGI.

## 4. Limites connues (Asterisk 11)

- **Pas de softphone navigateur** : le WebRTC d'Asterisk 11 est expérimental et
  aucun port WSS n'est exposé. L'agent utilise un vrai téléphone/softphone SIP.
- **Pas d'enregistrement** : `MixMonitor` + volume partagé ne sont pas
  disponibles sur l'Asterisk distant → `recording_consent=false`, aucun upload.
- **Événements** : Asterisk 11 émet `Dial` (`SubEvent: Begin/End`) au lieu de
  `DialBegin`/`DialEnd` ; SGI gère les deux familles.
- `ChannelId` (UNIQUEID forcé) est ignoré par Asterisk 11 (≥14 requis) — sans
  impact sur le click-to-call ni la journalisation.

## 5. Évolutions possibles

- **Softphone dans l'UI** : mettre une **passerelle WebRTC** (Asterisk ≥18 ou
  Kamailio) en trunk SIP devant l'Asterisk 11 → réutilise le softphone JsSIP de
  SGII (WSS 8089) sans toucher au serveur 11.
- **Enregistrement** : activer `MixMonitor` côté Asterisk 11 + un partage
  réseau lisible par le worker d'upload SGI.
