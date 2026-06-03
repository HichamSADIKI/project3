import { apiServer } from "@/lib/api-server";
import { makeT, isValidLocale, type Locale } from "@/lib/i18n";
import { ChatView, type TenantConversation } from "./ChatView";

interface ChatResponse {
  items: TenantConversation[];
  total: number;
}

export default async function TenantChatPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const lc: Locale = isValidLocale(locale) ? locale : "fr";
  const t = makeT("tenant", lc);

  let items: TenantConversation[] = [];
  let error: string | null = null;
  try {
    const data = await apiServer<ChatResponse>("/api/v1/tenant/chat?limit=100");
    items = data.items;
  } catch (e) {
    error = e instanceof Error ? e.message : "unavailable";
  }

  const dateLocale = lc === "ar" ? "ar-AE" : lc === "en" ? "en-AE" : "fr-FR";

  return (
    <>
      <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.75rem", color: "var(--ink)" }}>
        {t("chat.title")}
      </h1>
      <p style={{ margin: "0 0 1.5rem", color: "var(--ink-3)", fontSize: "0.9rem" }}>
        {t("chat.subtitle")}
      </p>

      {error ? (
        <div className="sgi-card" style={{ background: "var(--rose-soft)", color: "var(--rose)" }}>
          {error}
        </div>
      ) : (
        <ChatView
          conversations={items}
          dateLocale={dateLocale}
          labels={{
            empty: t("chat.empty"),
            selectPrompt: t("chat.selectPrompt"),
            placeholder: t("chat.placeholder"),
            send: t("chat.send"),
            sending: t("chat.sending"),
            noSubject: t("chat.noSubject"),
          }}
        />
      )}
    </>
  );
}
