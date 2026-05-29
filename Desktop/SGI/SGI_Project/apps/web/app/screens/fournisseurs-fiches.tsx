"use client";
import React, { useCallback, useEffect, useState } from "react";
import { Topbar } from "@/components/sgi-ui";
import { useLang } from "@/components/language-provider";
import { useBreakpoint } from "@/lib/hooks";

/** Fiche fournisseur — projection de VendorOut (cf. backend module vendors,
 *  catégorie OpenAPI « fournisseurs »). */
interface VendorFiche {
  party_id: string;
  vendor_type: string;
  categories: string[];
  specialities: string[];
  trade_licence_number: string | null;
  trade_licence_expiry: string | null;
  rating_avg: number;
  rating_count: number;
  jobs_completed: number;
  emergency_24_7: boolean;
  is_active: boolean;
  verification_status: string;
}

interface VendorListResponse {
  data: VendorFiche[];
  meta: { total: number; page: number; limit: number };
}

type Lang = "ar" | "en" | "fr";

const L: Record<string, { ar: string; en: string; fr: string }> = {
  title: { ar: "بطاقات المورّدين", en: "Supplier records", fr: "Fiches fournisseurs" },
  subtitle: {
    ar: "قائمة المورّدين (مزوّدي الخدمات الخارجيين) المسجّلين في الشركة.",
    en: "List of suppliers (external service providers) registered for the company.",
    fr: "Liste des fournisseurs (prestataires externes) enregistrés pour la société.",
  },
  refresh: { ar: "تحديث", en: "Refresh", fr: "Rafraîchir" },
  loading: { ar: "جارٍ التحميل…", en: "Loading…", fr: "Chargement…" },
  empty: { ar: "لا توجد فيشة مورّد بعد.", en: "No supplier record yet.", fr: "Aucune fiche fournisseur pour le moment." },
  loadError: { ar: "تعذّر تحميل القائمة.", en: "Failed to load the list.", fr: "Impossible de charger la liste." },
  colType: { ar: "النوع", en: "Type", fr: "Type" },
  colCategories: { ar: "الفئات المُفعّلة", en: "Active categories", fr: "Catégories activées" },
  colSpecialities: { ar: "التخصصات", en: "Specialities", fr: "Spécialités" },
  editCategories: { ar: "تعديل الفئات", en: "Edit categories", fr: "Modifier les catégories" },
  save: { ar: "حفظ", en: "Save", fr: "Enregistrer" },
  saving: { ar: "جارٍ الحفظ…", en: "Saving…", fr: "Enregistrement…" },
  cancel: { ar: "إلغاء", en: "Cancel", fr: "Annuler" },
  minOne: {
    ar: "اختر فئة واحدة على الأقل.",
    en: "Select at least one category.",
    fr: "Sélectionnez au moins une catégorie.",
  },
  saveError: { ar: "تعذّر الحفظ.", en: "Save failed.", fr: "Échec de l'enregistrement." },
  colLicence: { ar: "الرخصة", en: "Licence", fr: "Licence" },
  colRating: { ar: "التقييم", en: "Rating", fr: "Note" },
  colJobs: { ar: "المهام", en: "Jobs", fr: "Missions" },
  colStatus: { ar: "الحالة", en: "Status", fr: "Statut" },
  active: { ar: "نشط", en: "Active", fr: "Actif" },
  inactive: { ar: "غير نشط", en: "Inactive", fr: "Inactif" },
  emergency: { ar: "طوارئ 24/7", en: "24/7", fr: "Urgence 24/7" },
  total: { ar: "الإجمالي", en: "Total", fr: "Total" },
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

const ALL_VENDOR_TYPES = Object.keys(VENDOR_TYPE_LABEL);

export function ScreenFournisseursFiches() {
  const { lang } = useLang();
  const lc = lang as Lang;
  const bp = useBreakpoint();
  const isMob = bp === "mobile";
  const tl = (k: keyof typeof L | string) => (L[k] ? L[k][lc] : k);

  const [items, setItems] = useState<VendorFiche[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Édition des catégories activées (par l'admin) sur une fiche.
  const [editId, setEditId] = useState<string | null>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  function startEdit(v: VendorFiche) {
    setEditError(null);
    setEditId(v.party_id);
    setDraft(v.categories?.length ? [...v.categories] : [v.vendor_type]);
  }

  function toggleDraft(cat: string) {
    setDraft((d) => (d.includes(cat) ? d.filter((c) => c !== cat) : [...d, cat]));
  }

  async function saveCategories(partyId: string) {
    if (draft.length < 1) {
      setEditError(tl("minOne"));
      return;
    }
    setSaving(true);
    setEditError(null);
    try {
      const res = await fetch(`/api/admin/fournisseurs/${partyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ categories: draft }),
      });
      if (!res.ok) throw new Error("save_failed");
      setItems((list) =>
        list.map((x) => (x.party_id === partyId ? { ...x, categories: [...draft] } : x)),
      );
      setEditId(null);
    } catch {
      setEditError(tl("saveError"));
    } finally {
      setSaving(false);
    }
  }

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/fournisseurs/fiches?limit=100", { cache: "no-store" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail ?? data.error ?? "load_failed");
      }
      const payload = (await res.json()) as VendorListResponse;
      setItems(payload.data ?? []);
      setTotal(payload.meta?.total ?? payload.data?.length ?? 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "load_failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchItems();
  }, [fetchItems]);

  const typeLabel = (vt: string): string => (VENDOR_TYPE_LABEL[vt] ? VENDOR_TYPE_LABEL[vt][lc] : vt);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, overflow: "hidden" }}>
      <Topbar title={tl("title")}>
        <button
          onClick={() => void fetchItems()}
          style={{
            fontSize: 12, fontWeight: 600, padding: "7px 14px", borderRadius: "var(--r)",
            border: "1px solid var(--line-soft)", background: "var(--bg-paper)",
            color: "var(--ink-2)", cursor: "pointer",
          }}
        >
          {tl("refresh")}
        </button>
      </Topbar>

      <div style={{ flex: 1, overflowY: "auto", padding: isMob ? "16px 12px" : "28px 32px", background: "var(--bg-cream)" }}>
        <div style={{ fontSize: 13, color: "var(--ink-4)", marginBottom: 18, lineHeight: 1.55 }}>
          {tl("subtitle")}
          {!loading && !error && (
            <span style={{ marginInlineStart: 8, color: "var(--ink-3)" }}>
              · {tl("total")}: <span className="tnum">{total}</span>
            </span>
          )}
        </div>

        {loading && <div style={{ fontSize: 13, color: "var(--ink-4)" }}>{tl("loading")}</div>}
        {error && <div style={{ fontSize: 13, color: "var(--rose)" }}>{tl("loadError")}</div>}

        {!loading && !error && items.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--ink-4)" }}>{tl("empty")}</div>
        )}

        {!loading && !error && items.length > 0 && (
          <div style={{ background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: "var(--r)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--bg-cream)" }}>
                  {[tl("colType"), tl("colCategories"), tl("colSpecialities"), tl("colLicence"), tl("colRating"), tl("colJobs"), tl("colStatus")].map(h => (
                    <th key={h} style={{ padding: "9px 18px", fontSize: 10.5, color: "var(--ink-4)", fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", textAlign: "start", borderBottom: "1px solid var(--line-soft)" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((v, i) => {
                  const cats = v.categories?.length ? v.categories : [v.vendor_type];
                  const editing = editId === v.party_id;
                  return (
                  <React.Fragment key={v.party_id}>
                  <tr style={{ borderBottom: editing || i < items.length - 1 ? "1px solid var(--line-soft)" : "none" }}>
                    <td style={{ padding: "12px 18px" }}>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--ink)" }}>{typeLabel(v.vendor_type)}</div>
                      <div className="tnum" style={{ fontSize: 10, color: "var(--ink-4)" }}>{v.party_id.slice(0, 8)}</div>
                    </td>
                    <td style={{ padding: "12px 18px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
                        {cats.map((c) => (
                          <span key={c} style={{ fontSize: 10.5, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: "var(--gold-ghost)", color: "var(--gold-deep)" }}>
                            {typeLabel(c)}
                          </span>
                        ))}
                        <button
                          type="button"
                          onClick={() => (editing ? setEditId(null) : startEdit(v))}
                          title={tl("editCategories")}
                          aria-label={tl("editCategories")}
                          style={{ marginInlineStart: 4, fontSize: 12, lineHeight: 1, padding: "2px 6px", borderRadius: 6, border: "1px solid var(--line-soft)", background: "var(--bg-paper)", color: "var(--ink-3)", cursor: "pointer" }}
                        >
                          ✎
                        </button>
                      </div>
                    </td>
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-2)" }}>
                      {v.specialities.length > 0 ? v.specialities.join(", ") : "—"}
                      {v.emergency_24_7 && (
                        <span style={{ marginInlineStart: 6, fontSize: 9.5, fontWeight: 600, padding: "1px 7px", borderRadius: 999, background: "rgba(200,160,60,0.15)", color: "var(--gold-deep)" }}>
                          {tl("emergency")}
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 18px", fontSize: 12, color: "var(--ink-2)" }} className="tnum">
                      {v.trade_licence_number ?? "—"}
                    </td>
                    <td style={{ padding: "12px 18px", fontSize: 13, color: "var(--ink)" }} className="tnum">
                      {Number(v.rating_avg).toFixed(1)} <span style={{ fontSize: 10.5, color: "var(--ink-4)" }}>({v.rating_count})</span>
                    </td>
                    <td style={{ padding: "12px 18px", fontSize: 13, color: "var(--ink-2)" }} className="tnum">{v.jobs_completed}</td>
                    <td style={{ padding: "12px 18px" }}>
                      <span style={{
                        fontSize: 10.5, fontWeight: 600, padding: "2px 9px", borderRadius: 999,
                        background: v.is_active ? "rgba(16,185,129,0.1)" : "var(--bg-cream)",
                        color: v.is_active ? "var(--emerald)" : "var(--ink-4)",
                      }}>
                        {v.is_active ? tl("active") : tl("inactive")}
                      </span>
                    </td>
                  </tr>
                  {editing && (
                    <tr style={{ borderBottom: i < items.length - 1 ? "1px solid var(--line-soft)" : "none", background: "var(--bg-cream)" }}>
                      <td colSpan={7} style={{ padding: "14px 18px" }}>
                        <div style={{ fontSize: 11, fontWeight: 600, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                          {tl("colCategories")}
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
                          {ALL_VENDOR_TYPES.map((cat) => {
                            const on = draft.includes(cat);
                            return (
                              <button
                                key={cat}
                                type="button"
                                onClick={() => toggleDraft(cat)}
                                aria-pressed={on ? "true" : "false"}
                                style={{
                                  fontSize: 12, fontWeight: 600, padding: "5px 12px", borderRadius: 999, cursor: "pointer",
                                  border: `1px solid ${on ? "var(--gold)" : "var(--line)"}`,
                                  background: on ? "var(--gold-ghost)" : "var(--bg-paper)",
                                  color: on ? "var(--gold-deep)" : "var(--ink-3)",
                                }}
                              >
                                {on ? "✓ " : ""}{typeLabel(cat)}
                              </button>
                            );
                          })}
                        </div>
                        {editError && (
                          <div style={{ fontSize: 12, color: "var(--rose)", marginBottom: 10 }}>{editError}</div>
                        )}
                        <div style={{ display: "flex", gap: 8 }}>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => void saveCategories(v.party_id)}
                            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: "var(--r)", border: "none", background: "var(--gold)", color: "#1A1610", cursor: saving ? "not-allowed" : "pointer", opacity: saving ? 0.6 : 1 }}
                          >
                            {saving ? tl("saving") : tl("save")}
                          </button>
                          <button
                            type="button"
                            disabled={saving}
                            onClick={() => setEditId(null)}
                            style={{ fontSize: 12.5, fontWeight: 600, padding: "7px 16px", borderRadius: "var(--r)", border: "1px solid var(--line)", background: "var(--bg-paper)", color: "var(--ink-2)", cursor: "pointer" }}
                          >
                            {tl("cancel")}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
