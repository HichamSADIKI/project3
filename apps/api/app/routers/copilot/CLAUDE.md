# AI Copilot — assistance agent (module `copilot`, pas de migration)

Module `copilot` (`/api/v1/copilot`) **sans table propre** : il agrège en lecture seule le contexte d'une conversation `inbox` **ou** d'un ticket `ticketing` et renvoie un paquet d'assistance. `POST /copilot/assist` → brouillon de réponse + résumé + sentiment + intention + next-best-actions. Filtré `company_id` (Loi 1) ; un simple **agent** n'assiste que SES items assignés (anti-BOLA : 404, jamais 403).

- **Synchrone mais non bloquant** : `generate_text` (Gemini) a un timeout court (8 s) et retombe sur un **repli heuristique déterministe** (`heuristic_reply`, `heuristic_summary`, `detect_sentiment`, `detect_intent`, `next_best_actions`) — testable sans clé ni DB. `_combine_engines` indique quelle source (Gemini vs heuristique) a produit chaque champ.
- Pas de tâche Celery, pas de proxy de nav dédié (consommé depuis les écrans Inbox/Tickets).
