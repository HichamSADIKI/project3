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

type Category =
  | "realestate" | "tourisme" | "sante" | "assurance"
  | "banques" | "amazon" | "consultants" | "admin" | "travail";

interface ParsedNeed {
  category: Category;
  service_type: string | null;
  budget_aed: number | null;
  preferred_location: string | null;
  property_type: string | null;
  urgency: "high" | "medium" | "low";
  summary: string;
  confidence: number;
  engine: string;
}

interface NeedSubmitOut {
  lead_id: string;
  crm_ref: string;
  category: Category;
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
  const [result, setResult] = useState<NeedSubmitOut | null>(null);
  const [error, setError] = useState<string | null>(null);
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

    let finalText = "";
    recognition.onresult = (event: any) => {
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalText += transcript;
        } else {
          interim += transcript;
        }
      }
      setText((prev) => {
        const base = prev.endsWith(" ") || prev === "" ? prev : prev + " ";
        return base + finalText + interim;
      });
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
          setText((prev) => {
            const base = prev.endsWith(" ") || prev === "" ? prev : prev + " ";
            return base + transcript;
          });
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
    } catch {
      setError(texts.errorMicDenied);
      setListening(false);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    recorderRef.current = null;
    setListening(false);
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

    const trimmed = text.trim();
    if (trimmed.length < MIN_CHARS) {
      setError(texts.errorTooShort);
      return;
    }

    setSubmitting(true);
    try {
      const data = await apiClient<NeedSubmitOut>("/api/proxy/client/needs", {
        method: "POST",
        json: {
          text: trimmed,
          locale,
          source: lastVoiceSourceRef.current ?? "portal_text",
          category_override: categoryOverride || undefined,
        },
      });
      setResult(data);
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.detail === "client_party_not_linked") {
          setError(texts.errorNotLinked);
        } else {
          setError(`${texts.errorGeneric} (${err.detail})`);
        }
      } else {
        setError(texts.errorGeneric);
      }
    } finally {
      setSubmitting(false);
    }
  }

  function resetForm() {
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
              {result.crm_ref}
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, margin: "1rem 0" }}>
          <DetailBox label={texts.parsedCategory}>
            <span
              style={{
                display: "inline-block",
                padding: "3px 10px",
                borderRadius: 999,
                background: catColor(result.parsed.category),
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              {catLabel(result.parsed.category)}
            </span>
          </DetailBox>
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

  // ─ Form view ────────────────────────────────────────────────────────
  return (
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
