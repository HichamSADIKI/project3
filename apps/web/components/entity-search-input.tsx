"use client";

import React, { useEffect, useRef, useState } from "react";

import { getJson } from "@/lib/api-client";

// Autocomplete de sélection d'entité (client / party fournisseur) par nom.
// Recherche serveur via GET /api/admin/clients?q= (le party_id d'un fournisseur
// est un id client). Renvoie l'id sélectionné via onSelect. CSS logique (RTL).

type ClientHit = {
  id: string;
  type: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
};

function hitLabel(c: ClientHit): string {
  if (c.company_name) return c.company_name;
  const name = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return name || c.id.slice(0, 8);
}

export function EntitySearchInput({
  onSelect,
  placeholder,
}: {
  onSelect: (id: string, label: string) => void;
  placeholder: string;
}): React.ReactNode {
  const [text, setText] = useState("");
  const [hits, setHits] = useState<ClientHit[]>([]);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(false);
  const reqRef = useRef(0);

  useEffect(() => {
    if (picked || text.trim().length < 2) {
      setHits([]);
      return;
    }
    const reqId = (reqRef.current += 1);
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const body = await getJson<{ data?: ClientHit[] }>(
            `/api/admin/clients?q=${encodeURIComponent(text.trim())}&limit=8`,
          );
          if (reqId !== reqRef.current) return; // réponse obsolète
          setHits(body.data ?? []);
          setOpen(true);
        } catch {
          if (reqId === reqRef.current) setHits([]);
        }
      })();
    }, 250);
    return () => clearTimeout(timer);
  }, [text, picked]);

  function choose(c: ClientHit): void {
    const label = hitLabel(c);
    setText(label);
    setPicked(true);
    setOpen(false);
    onSelect(c.id, label);
  }

  return (
    <div style={{ position: "relative", flex: 1, minWidth: 240 }}>
      <input
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setPicked(false);
        }}
        onFocus={() => hits.length > 0 && setOpen(true)}
        placeholder={placeholder}
        style={{
          width: "100%",
          padding: "7px 10px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "var(--bg)",
          color: "var(--ink)",
          fontSize: 12.5,
          textAlign: "start",
        }}
      />
      {open && hits.length > 0 && (
        <div
          style={{
            position: "absolute",
            insetInlineStart: 0,
            insetInlineEnd: 0,
            insetBlockStart: "calc(100% + 4px)",
            zIndex: 20,
            background: "var(--bg)",
            border: "1px solid var(--line)",
            borderRadius: 8,
            boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
            overflow: "hidden",
          }}
        >
          {hits.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => choose(c)}
              style={{
                display: "block",
                width: "100%",
                textAlign: "start",
                padding: "8px 10px",
                border: "none",
                borderBlockEnd: "1px solid var(--line-soft)",
                background: "transparent",
                color: "var(--ink)",
                fontSize: 12.5,
                cursor: "pointer",
              }}
            >
              {hitLabel(c)}
              <span style={{ marginInlineStart: 8, fontSize: 10.5, color: "var(--ink-4)" }}>
                {c.type === "company" ? "🏢" : "👤"}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
