#!/bin/sh
# Entrypoint Asterisk SGI (dev) :
#   1. génère un certificat TLS auto-signé pour le WSS (signalisation WebRTC) ;
#   2. injecte le secret AMI dans manager.conf depuis $AMI_PASSWORD ;
#   3. lance Asterisk au premier plan.
set -e

KEYS=/etc/asterisk/keys
mkdir -p "$KEYS"

# ── 1. Certificat TLS auto-signé (WSS) — dev uniquement ───────────────────
if [ ! -f "$KEYS/asterisk.crt" ]; then
  echo "[entrypoint] Génération du certificat TLS auto-signé (dev)…"
  openssl req -new -x509 -days 3650 -nodes \
    -newkey rsa:2048 \
    -subj "/CN=${ASTERISK_TLS_CN:-asterisk.sgi.local}" \
    -keyout "$KEYS/asterisk.key" \
    -out "$KEYS/asterisk.crt"
fi

# ── 2. Secret AMI injecté (hors image) ────────────────────────────────────
export AMI_PASSWORD="${AMI_PASSWORD:-sgi-dev-ami-secret}"
envsubst '${AMI_PASSWORD}' \
  < /etc/asterisk/manager.conf.template \
  > /etc/asterisk/manager.conf

chown -R asterisk:asterisk "$KEYS" /etc/asterisk/manager.conf

# ── 3. Lancement ──────────────────────────────────────────────────────────
echo "[entrypoint] Démarrage d'Asterisk…"
exec /usr/sbin/asterisk -f -U asterisk -G asterisk
