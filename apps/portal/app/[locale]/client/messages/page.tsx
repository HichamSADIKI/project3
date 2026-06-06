import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";

interface Message {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  subject: string | null;
  body: string;
  read_at: string | null;
  created_at: string;
}

export default async function MessagesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("client", lc);
  const tc = makeT("common", lc);

  let messages: Message[] = [];
  let error: string | null = null;
  try {
    messages = await apiServer<Message[]>("/api/v1/client/messages");
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";

  return (
    <>
      <h1 style={{ margin: "0 0 1.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("nav.messages")}
      </h1>

      {error && (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      )}

      {messages.length === 0 ? (
        <div className="sgi-card" style={{ textAlign: "center", color: "var(--ink-3)" }}>
          {t("messages.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {messages.map((m) => (
            <div key={m.id} className="sgi-card">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--ink)" }}>
                  {m.subject ?? tc("common.noSubject")}
                </strong>
                <span style={{ fontSize: "0.75rem", color: "var(--ink-3)" }}>
                  {new Date(m.created_at).toLocaleString(dateLocale)}
                </span>
              </div>
              <p style={{ margin: "0.5rem 0 0", color: "var(--ink-2)", lineHeight: 1.5 }}>{m.body}</p>
              {m.read_at === null && (
                <div style={{ marginTop: "0.5rem" }}>
                  <span className="sgi-badge sgi-badge-info">{t("messages.unread")}</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}
