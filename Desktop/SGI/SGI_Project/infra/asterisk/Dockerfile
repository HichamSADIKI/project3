# Asterisk 16 — image de dev pour la téléphonie Immobilier SGI.
# Base Debian bullseye (11) : asterisk est dans `main` (paquet binaire, pas de
# compilation). NB : Debian bookworm (12) a RETIRÉ le paquet asterisk, d'où
# bullseye. Notre config applicative écrase les defaults Debian ; les fichiers
# non fournis (asterisk.conf, modules.conf, logger.conf) restent ceux du
# paquet → chemins de modules corrects + autoload=yes. Toutes les features
# utilisées (chan_pjsip, res_http_websocket, webrtc=yes, dtls_auto_generate_cert,
# MixMonitor) sont supportées par Asterisk 16.

FROM debian:bullseye-slim

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      asterisk asterisk-config \
      openssl gettext-base ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Configuration applicative SGI (dev). manager.conf est un template : le secret
# AMI est injecté au démarrage depuis $AMI_PASSWORD (jamais en clair dans l'image).
COPY config/pjsip.conf      /etc/asterisk/pjsip.conf
COPY config/http.conf       /etc/asterisk/http.conf
COPY config/manager.conf    /etc/asterisk/manager.conf.template
COPY config/extensions.conf /etc/asterisk/extensions.conf
COPY config/rtp.conf        /etc/asterisk/rtp.conf
COPY config/queues.conf     /etc/asterisk/queues.conf
COPY entrypoint.sh          /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh

# 8088 ws · 8089 wss (signalisation WebRTC) · 5038 AMI (interne) · RTP média
EXPOSE 8088 8089 5038
EXPOSE 10000-10100/udp

ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
