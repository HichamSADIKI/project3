# CLAUDE.md — apps/web (Backoffice)

## Stack
Next.js 16.2 · App Router · Turbopack · React 19 · TypeScript 5 · Tailwind v4 · shadcn/ui RTL

## Règles absolues
- CSS logique uniquement : ms-/me-/ps-/pe-/start-/end- (jamais ml-/mr-/pl-/pr-)
- Server Components par défaut — "use client" uniquement si hooks/events nécessaires
- Montants : Intl.NumberFormat("en-AE", { currency: "AED" }) — chiffres latins toujours
- TanStack Query pour tout state serveur — Zustand pour l'UI state uniquement

## Route groups
- (auth)      : login, forgot-password, reset — pas de sidebar
- (dashboard) : layout avec sidebar · tous les modules métier

## Chargement skill recommandé
- rtl-components (composants UI)
- fastapi-patterns (appels API)
