"use client";

/**
 * BesoinForm — formulaire d'expression de besoin client (texte + dictée).
 *
 * Architecture :
 *  - <textarea> RTL-safe avec compteur de caractères
 *  - Bouton micro Web Speech API (Chrome/Edge/Android) — vrai temps réel
 *  - Fallback MediaRecorder pour Safari/iOS — POST audio à `/transcribe`
 *  - Sélecteur de catégorie optionnel (override l'IA)
 *  - Aperçu de l'analyse IA avant validation
 *
 * Le JWT n'est jamais exposé : tous les appels passent par `/api/proxy/client/*`.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { apiClient, ApiError } from "@/lib/api";
import type { Locale } from "@/lib/i18n";
import { buildVoiceText, VoiceSession } from "@/lib/voice-transcript";

type Category =
  | "realestate" | "tourisme" | "sante" | "assurance"
  | "banques" | "amazon" | "consultants" | "admin" | "travail";

interface ParsedNeed {
  category: Category;
  categories: Category[];
  service_type: string | null;
  budget_aed: number | null;
  preferred_location: string | null;
  property_type: string | null;
  urgency: "high" | "medium" | "low";
  summary: string;
  confidence: number;
  engine: string;
}

interface DealRef {
  lead_id: string;
  crm_ref: string;
  category: Category;
}

interface NeedSubmitMultiOut {
  deals: DealRef[];
  categories: Category[];
  parsed: ParsedNeed;
}

interface Texts {
  title: string;
  subtitle: string;
  textareaLabel: string;
  textareaPlaceholder: string;
  micStart: string;
  micStop: string;
  micUnsupported: string;
  listening: string;
  transcribing: string;
  categoryLabel: string;
  categoryAuto: string;
  submit: string;
  submitting: string;
  success: string;
  errorEmpty: string;
  errorTooShort: string;
  errorGeneric: string;
  errorNotLinked: string;
  errorMicDenied: string;
  errorTooLargeAudio: string;
  errorWhisperUnavailable: string;
  errorEmptyTranscript: string;
  parsedTitle: string;
  parsedCategory: string;
  parsedBudget: string;
  parsedLocation: string;
  parsedUrgency: string;
  parsedConfidence: string;
  viewDeal: string;
  newOne: string;
  charsCount: string;
}

const CATEGORIES: { value: Category; en: string; fr: string; ar: string; color: string }[] = [
  { value: "realestate",  en: "Real Estate",   fr: "Immobilier",     ar: "العقارات",     color: "#C9A84C" },
  { value: "tourisme",    en: "Tourism",       fr: "Tourisme",       ar: "السياحة",      color: "#0EA5E9" },
  { value: "sante",       en: "Health",        fr: "Santé",          ar: "الصحة",        color: "#10B981" },
  { value: "assurance",   en: "Insurance",     fr: "Assurance",      ar: "التأمين",      color: "#8B5CF6" },
  { value: "banques",     en: "Banking",       fr: "Banques",        ar: "البنوك",       color: "#3B82F6" },
  { value: "amazon",      en: "Amazon",        fr: "Amazon",         ar: "أمازون",       color: "#F59E0B" },
  { value: "consultants", en: "Consultants",   fr: "Consultants",    ar: "المستشارون",   color: "#EC4899" },
  { value: "admin",       en: "Admin",         fr: "Administratif",  ar: "الإدارات",     color: "#6366F1" },
  { value: "travail",     en: "Employment",    fr: "Emploi",         ar: "التوظيف",      color: "#14B8A6" },
];

const SPEECH_LOCALE: Record<Locale, string> = {
  fr: "fr-FR",
  en: "en-US",
  ar: "ar-AE",
};

const MIN_CHARS = 15;
const MAX_CHARS = 4000;

/* eslint-disable @typescript-eslint/no-explicit-any */
type SR = any;

export function BesoinForm({ locale, texts }: { locale: Locale; texts: Texts }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const [categoryOverride, setCategoryOverride] = useState<Category | "">("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<NeedSubmitMultiOut | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Popup de confirmation : aperçu IA + catégories modifiables avant envoi définitif.
  const [preview, setPreview] = useState<ParsedNeed | null>(null);
  const [selectedCats, setSelectedCats] = useState<Category[]>([]);
  const [confirming, setConfirming] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceMode, setVoiceMode] = useState<"webspeech" | "recorder" | "none">("none");
  const [recorderAvailable, setRecorderAvailable] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recognitionRef = useRef<SR | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recorderChunksRef = useRef<Blob[]>([]);
  const recorderStreamRef = useRef<MediaStream | null>(null);
  const lastVoiceSourceRef = useRef<"portal_voice" | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Détection : préfère Web Speech (temps réel sur Chrome/Edge/Android) mais
  // garde toujours MediaRecorder comme fallback si Web Speech échoue
  // (erreurs network/audio-capture fréquentes sur Chrome).
  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasRecorder =
      typeof MediaRecorder !== "undefined" && !!navigator.mediaDevices?.getUserMedia;
    setRecorderAvailable(hasRecorder);
    const SR: SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (SR) {
      setVoiceMode("webspeech");
    } else if (hasRecorder) {
      setVoiceMode("recorder");
    } else {
      setVoiceMode("none");
    }
  }, []);

  function startListening() {
    if (typeof window === "undefined") return;
    const SR: SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new SR();
    recognition.lang = SPEECH_LOCALE[locale];
    recognition.continuous = true;
    recognition.interimResults = true;

    // Base figée = texte déjà saisi au moment où l'on lance la dictée.
    // La valeur du champ est TOUJOURS reconstruite depuis cette base (jamais
    // dérivée de l'état précédent), ce qui élimine la duplication en cascade.
    const session = new VoiceSession(text);
    recognition.onresult = (event: any) => {
      const results: { isFinal: boolean; transcript: string }[] = [];
      for (let i = 0; i < event.results.length; i++) {
        results.push({
          isFinal: event.results[i].isFinal,
          transcript: event.results[i][0].transcript,
        });
      }
      setText(session.onResult(event.resultIndex, results));
    };

    recognition.onerror = (event: any) => {
      const code: string = event.error ?? "";
      recognitionRef.current = null;
      setListening(false);
      // Erreurs Web Speech récupérables → bascule transparente sur MediaRecorder
      // (Whisper backend). 'network' est très fréquent sur Chrome car la
      // reconnaissance passe par les serveurs Google.
      const recoverable = new Set([
        "network",
        "audio-capture",
        "service-not-allowed",
        "language-not-supported",
      ]);
      if (recoverable.has(code) && recorderAvailable) {
        setVoiceMode("recorder");
        // Démarre immédiatement l'enregistrement sur le chemin fallback.
        void startRecording();
        return;
      }
      if (code === "no-speech" || code === "aborted") {
        // Silencieux : pas la peine d'effrayer l'utilisateur.
        return;
      }
      if (code === "not-allowed") {
        setError(texts.errorMicDenied);
        return;
      }
      setError(`${texts.errorGeneric} (${code || "speech"})`);
    };

    recognition.onend = () => {
      setListening(false);
      recognitionRef.current = null;
    };

    recognition.start();
    recognitionRef.current = recognition;
    lastVoiceSourceRef.current = "portal_voice";
    setListening(true);
    setError(null);
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  // ─ MediaRecorder fallback (Safari/iOS) ──────────────────────────────
  async function startRecording() {
    setError(null);
    // getUserMedia n'existe que dans un contexte sécurisé (HTTPS ou localhost).
    // Sur HTTP via une IP/domaine non-sécurisé, `mediaDevices` est `undefined`
    // → message dédié plutôt qu'un trompeur « micro refusé ».
    if (
      typeof navigator === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      (typeof window !== "undefined" && window.isSecureContext === false)
    ) {
      setError(texts.micUnsupported);
      setListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      recorderStreamRef.current = stream;

      // Choisit le meilleur MIME supporté (Safari préfère mp4, autres webm)
      const candidates = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4",
        "audio/ogg;codecs=opus",
      ];
      const mimeType =
        candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";

      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) recorderChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        // Coupe le micro proprement
        recorderStreamRef.current?.getTracks().forEach((t) => t.stop());
        recorderStreamRef.current = null;

        const blob = new Blob(recorderChunksRef.current, {
          type: mimeType || "audio/webm",
        });
        recorderChunksRef.current = [];

        if (blob.size === 0) return;
        if (blob.size > 5 * 1024 * 1024) {
          setError(texts.errorTooLargeAudio);
          return;
        }

        // POST multipart → /api/client/transcribe → backend Whisper
        setTranscribing(true);
        try {
          const form = new FormData();
          const ext = (mimeType.split("/")[1] ?? "webm").split(";")[0];
          form.append("audio", blob, `voice.${ext}`);
          form.append("locale", locale);

          const res = await fetch("/api/client/transcribe", {
            method: "POST",
            body: form,
          });
          if (!res.ok) {
            const detail = await res.text().catch(() => "");
            if (res.status === 503) {
              setError(texts.errorWhisperUnavailable);
            } else if (res.status === 413) {
              setError(texts.errorTooLargeAudio);
            } else {
              setError(`${texts.errorGeneric} (${detail || res.status})`);
            }
            return;
          }
          const data = (await res.json()) as { text: string };
          const transcript = (data.text || "").trim();
          if (!transcript) {
            setError(texts.errorEmptyTranscript);
            return;
          }
          setText((prev) => buildVoiceText(prev, transcript, ""));
          lastVoiceSourceRef.current = "portal_voice";
        } catch {
          setError(texts.errorGeneric);
        } finally {
          setTranscribing(false);
        }
      };

      recorder.start();
      recorderRef.current = recorder;
      setListening(true);
    } catch (err) {
      // Distingue le vrai refus de permission des autres pannes (pas de micro,
      // micro déjà utilisé, blocage par Permissions-Policy…).
      const name = err instanceof DOMException ? err.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setError(texts.errorMicDenied);
      } else if (name === "NotFoundError" || name === "NotReadableError") {
        setError(texts.micUnsupported);
      } else {
        setError(texts.errorMicDenied);
      }
      setListening(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
  }

  // Arrêt complet de la dictée — utilisé à l'envoi du besoin.
  // On vide les morceaux audio AVANT d'arrêter le recorder pour que son
  // `onstop` produise un blob vide et n'envoie PAS de transcription tardive.
  function cancelVoice() {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {
        /* no-op */
      }
      recognitionRef.current = null;
    }
    recorderChunksRef.current = [];
    if (recorderRef.current) {
      try {
        recorderRef.current.stop();
      } catch {
        /* no-op */
      }
      recorderRef.current = null;
    }
    recorderStreamRef.current?.getTracks().forEach((t) => t.stop());
    recorderStreamRef.current = null;
    setListening(false);
    setTranscribing(false);
  }

  function toggleMic() {
    if (voiceMode === "webspeech") {
      listening ? stopListening() : startListening();
    } else if (voiceMode === "recorder") {
      listening ? stopRecording() : startRecording();
    }
  }

  const charsLeft = MAX_CHARS - text.length;
  const canSubmit = text.trim().length >= MIN_CHARS && !submitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    // Coupe la dictée en cours dès l'envoi du besoin.
    cancelVoice();

    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(texts.errorTooShort);
      return;
    }

    setSubmitting(true);
    try {
      // Étape 1 : prévisualisation — détecte la catégorie SANS créer de deal.
      const parsed = await apiClient<ParsedNeed>(
        "/api/proxy/client/needs/preview",
        {
          method: "POST",
          json: {
            text: trimmed,
            locale,
            source: lastVoiceSourceRef.current ?? "portal_text",
            category_override: categoryOverride || undefined,
          },
        },
      );
      setPreview(parsed);
      setSelectedCats(
        parsed.categories?.length ? parsed.categories : [parsed.category],
      );
    } catch (err) {
      setError(mapSubmitError(err));
    } finally {
      setSubmitting(false);
    }
  }

  function toggleCat(cat: Category) {
    setSelectedCats((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }

  function mapSubmitError(err: unknown): string {
    if (err instanceof ApiError) {
      if (err.detail === "client_party_not_linked") return texts.errorNotLinked;
      return `${texts.errorGeneric} (${err.detail})`;
    }
    return texts.errorGeneric;
  }

  // Étape 2 : le client a validé (ou modifié) la catégorie dans la popup →
  // envoi définitif, qui crée le deal CRM avec la catégorie confirmée.
  async function confirmSubmit() {
    if (selectedCats.length === 0) return;
    setError(null);
    setConfirming(true);
    try {
      const data = await apiClient<NeedSubmitMultiOut>(
        "/api/proxy/client/needs/multi",
        {
          method: "POST",
          json: {
            text: text.trim(),
            locale,
            source: lastVoiceSourceRef.current ?? "portal_text",
            categories: selectedCats,
          },
        },
      );
      setResult(data);
      setPreview(null);
      // Réinitialise le champ après envoi réussi.
      setText("");
      setCategoryOverride("");
      lastVoiceSourceRef.current = null;
    } catch (err) {
      setError(mapSubmitError(err));
      setPreview(null);
    } finally {
      setConfirming(false);
    }
  }

  function resetForm() {
    cancelVoice();
    setText("");
    setCategoryOverride("");
    setResult(null);
    setError(null);
    textareaRef.current?.focus();
  }

  const catLabel = useMemo(() => {
    const map = new Map(CATEGORIES.map((c) => [c.value, c]));
    return (v: Category): string => {
      const c = map.get(v);
      if (!c) return v;
      return locale === "ar" ? c.ar : locale === "fr" ? c.fr : c.en;
    };
  }, [locale]);

  const catColor = (v: Category) =>
    CATEGORIES.find((c) => c.value === v)?.color ?? "var(--gold-deep)";

  // ─ Result view ──────────────────────────────────────────────────────
  if (result) {
    const urgencyLabel: Record<string, string> = {
      high: locale === "ar" ? "مرتفع" : locale === "fr" ? "Élevée" : "High",
      medium: locale === "ar" ? "متوسط" : locale === "fr" ? "Moyenne" : "Medium",
      low: locale === "ar" ? "منخفض" : locale === "fr" ? "Faible" : "Low",
    };
    return (
      <div
        className="sgi-card"
        style={{
          padding: "2rem",
          background: "var(--bg-paper)",
          border: "1px solid var(--line-soft)",
          borderRadius: "var(--r)",
          maxWidth: 720,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "var(--emerald, #10B981)",
              color: "#fff",
              display: "grid",
              placeItems: "center",
              fontSize: 20,
            }}
            aria-hidden
          >
            ✓
          </div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "var(--ink)" }}>
              {texts.success}
            </div>
            <div style={{ fontSize: "0.85rem", color: "var(--ink-4)" }}>
              {result.deals.length}{" "}
              {locale === "ar"
                ? "طلب تم إنشاؤه"
                : locale === "fr"
                ? `demande(s) créée(s)`
                : "request(s) created"}
            </div>
          </div>
        </div>

        {/* Liste des deals créés — un par catégorie validée */}
        <div style={{ display: "grid", gap: 8, margin: "1rem 0" }}>
          {result.deals.map((d) => (
            <div
              key={d.lead_id}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 10,
                background: "var(--bg-ivory, #FAF7F0)",
                borderRadius: "var(--r-sm)",
                padding: "10px 12px",
              }}
            >
              <span
                style={{
                  display: "inline-block",
                  padding: "3px 10px",
                  borderRadius: 999,
                  background: catColor(d.category),
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                }}
              >
                {catLabel(d.category)}
              </span>
              <span style={{ fontSize: 12, color: "var(--ink-4)", fontFamily: "monospace" }}>
                {d.crm_ref}
              </span>
            </div>
          ))}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "1rem 0" }}>
          <DetailBox label={texts.parsedUrgency}>
            {urgencyLabel[result.parsed.urgency] ?? result.parsed.urgency}
          </DetailBox>
          {result.parsed.budget_aed !== null && (
            <DetailBox label={texts.parsedBudget}>
              AED{" "}
              {new Intl.NumberFormat("en-AE").format(result.parsed.budget_aed)}
            </DetailBox>
          )}
          {result.parsed.preferred_location && (
            <DetailBox label={texts.parsedLocation}>
              {result.parsed.preferred_location}
            </DetailBox>
          )}
        </div>

        <p style={{ color: "var(--ink-3)", lineHeight: 1.55, fontSize: "0.95rem" }}>
          {result.parsed.summary}
        </p>

        <div style={{ fontSize: 12, color: "var(--ink-4)", margin: "0.75rem 0 1.25rem" }}>
          {texts.parsedConfidence} {Math.round(result.parsed.confidence * 100)}%
          {" · "}
          {result.parsed.engine}
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={resetForm}
            style={{
              flex: 1,
              height: 40,
              borderRadius: "var(--r)",
              border: "1px solid var(--line-soft)",
              background: "var(--bg-base, #fff)",
              color: "var(--ink-2)",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {texts.newOne}
          </button>
          <button
            type="button"
            onClick={() => router.push(`/${locale}/client`)}
            style={{
              flex: 2,
              height: 40,
              borderRadius: "var(--r)",
              border: "none",
              background: "var(--gold-deep, #C9A84C)",
              color: "#fff",
              cursor: "pointer",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {texts.viewDeal}
          </button>
        </div>
      </div>
    );
  }

  // Libellés popup de confirmation (inline i18n, comme urgencyLabel).
  const ml = {
    fr: {
      title: "Confirmez votre besoin",
      yourText: "Votre besoin",
      detected: "Catégories détectées par l'IA",
      change: "Cliquez pour ajouter ou retirer des catégories :",
      confirm: "Confirmer l'envoi",
      cancel: "Annuler",
      confidence: "Confiance",
      none: "Sélectionnez au moins une catégorie",
    },
    en: {
      title: "Confirm your need",
      yourText: "Your need",
      detected: "Categories detected by AI",
      change: "Click to add or remove categories:",
      confirm: "Confirm & send",
      cancel: "Cancel",
      confidence: "Confidence",
      none: "Select at least one category",
    },
    ar: {
      title: "أكّد طلبك",
      yourText: "طلبك",
      detected: "الفئات المكتشفة بالذكاء الاصطناعي",
      change: "انقر لإضافة أو إزالة الفئات:",
      confirm: "تأكيد والإرسال",
      cancel: "إلغاء",
      confidence: "الثقة",
      none: "اختر فئة واحدة على الأقل",
    },
  }[locale];

  // ─ Form view ────────────────────────────────────────────────────────
  return (
    <>
    <form
      onSubmit={handleSubmit}
      style={{
        maxWidth: 720,
        padding: "1.75rem",
        background: "var(--bg-paper)",
        border: "1px solid var(--line-soft)",
        borderRadius: "var(--r)",
      }}
    >
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="need-text"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-4)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 8,
          }}
        >
          {texts.textareaLabel}
        </label>

        <div style={{ position: "relative" }}>
          <textarea
            id="need-text"
            ref={textareaRef}
            value={text}
            onChange={(e) => setText(e.target.value.slice(0, MAX_CHARS))}
            placeholder={texts.textareaPlaceholder}
            rows={7}
            dir={locale === "ar" ? "rtl" : "ltr"}
            style={{
              width: "100%",
              padding: "12px 14px",
              paddingInlineEnd: 56,
              borderRadius: "var(--r)",
              border: `1px solid ${listening ? "var(--rose, #DC2626)" : "var(--line-soft)"}`,
              background: "var(--bg-ivory, #FAF7F0)",
              fontSize: 14,
              lineHeight: 1.55,
              color: "var(--ink)",
              resize: "vertical",
              minHeight: 140,
              outline: "none",
              boxSizing: "border-box",
              transition: "border .15s",
            }}
          />
          {/* Bouton micro — Web Speech (temps réel) OU MediaRecorder (Whisper) */}
          {voiceMode !== "none" && (
            <button
              type="button"
              onClick={toggleMic}
              disabled={transcribing}
              aria-label={listening ? texts.micStop : texts.micStart}
              title={
                voiceMode === "recorder"
                  ? `${listening ? texts.micStop : texts.micStart} (Whisper)`
                  : listening ? texts.micStop : texts.micStart
              }
              style={{
                position: "absolute",
                top: 10,
                insetInlineEnd: 10,
                width: 40,
                height: 40,
                borderRadius: "50%",
                border: "none",
                background: transcribing
                  ? "var(--ink-4, #9CA3AF)"
                  : listening
                  ? "var(--rose, #DC2626)"
                  : "var(--gold-deep, #C9A84C)",
                color: "#fff",
                cursor: transcribing ? "wait" : "pointer",
                display: "grid",
                placeItems: "center",
                animation: listening ? "pulse 1.4s ease-in-out infinite" : "none",
              }}
            >
              <MicIcon active={listening} />
            </button>
          )}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginTop: 6,
            fontSize: 11,
            color: "var(--ink-4)",
          }}
        >
          <span>
            {transcribing
              ? `⏳ ${texts.transcribing}`
              : listening
              ? `🔴 ${texts.listening}${voiceMode === "recorder" ? " (Whisper)" : ""}`
              : voiceMode === "none"
              ? texts.micUnsupported
              : ""}
          </span>
          <span style={{ color: charsLeft < 50 ? "var(--rose, #DC2626)" : "var(--ink-4)" }}>
            {text.length} / {MAX_CHARS} · {texts.charsCount}
          </span>
        </div>
      </div>

      {/* Catégorie override */}
      <div style={{ marginBottom: 14 }}>
        <label
          htmlFor="need-category"
          style={{
            display: "block",
            fontSize: 12,
            fontWeight: 700,
            color: "var(--ink-4)",
            textTransform: "uppercase",
            letterSpacing: "0.07em",
            marginBottom: 8,
          }}
        >
          {texts.categoryLabel}
        </label>
        <select
          id="need-category"
          value={categoryOverride}
          onChange={(e) => setCategoryOverride(e.target.value as Category | "")}
          style={{
            width: "100%",
            height: 38,
            padding: "0 12px",
            borderRadius: "var(--r)",
            border: "1px solid var(--line-soft)",
            background: "var(--bg-ivory, #FAF7F0)",
            fontSize: 13.5,
            color: "var(--ink)",
            cursor: "pointer",
            outline: "none",
          }}
        >
          <option value="">{texts.categoryAuto}</option>
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {catLabel(c.value)}
            </option>
          ))}
        </select>
      </div>

      {/* Erreur */}
      {error && (
        <div
          role="alert"
          style={{
            padding: "10px 12px",
            borderRadius: "var(--r-sm)",
            background: "var(--rose-soft, #FEE2E2)",
            color: "var(--rose, #DC2626)",
            fontSize: 13,
            marginBottom: 12,
          }}
        >
          {error}
        </div>
      )}

      {/* Bouton submit */}
      <button
        type="submit"
        disabled={!canSubmit}
        style={{
          width: "100%",
          height: 44,
          borderRadius: "var(--r)",
          border: "none",
          background: canSubmit ? "var(--gold-deep, #C9A84C)" : "var(--line-soft)",
          color: canSubmit ? "#fff" : "var(--ink-4)",
          cursor: canSubmit ? "pointer" : "not-allowed",
          fontSize: 14,
          fontWeight: 600,
          transition: "all .15s",
        }}
      >
        {submitting ? texts.submitting : texts.submit}
      </button>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(220,38,38,.45); }
          50% { transform: scale(1.07); box-shadow: 0 0 0 8px rgba(220,38,38,0); }
        }
      `}</style>
    </form>

    {/* Popup de confirmation : catégorie détectée + modification possible */}
    {preview && (
      <div
        role="dialog"
        aria-modal="true"
        dir={locale === "ar" ? "rtl" : "ltr"}
        onClick={() => !confirming && setPreview(null)}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 1000,
          background: "rgba(0,0,0,.55)",
          display: "grid",
          placeItems: "center",
          padding: 16,
        }}
      >
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            width: "100%",
            maxWidth: 460,
            background: "var(--bg-paper, #1f2937)",
            border: "1px solid var(--line-soft)",
            borderRadius: "var(--r)",
            padding: "1.5rem",
            boxShadow: "0 20px 50px rgba(0,0,0,.4)",
          }}
        >
          <h3 style={{ margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 700, color: "var(--ink)" }}>
            {ml.title}
          </h3>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--ink-4)" }}>
            {ml.detected} · {ml.confidence} {Math.round((preview.confidence ?? 0) * 100)}%
          </p>

          {/* Texte exprimé par le client */}
          <div
            style={{
              background: "var(--bg-ivory, #FAF7F0)",
              border: "1px solid var(--line-soft)",
              borderRadius: "var(--r-sm)",
              padding: "10px 12px",
              marginBottom: 16,
              maxHeight: 120,
              overflowY: "auto",
            }}
          >
            <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.07em" }}>
              {ml.yourText}
            </div>
            <div style={{ fontSize: 13.5, color: "var(--ink)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
              {text}
            </div>
          </div>

          {/* Catégories multi-sélection : cliquer pour ajouter/retirer */}
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--ink-4)", marginBottom: 10 }}>
            {ml.change}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
            {CATEGORIES.map((c) => {
              const on = selectedCats.includes(c.value);
              return (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => toggleCat(c.value)}
                  aria-pressed={on ? "true" : "false"}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 13px",
                    borderRadius: 999,
                    border: on ? "1px solid transparent" : "1px solid var(--line-soft)",
                    background: on ? c.color : "transparent",
                    color: on ? "#fff" : "var(--ink-3)",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all .12s",
                  }}
                >
                  {on ? "✓ " : ""}{catLabel(c.value)}
                </button>
              );
            })}
          </div>

          {selectedCats.length === 0 && (
            <div style={{ fontSize: 12, color: "var(--rose, #DC2626)", marginBottom: 14 }}>
              {ml.none}
            </div>
          )}

          <div style={{ display: "flex", gap: 10 }}>
            <button
              type="button"
              onClick={() => setPreview(null)}
              disabled={confirming}
              style={{
                flex: 1,
                height: 44,
                borderRadius: "var(--r)",
                border: "1px solid var(--line-soft)",
                background: "transparent",
                color: "var(--ink-2)",
                cursor: confirming ? "not-allowed" : "pointer",
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              {ml.cancel}
            </button>
            <button
              type="button"
              onClick={confirmSubmit}
              disabled={confirming}
              style={{
                flex: 2,
                height: 44,
                borderRadius: "var(--r)",
                border: "none",
                background: "var(--gold-deep, #C9A84C)",
                color: "#fff",
                cursor: confirming ? "wait" : "pointer",
                fontSize: 14,
                fontWeight: 700,
              }}
            >
              {confirming ? texts.submitting : ml.confirm}
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}

function DetailBox({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      style={{
        background: "var(--bg-ivory, #FAF7F0)",
        borderRadius: "var(--r-sm)",
        padding: "10px 12px",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--ink-4)", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{children}</div>
    </div>
  );
}

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      {active ? (
        <rect x="6" y="6" width="12" height="12" rx="2" fill="#fff" />
      ) : (
        <>
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" y1="19" x2="12" y2="23" />
          <line x1="8" y1="23" x2="16" y2="23" />
        </>
      )}
    </svg>
  );
}
