"use client";

// Bouton « Scénario » + popup de génération d'une vidéo social media à partir de
// plusieurs photos + une voix (enregistrée OU générée depuis un avatar Homme/
// Femme) + un script. Câblé sur /api/admin/scenarios/**. CSS strictement logique
// (Loi 3, RTL-safe), chiffres latins. La génération vidéo/voix est un STUB MVP
// côté backend (vidéo placeholder) — l'UX est complète et réelle.

import React, { useRef, useState } from "react";

import type { Translations } from "@/lib/i18n";
import { postJson } from "@/lib/api-client";

export type Scenario = {
  id: string;
  listing_id: string;
  status: string;
  video_url: string | null;
  avatar: string | null;
  voice_mode: string;
  title: string | null;
};

type UploadedPhoto = { ref: string; url: string };

const AVATARS = [
  { key: "male", emoji: "👨", labelKey: "scenario_male" as const },
  { key: "female", emoji: "👩", labelKey: "scenario_female" as const },
];

function IcFilm() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="18" rx="2" /><path d="M7 3v18M17 3v18M2 9h5M2 15h5M17 9h5M17 15h5" />
    </svg>
  );
}

async function uploadFile(file: File, kind: "photo" | "audio"): Promise<UploadedPhoto> {
  const fd = new FormData();
  fd.append("kind", kind);
  fd.append("file", file);
  const res = await fetch("/api/admin/scenarios/upload", { method: "POST", body: fd });
  if (!res.ok) throw new Error("upload_failed");
  const json = (await res.json()) as { data: UploadedPhoto };
  return json.data;
}

export function ScenarioVideo({
  t,
  listingType,
  listingId,
  scenarios,
  onChanged,
}: {
  t: Translations;
  listingType: "sale" | "rent";
  listingId: string;
  scenarios: Scenario[];
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const readyCount = scenarios.filter((s) => s.status === "ready").length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title={t.scenario_title}
        style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          border: `1px solid ${readyCount > 0 ? "var(--gold)" : "var(--line-soft)"}`,
          borderRadius: 8, padding: "5px 10px", cursor: "pointer",
          fontSize: 11.5, fontWeight: 600,
          background: readyCount > 0 ? "rgba(212,160,55,0.12)" : "transparent",
          color: readyCount > 0 ? "var(--gold-deep)" : "var(--ink-4)",
        }}
      >
        <IcFilm /> {t.scenario_btn}
        {readyCount > 0 && (
          <span className="tnum" style={{ fontSize: 10.5, fontWeight: 700, background: "var(--gold)", color: "#1A1610", borderRadius: 999, padding: "0 6px", lineHeight: "16px" }}>{readyCount}</span>
        )}
      </button>
      {open && (
        <ScenarioModal
          t={t}
          listingType={listingType}
          listingId={listingId}
          scenarios={scenarios}
          onClose={() => setOpen(false)}
          onChanged={onChanged}
        />
      )}
    </>
  );
}

function ScenarioModal({
  t, listingType, listingId, scenarios, onClose, onChanged,
}: {
  t: Translations;
  listingType: "sale" | "rent";
  listingId: string;
  scenarios: Scenario[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [photos, setPhotos] = useState<UploadedPhoto[]>([]);
  const [voiceMode, setVoiceMode] = useState<"avatar" | "recorded">("avatar");
  const [avatar, setAvatar] = useState<string | null>("female");
  const [script, setScript] = useState("");
  const [title, setTitle] = useState("");
  const [audio, setAudio] = useState<{ ref: string; url: string } | null>(null);
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  async function onPickPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!files.length) return;
    setErr(null);
    setBusy(true);
    try {
      const uploaded: UploadedPhoto[] = [];
      for (const f of files.slice(0, 10 - photos.length)) {
        uploaded.push(await uploadFile(f, "photo"));
      }
      setPhotos((p) => [...p, ...uploaded].slice(0, 10));
    } catch {
      setErr(t.scenario_err_upload);
    } finally {
      setBusy(false);
    }
  }

  async function startRecording() {
    setErr(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (ev) => ev.data.size && chunksRef.current.push(ev.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((tr) => tr.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        try {
          const up = await uploadFile(new File([blob], "voice.webm", { type: "audio/webm" }), "audio");
          setAudio(up);
        } catch {
          setErr(t.scenario_err_upload);
        }
      };
      rec.start();
      recorderRef.current = rec;
      setRecording(true);
    } catch {
      setErr(t.scenario_err_mic);
    }
  }

  function stopRecording() {
    recorderRef.current?.stop();
    setRecording(false);
  }

  const canGenerate =
    photos.length > 0 &&
    !busy &&
    (voiceMode === "avatar" ? !!avatar : !!audio);

  async function generate() {
    if (!canGenerate) return;
    setBusy(true);
    setErr(null);
    try {
      const body: Record<string, unknown> = {
        listing_type: listingType,
        listing_id: listingId,
        voice_mode: voiceMode,
        photo_refs: photos.map((p) => p.ref),
      };
      if (title.trim()) body.title = title.trim();
      if (voiceMode === "avatar") {
        body.avatar = avatar;
        if (script.trim()) body.script = script.trim();
      } else {
        body.audio_ref = audio?.ref;
      }
      const res = await postJson("/api/admin/scenarios", body);
      if (!res.ok) {
        setErr(t.scenario_err_generate);
      } else {
        setPhotos([]); setAudio(null); setScript(""); setTitle("");
        onChanged();
      }
    } catch {
      setErr(t.scenario_err_generate);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id: string) {
    await fetch(`/api/admin/scenarios/${id}`, { method: "DELETE" });
    onChanged();
  }

  const card: React.CSSProperties = { background: "var(--bg-cream)", border: "1px solid var(--line-soft)", borderRadius: 12, padding: 14 };
  const seg = (on: boolean): React.CSSProperties => ({
    border: "none", borderRadius: 999, padding: "6px 14px", cursor: "pointer", fontSize: 12.5, fontWeight: 600,
    background: on ? "var(--gold)" : "transparent", color: on ? "#1A1610" : "var(--ink-4)",
  });

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(10,8,4,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: "min(560px, 96vw)", maxHeight: "90vh", overflowY: "auto", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 16, padding: 22, boxShadow: "0 24px 60px rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, color: "var(--gold-deep)", fontSize: 15, fontWeight: 700 }}><IcFilm /> {t.scenario_title}</div>
          <button onClick={onClose} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ fontSize: 12.5, color: "var(--ink-4)", marginBottom: 16 }}>{t.scenario_subtitle}</div>

        {err && <div style={{ padding: "8px 12px", marginBottom: 12, borderRadius: 8, background: "var(--rose-soft)", color: "var(--rose)", fontSize: 12.5 }}>{err}</div>}

        {/* Photos */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 10 }}>1. {t.scenario_photos} <span style={{ color: "var(--ink-4)", fontWeight: 400 }} className="tnum">({photos.length}/10)</span></div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {photos.map((p, i) => (
              <div key={p.ref} style={{ position: "relative", width: 72, height: 72, borderRadius: 10, overflow: "hidden", border: "1px solid var(--line-soft)" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.url} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <button onClick={() => setPhotos((arr) => arr.filter((_, j) => j !== i))} style={{ position: "absolute", insetBlockStart: 2, insetInlineEnd: 2, border: "none", borderRadius: 999, width: 18, height: 18, background: "rgba(0,0,0,0.6)", color: "#fff", cursor: "pointer", fontSize: 12, lineHeight: 1 }}>×</button>
              </div>
            ))}
            {photos.length < 10 && (
              <label style={{ width: 72, height: 72, borderRadius: 10, border: "1px dashed var(--line)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "var(--ink-4)", fontSize: 24 }}>
                +
                <input type="file" accept="image/*" multiple onChange={onPickPhotos} style={{ display: "none" }} />
              </label>
            )}
          </div>
        </div>

        {/* Voix */}
        <div style={{ ...card, marginBottom: 12 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 10 }}>2. {t.scenario_voice}</div>
          <div style={{ display: "inline-flex", background: "var(--bg-paper)", border: "1px solid var(--line-soft)", borderRadius: 999, padding: 3, marginBottom: 12 }}>
            <button onClick={() => setVoiceMode("avatar")} style={seg(voiceMode === "avatar")}>{t.scenario_voice_avatar}</button>
            <button onClick={() => setVoiceMode("recorded")} style={seg(voiceMode === "recorded")}>{t.scenario_voice_record}</button>
          </div>

          {voiceMode === "avatar" ? (
            <>
              <div style={{ display: "flex", gap: 10, marginBottom: 12 }}>
                {AVATARS.map((a) => {
                  const on = avatar === a.key;
                  return (
                    <button key={a.key} onClick={() => setAvatar(a.key)} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, padding: "12px 8px", borderRadius: 12, cursor: "pointer", border: `2px solid ${on ? "var(--gold)" : "var(--line-soft)"}`, background: on ? "rgba(212,160,55,0.10)" : "var(--bg-paper)" }}>
                      <span style={{ fontSize: 34, lineHeight: 1 }}>{a.emoji}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--ink)" }}>{t[a.labelKey]}</span>
                      <span style={{ fontSize: 11, color: on ? "var(--gold-deep)" : "var(--ink-4)" }}>{a.key === "male" ? t.scenario_voice_m : t.scenario_voice_f}</span>
                    </button>
                  );
                })}
              </div>
              <textarea value={script} onChange={(e) => setScript(e.target.value)} placeholder={t.scenario_script_ph} rows={3} style={{ width: "100%", resize: "vertical", border: "1px solid var(--line-soft)", borderRadius: 8, padding: "9px 11px", fontSize: 13, background: "var(--bg-paper)", color: "var(--ink)" }} />
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              {!recording ? (
                <button onClick={startRecording} style={{ border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--rose)", color: "#fff" }}>● {t.scenario_record_start}</button>
              ) : (
                <button onClick={stopRecording} style={{ border: "none", borderRadius: 8, padding: "9px 16px", cursor: "pointer", fontSize: 13, fontWeight: 600, background: "var(--ink-2)", color: "#fff" }}>■ {t.scenario_record_stop}</button>
              )}
              {recording && <span style={{ fontSize: 12.5, color: "var(--rose)", fontWeight: 600 }}>{t.scenario_recording}…</span>}
              {audio && !recording && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: "var(--emerald)", fontWeight: 600 }}>✓ {t.scenario_recorded}</span>
                  <audio src={audio.url} controls style={{ height: 30 }} />
                </span>
              )}
            </div>
          )}
        </div>

        {/* Titre + générer */}
        <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t.scenario_title_ph} style={{ width: "100%", border: "1px solid var(--line-soft)", borderRadius: 8, padding: "9px 11px", fontSize: 13, marginBottom: 12, background: "var(--bg-paper)", color: "var(--ink)" }} />
        <button onClick={generate} disabled={!canGenerate} style={{ width: "100%", border: "none", borderRadius: 10, padding: "12px", cursor: canGenerate ? "pointer" : "not-allowed", fontSize: 14, fontWeight: 700, background: canGenerate ? "var(--gold)" : "var(--line-soft)", color: canGenerate ? "#1A1610" : "var(--ink-4)" }}>
          {busy ? `${t.scenario_generating}…` : `🎬 ${t.scenario_generate}`}
        </button>

        {/* Vidéos déjà générées */}
        {scenarios.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line-soft)", paddingTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink-2)", marginBottom: 10 }}>{t.scenario_generated}</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {scenarios.map((s) => (
                <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 10, background: "var(--bg-cream)", border: "1px solid var(--line-soft)" }}>
                  <span style={{ fontSize: 18 }}>{s.avatar === "male" ? "👨" : s.avatar === "female" ? "👩" : "🎙️"}</span>
                  <span style={{ flex: 1, fontSize: 13, color: "var(--ink-2)" }}>{s.title || t.scenario_untitled}</span>
                  <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 999, background: s.status === "ready" ? "rgba(16,185,129,0.12)" : "var(--line-soft)", color: s.status === "ready" ? "var(--emerald)" : "var(--ink-4)" }}>{s.status === "ready" ? t.scenario_ready : s.status}</span>
                  {s.status === "ready" && s.video_url && (
                    <a href={s.video_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12.5, fontWeight: 600, color: "var(--gold-deep)", textDecoration: "none" }}>▶ {t.scenario_watch}</a>
                  )}
                  <button onClick={() => remove(s.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ink-4)", fontSize: 16 }}>×</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
