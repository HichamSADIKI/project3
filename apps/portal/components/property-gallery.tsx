"use client";

import { useState } from "react";

/**
 * Galerie photo — Client Component (sélection vignette).
 * RTL-safe : disposition par flex/grid (pas de left/right physiques).
 */
export function PropertyGallery({
  photos,
  title,
}: {
  photos: string[];
  title: string;
}) {
  const valid = photos.filter((p) => typeof p === "string" && p);
  const [active, setActive] = useState(0);

  if (!valid.length) {
    return (
      <div
        className="sgi-card"
        style={{
          aspectRatio: "16 / 9",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--ink-4)",
          padding: 0,
        }}
      >
        —
      </div>
    );
  }

  const current = valid[Math.min(active, valid.length - 1)];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
      <div
        style={{
          aspectRatio: "16 / 9",
          borderRadius: "var(--z-rlg, var(--r-md))",
          overflow: "hidden",
          background: "var(--z-sand, var(--bg-inset))",
          boxShadow: "var(--z-shadow-md)",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current}
          alt={title}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      </div>
      {valid.length > 1 ? (
        <div
          style={{
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
            paddingBlockEnd: "0.25rem",
          }}
        >
          {valid.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActive(i)}
              aria-label={`${title} ${i + 1}`}
              style={{
                flex: "0 0 auto",
                width: 88,
                height: 64,
                padding: 0,
                borderRadius: "var(--r)",
                overflow: "hidden",
                cursor: "pointer",
                border:
                  i === active
                    ? "2px solid var(--z-gold-500, var(--gold))"
                    : "1px solid var(--z-line, var(--line))",
                background: "var(--z-sand, var(--bg-inset))",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={p}
                alt=""
                loading="lazy"
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
