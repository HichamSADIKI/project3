import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { MessageForm } from "./MessageForm";

interface Message {
  id: string;
  subject: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
  outgoing: boolean;
}

export default async function FournisseurMessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("fournisseur", lc);
  const tc = makeT("common", lc);

  let messages: Message[] = [];
  let error: string | null = null;
  try {
    messages = await apiServer<Message[]>("/api/v1/fournisseur/messages");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const formLabels = {
    subject: t("messages.subject"),
    subjectPlaceholder: t("messages.subjectPlaceholder"),
    body: t("messages.body"),
    bodyPlaceholder: t("messages.bodyPlaceholder"),
    send: t("messages.send"),
    sending: t("messages.sending"),
    success: t("messages.success"),
    error: t("messages.error"),
  };

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "var(--h1-size)", color: "var(--ink)" }}>
        {t("messages.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "clamp(0.85rem, 1.8vw, 0.95rem)" }}>
        {t("messages.subtitle")}
      </p>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {tc("common.unavailable")} ({error}).
        </div>
      )}

      <div style={{ display: "grid", gap: "1.25rem" }}>
        {messages.length === 0 ? (
          <div className="sgi-card" style={{ color: "var(--ink-3)" }}>{t("messages.empty")}</div>
        ) : (
          <div style={{ display: "grid", gap: "0.6rem" }}>
            {messages.map((m) => (
              <div
                key={m.id}
                className="sgi-card"
                style={{
                  borderInlineStart: `3px solid ${m.outgoing ? "var(--gold)" : "var(--azure, #4a6b82)"}`,
                  marginInlineStart: m.outgoing ? "1.5rem" : 0,
                  marginInlineEnd: m.outgoing ? 0 : "1.5rem",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ink-3)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {m.outgoing ? t("messages.you") : t("messages.agency")}
                  </span>
                  <span style={{ fontSize: "0.72rem", color: "var(--ink-4)" }}>
                    {m.created_at ? new Date(m.created_at).toLocaleString(lc) : ""}
                  </span>
                </div>
                {m.subject && <div style={{ fontWeight: 600, color: "var(--ink)", marginBottom: 2 }}>{m.subject}</div>}
                <div style={{ color: "var(--ink-2)", fontSize: "0.9rem", whiteSpace: "pre-wrap" }}>{m.body}</div>
              </div>
            ))}
          </div>
        )}
        <MessageForm labels={formLabels} />
      </div>
    </>
  );
}
