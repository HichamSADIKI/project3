# Skill : rtl-components
# RTL Arabic — Composants Next.js RTL-safe

## Quand charger ce skill

- Création d'un composant UI partagé
- Revue d'un composant pour conformité RTL
- Setup initial Next.js (shadcn migrate rtl)
- Debug d'un layout cassé en arabe

---

## Règle absolue — CSS logique uniquement

### Interdit dans tout composant partagé

| Propriété physique | Propriété logique |
|---|---|
| `ml-*` | `ms-*` (margin-inline-start) |
| `mr-*` | `me-*` (margin-inline-end) |
| `pl-*` | `ps-*` (padding-inline-start) |
| `pr-*` | `pe-*` (padding-inline-end) |
| `left-*` | `start-*` |
| `right-*` | `end-*` |
| `text-left` | `text-start` |
| `text-right` | `text-end` |
| `border-l` | `border-s` |
| `border-r` | `border-e` |
| `rounded-l-*` | `rounded-s-*` |
| `rounded-r-*` | `rounded-e-*` |

---

## Setup initial (une seule fois)

```bash
# 1. Installer shadcn avec New York style
npx shadcn@latest init
# → Style: New York | Base color: Zinc | CSS variables: Yes | Tailwind v4

# 2. Migrer tous les composants shadcn vers CSS logique
npx shadcn@latest migrate rtl
# → Remplace automatiquement ml-/mr-/pl-/pr- par ms-/me-/ps-/pe-

# 3. ESLint rule — bloquer les propriétés physiques
# → Configurée dans eslint.config.js (voir skill nginx-security pour ESLint)
```

---

## RootLayout — DirectionProvider + fonts

```tsx
// apps/web/app/layout.tsx
import { DirectionProvider } from "@radix-ui/react-direction";
import { Geist, Noto_Sans_Arabic } from "next/font/google";
import { cookies } from "next/headers";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const notoArabic = Noto_Sans_Arabic({
  subsets: ["arabic"],
  variable: "--font-arabic",
  weight: ["400", "500", "600", "700"],
});

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get("locale")?.value ?? "ar";
  const dir = locale === "ar" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${geist.variable} ${notoArabic.variable}`}>
      <body className={locale === "ar" ? "font-arabic" : "font-geist"}>
        <DirectionProvider dir={dir}>
          {children}
        </DirectionProvider>
      </body>
    </html>
  );
}
```

---

## Tailwind CSS v4 — config fonts

```css
/* apps/web/app/globals.css */
@import "tailwindcss";

@theme {
  --font-geist: var(--font-geist), ui-sans-serif, system-ui;
  --font-arabic: var(--font-arabic), "Noto Sans Arabic", ui-sans-serif;
}
```

---

## i18next — setup multilingue AR/EN/FR

```ts
// packages/i18n/config.ts
import i18next from "i18next";
import { initReactI18next } from "react-i18next";

i18next.use(initReactI18next).init({
  fallbackLng: "ar",
  supportedLngs: ["ar", "en", "fr"],
  defaultNS: "common",
  interpolation: { escapeValue: false },
});

// Hook usage
import { useTranslation } from "react-i18next";
const { t, i18n } = useTranslation();
const isRTL = i18n.dir() === "rtl";
```

---

## Composant RTL-safe — exemples concrets

```tsx
// ✅ Card avec icône — direction-aware
export function PropertyCard({ property }: { property: Property }) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border">
      {/* L'icône apparaît à gauche en LTR, à droite en RTL */}
      <BuildingIcon className="mt-1 shrink-0" />
      <div className="flex-1 min-w-0">
        <h3 className="text-start font-semibold truncate">
          {property.title}
        </h3>
        <p className="text-start text-sm text-muted-foreground mt-1">
          {property.address}
        </p>
      </div>
      {/* Badge aligné à la fin */}
      <Badge className="ms-auto shrink-0">
        {formatAED(property.price)}
      </Badge>
    </div>
  );
}

// ✅ Navigation sidebar
export function SidebarItem({ icon: Icon, label, href }: SidebarItemProps) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 px-3 py-2 rounded-md hover:bg-accent"
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="text-sm font-medium">{label}</span>
    </Link>
    // gap-3 = espace logique entre icône et texte, fonctionne en RTL et LTR
  );
}

// ✅ Input avec prefixe
export function PriceInput() {
  return (
    <div className="relative">
      <span className="absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">
        AED
      </span>
      <Input className="ps-12" type="number" placeholder="0" />
    </div>
  );
}
```

---

## Affichage des montants (toujours chiffres latins)

```ts
// packages/shared-utils/format.ts
export function formatAED(amount: number): string {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    minimumFractionDigits: 0,
  }).format(amount);
  // → "AED 2,500,000" — chiffres latins même en locale arabe
}

// ❌ Ne jamais utiliser
new Intl.NumberFormat("ar-AE", { currency: "AED" }).format(amount);
// → "٢٬٥٠٠٬٠٠٠ د.إ" — chiffres arabes interdits dans SGI
```

---

## ESLint — règle no-physical-css

```js
// eslint.config.js
import noPhysicalCss from "./eslint-rules/no-physical-css.js";

export default [
  {
    plugins: { local: { rules: { "no-physical-css": noPhysicalCss } } },
    rules: {
      "local/no-physical-css": "error",
    },
  },
];

// eslint-rules/no-physical-css.js
export default {
  meta: { type: "problem" },
  create(context) {
    const PHYSICAL = /\b(ml|mr|pl|pr|text-left|text-right|border-l|border-r|left-\d|right-\d)-/;
    return {
      JSXAttribute(node) {
        if (node.name.name === "className") {
          const val = node.value?.value ?? "";
          if (PHYSICAL.test(val)) {
            context.report({ node, message: "Use logical CSS (ms-/me-/ps-/pe-) instead of physical (ml-/mr-/pl-/pr-)" });
          }
        }
      },
    };
  },
};
```

---

## Playwright — tests RTL

```ts
// tests/e2e/rtl.spec.ts
test("layout RTL correct en arabe", async ({ page }) => {
  await page.goto("/?locale=ar");
  const sidebar = page.locator("[data-testid='sidebar']");
  const box = await sidebar.boundingBox();
  // En RTL, la sidebar doit être à droite (x élevé)
  expect(box!.x).toBeGreaterThan(800);
  await page.screenshot({ path: "tests/screenshots/ar-dashboard.png", fullPage: true });
});

test("layout LTR correct en anglais", async ({ page }) => {
  await page.goto("/?locale=en");
  const sidebar = page.locator("[data-testid='sidebar']");
  const box = await sidebar.boundingBox();
  expect(box!.x).toBeLessThan(100);
});
```
