"use client";

import { usePathname, useRouter } from "next/navigation";
import { LOCALES } from "@/lib/i18n";

export function LocaleSwitcher({ current }: { current: string }) {
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(target: string) {
    if (target === current) return;
    const next = pathname.replace(/^\/[a-z]{2}/, `/${target}`);
    router.push(next);
  }

  return (
    <div style={{ display: "flex", gap: 4 }}>
      {LOCALES.map((l) => (
        <button
          key={l}
          onClick={() => switchTo(l)}
          aria-current={l === current}
          style={{
            padding: "0.25rem 0.5rem",
            background: l === current ? "var(--gold-ghost)" : "transparent",
            color: l === current ? "var(--gold-deep)" : "var(--ink-3)",
            border: "1px solid",
            borderColor: l === current ? "var(--gold-line)" : "transparent",
            borderRadius: "var(--r-sm)",
            fontSize: "0.75rem",
            fontWeight: 600,
            textTransform: "uppercase",
            cursor: "pointer",
          }}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
