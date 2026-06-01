"""Module Téléphonie — centre de contact (Asterisk WebRTC) intégré à la
rubrique Communication. Journal d'appels, présence agent, pont AMI → WebSocket."""

from app.routers.telephony.router import router

__all__ = ["router"]
