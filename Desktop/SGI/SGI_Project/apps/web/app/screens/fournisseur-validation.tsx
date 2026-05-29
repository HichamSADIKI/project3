"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

/** Fournisseur en attente, enrichi du profil prestataire (cf. backend
 *  PendingFournisseurItem). */
interface PendingFournisseur {
  user_id: string;
  party_id: string | null;
  email: string;
  full_name: string;
  status: string;
  created_at: string;
  vendor_type: string | null;
  verification_status: string | null;
  commercial_license_url: string | null;
  extracted: Record<string, unknown>;
}

type Lang = "ar" | "en" | "fr";

const L: Record<string, { ar: string; en: string; fr: string }> = {
  title: { ar: "اعتماد المورّدين", en: "Vendor approval", fr: "Validation fournisseurs" },
  subtitle: {
    ar: "راجع رخص المورّدين المسجّلين عبر البوابة واعتمد أو ارفض حساباتهم.",
    en: "Review portal-registered vendor licenses and approve or reject their accounts.",
    fr: "Examinez les licences des fournisseurs inscrits via le portail et validez ou rejetez leurs comptes.",
  },
  refresh: { ar: "تحديث", en: "Refresh", fr: "Rafraîchir" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…", fr: "Chargement…" },
  empty: {
    ar: "لا يوجد مورّد في انتظار الاعتماد.",
    en: "No vendor awaiting approval.",
    fr: "Aucun fournisseur en attente de validation.",
  },
  category: { ar: "الفئة", en: "Category", fr: "Catégorie" },
  submitted: { ar: "أُرسل في", en: "Submitted", fr: "Soumis le" },
  license: { ar: "الرخصة التجارية", en: "Commercial license", fr: "Licence commerciale" },
  viewLicense: { ar: "عرض المستند", en: "View document", fr: "Voir le document" },
  noLicense: { ar: "لا يوجد مستند", en: "No document", fr: "Aucun document" },
  extracted: { ar: "مستخرَج آلياً (OCR)", en: "Auto-extracted (OCR)", fr: "Extrait auto (OCR)" },
  licenceNumber: { ar: "رقم الرخصة", en: "Licence n°", fr: "N° licence" },
  expiry: { ar: "انتهاء الصلاحية", en: "Expiry", fr: "Expiration" },
  authority: { ar: "جهة الإصدار", en: "Authority", fr: "Autorité" },
  companyName: { ar: "اسم الشركة", en: "Company name", fr: "Raison sociale" },
  confidence: { ar: "الثقة", en: "Confidence", fr: "Confiance" },
  noExtraction: {
    ar: "لا توجد بيانات مستخرجة — تحقّق يدوياً من المستند.",
    en: "No extracted data — verify the document manually.",
    fr: "Aucune donnée extraite — vérifiez le document manuellement.",
  },
  approve: { ar: "اعتماد", en: "Approve", fr: "Approuver" },
  reject: { ar: "رفض", en: "Reject", fr: "Rejeter" },
  rejectReason: {
    ar: "سبب الرفض (اختياري):",
    en: "Rejection reason (optional):",
    fr: "Motif du rejet (optionnel) :",
  },
  loadError: {
    ar: "تعذّر تحميل القائمة.",
    en: "Failed to load the list.",
    fr: "Impossible de charger la liste.",
  },
};

const VENDOR_TYPE_LABEL: Record<string, { ar: string; en: string; fr: string }> = {
  maintenance: { ar: "صيانة", en: "Maintenance", fr: "Maintenance" },
  cleaning: { ar: "تنظيف", en: "Cleaning", fr: "Nettoyage" },
  security: { ar: "أمن", en: "Security", fr: "Sécurité" },
  landscaping: { ar: "تنسيق حدائق", en: "Landscaping", fr: "Espaces verts" },
  pest_control: { ar: "مكافحة آفات", en: "Pest control", fr: "Désinsectisation" },
  elevator: { ar: "مصاعد", en: "Elevator", fr: "Ascenseurs" },
  moving: { ar: "نقل أثاث", en: "Moving", fr: "Déménagement" },
  hvac: { ar: "تكييف", en: "HVAC (A/C)", fr: "Climatisation (CVC)" },
  electrical: { ar: "كهرباء", en: "Electrical", fr: "Électricité" },
  plumbing: { ar: "سباكة", en: "Plumbing", fr: "Plomberie" },
  other: { ar: "أخرى", en: "Other", fr: "Autre" },
};

export function ScreenFournisseurValidation() {
  const { lang } = useLang();
  const lc = lang as Lang;
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const tl = (k: keyof typeof L | string) => (L[k] ? L[k][lc] : k);

  const [items, setItems] = useState<PendingFournisseur[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<Record<string, boolean>>({});

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fournisseurs", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? "load_failed");
      }
      const data = (await res.json()) as PendingFournisseur[];
      setItems(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  async function decide(id: string, approve: boolean) {
    const reason = approve ? null : (window.prompt(tl("rejectReason")) ?? "");
    setBusy((b) => ({ ...b, [id]: true }));
    try {
      const res = await fetch(`/api/admin/fournisseurs/${id}/decision`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ approve, reason: reason || undefined }),
      });
      if (!res.ok) throw new Error("decision_failed");
      setItems((u) => u.filter((x) => x.user_id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "decision_failed");
    } finally {
      setBusy((b) => ({ ...b, [id]: false }));
    }
  }

  const categoryLabel = (vt: string | null): string => {
    if (!vt) return "—";
    return VENDOR_TYPE_LABEL[vt] ? VENDOR_TYPE_LABEL[vt][lc] : vt;
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={tl("title")} />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: isMob ? "16px 12px" : "28px 32px",
          background: "var(--bg-cream)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            marginBottom: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <p style={{ color: "var(--ink-3)", fontSize: "0.9rem", margin: 0, maxWidth: 620 }}>
            {tl("subtitle")}
          </p>
          <button
            type="button"
            onClick={fetchItems}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "var(--r)",
              border: "1px solid var(--line)",
              background: "var(--bg-paper)",
              color: "var(--ink-2)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            ↻ {tl("refresh")}
          </button>
        </div>

        {error && (
          <div
            style={{
              background: "var(--rose-soft)",
              color: "var(--rose)",
              padding: "0.75rem 1rem",
              borderRadius: "var(--r)",
              marginBottom: "1rem",
              fontSize: "0.85rem",
            }}
          >
            {tl("loadError")} ({error})
          </div>
        )}

        {loading ? (
          <div style={{ textAlign: "center", color: "var(--ink-3)", padding: "3rem" }}>
            {tl("loading")}
          </div>
        ) : items.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              color: "var(--ink-3)",
              padding: "3rem",
              background: "var(--bg-paper)",
              borderRadius: "var(--r-md)",
              border: "1px solid var(--line-soft)",
            }}
          >
            {tl("empty")}
          </div>
        ) : (
          <div style={{ display: "grid", gap: "1rem" }}>
            {items.map((f) => (
              <FournisseurCard
                key={f.user_id}
                f={f}
                lc={lc}
                tl={tl}
                categoryLabel={categoryLabel}
                busy={!!busy[f.user_id]}
                onApprove={() => decide(f.user_id, true)}
                onReject={() => decide(f.user_id, false)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div
        style={{
          fontSize: "0.7rem",
          color: "var(--ink-4)",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          marginBottom: 2,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: "0.85rem", color: "var(--ink)", fontWeight: 500 }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function FournisseurCard({
  f,
  lc,
  tl,
  categoryLabel,
  busy,
  onApprove,
  onReject,
}: {
  f: {
    user_id: string;
    email: string;
    full_name: string;
    created_at: string;
    vendor_type: string | null;
    commercial_license_url: string | null;
    extracted: Record<string, unknown>;
  };
  lc: "ar" | "en" | "fr";
  tl: (k: string) => string;
  categoryLabel: (vt: string | null) => string;
  busy: boolean;
  onApprove: () => void;
  onReject: () => void;
}) {
  const ex = f.extracted ?? {};
  const str = (k: string): string | null => {
    const v = ex[k];
    return typeof v === "string" && v.trim() ? v : null;
  };
  const confidence = typeof ex.confidence === "number" ? ex.confidence : null;
  const hasExtraction =
    str("trade_licence_number") ||
    str("trade_licence_expiry") ||
    str("trade_licence_authority") ||
    str("company_name");

  return (
    <div
      style={{
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--r-md)",
        padding: "1.25rem",
        display: "flex",
        flexDirection: "column",
        gap: "1rem",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontSize: "1.05rem", fontWeight: 600, color: "var(--ink)" }}>
            {f.full_name}
          </div>
          <div style={{ fontSize: "0.85rem", color: "var(--ink-3)" }}>{f.email}</div>
        </div>
        <span
          style={{
            alignSelf: "start",
            display: "inline-block",
            padding: "0.2rem 0.7rem",
            borderRadius: 999,
            background: "var(--gold-ghost)",
            color: "var(--gold-deep)",
            fontSize: "0.75rem",
            fontWeight: 700,
          }}
        >
          {categoryLabel(f.vendor_type)}
        </span>
      </div>

      {/* Meta + license */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "0.75rem",
          paddingBlock: "0.75rem",
          borderBlock: "1px solid var(--line-soft)",
        }}
      >
        <Field label={tl("category")} value={categoryLabel(f.vendor_type)} />
        <Field
          label={tl("submitted")}
          value={f.created_at ? new Date(f.created_at).toLocaleString(lc) : "—"}
        />
        <Field
          label={tl("license")}
          value={
            f.commercial_license_url ? (
              <a
                href={f.commercial_license_url}
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: "var(--gold-deep)", fontWeight: 600 }}
              >
                {tl("viewLicense")} ↗
              </a>
            ) : (
              <span style={{ color: "var(--ink-4)" }}>{tl("noLicense")}</span>
            )
          }
        />
      </div>

      {/* OCR extraction */}
      <div>
        <div
          style={{
            fontSize: "0.72rem",
            color: "var(--ink-4)",
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            marginBottom: "0.5rem",
            fontWeight: 600,
          }}
        >
          {tl("extracted")}
        </div>
        {hasExtraction ? (
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "0.75rem",
            }}
          >
            <Field label={tl("licenceNumber")} value={str("trade_licence_number") ?? "—"} />
            <Field label={tl("expiry")} value={str("trade_licence_expiry") ?? "—"} />
            <Field label={tl("authority")} value={str("trade_licence_authority") ?? "—"} />
            <Field label={tl("companyName")} value={str("company_name") ?? "—"} />
            <Field
              label={tl("confidence")}
              value={confidence !== null ? `${Math.round(confidence * 100)} %` : "—"}
            />
          </div>
        ) : (
          <p style={{ fontSize: "0.82rem", color: "var(--ink-4)", margin: 0 }}>
            {tl("noExtraction")}
          </p>
        )}
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end" }}>
        <button
          type="button"
          disabled={busy}
          onClick={onReject}
          style={{
            padding: "0.45rem 1rem",
            borderRadius: "var(--r)",
            background: "transparent",
            color: "var(--rose)",
            border: "1px solid var(--rose)",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          ✕ {tl("reject")}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          style={{
            padding: "0.45rem 1.1rem",
            borderRadius: "var(--r)",
            background: "var(--emerald)",
            color: "#fff",
            border: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: busy ? "not-allowed" : "pointer",
            opacity: busy ? 0.5 : 1,
          }}
        >
          ✓ {tl("approve")}
        </button>
      </div>
    </div>
  );
}
