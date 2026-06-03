"""Module Marketing — diffusion digitale des unités (vente ET location).

Campagnes (`marketing_campaigns`) reliant des unités à un canal et une période,
métriques (vues/clics/leads/dépense), publication via connecteurs STUBS, et
boucle de retour `inbound-lead` qui alimente le CRM existant.
Suit le pattern router/schemas/service/test, filtré par `company_id` (Loi 1).
"""

from app.routers.marketing.router import router

__all__ = ["router"]
