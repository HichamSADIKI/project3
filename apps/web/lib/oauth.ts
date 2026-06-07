// Config OAuth côté BFF (web). Le flux : bouton → /api/auth/oauth/{provider}/start
// → provider → /api/auth/oauth/{provider}/callback → POST backend /auth/social
// (échange du code + vérif id_token + match compte) → pose des cookies de session.
//
// Le client_id est lu côté serveur (process.env, pas NEXT_PUBLIC) car ces routes
// sont des Route Handlers serveur. Le client_secret reste exclusivement côté API.

export type OAuthProvider = "google" | "apple";

export const OAUTH_STATE_COOKIE = "sgi-oauth-state";

interface ProviderConfig {
  authorizeUrl: string;
  clientId: string | undefined;
  scope: string;
  /** Paramètres supplémentaires propres au provider. */
  extra: Record<string, string>;
  /** Apple renvoie le callback en POST (form_post) quand on demande name/email. */
  formPost: boolean;
}

export function providerConfig(provider: string): ProviderConfig | null {
  if (provider === "google") {
    return {
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      clientId: process.env.GOOGLE_OAUTH_CLIENT_ID,
      scope: "openid email profile",
      extra: { prompt: "select_account", access_type: "online" },
      formPost: false,
    };
  }
  if (provider === "apple") {
    return {
      authorizeUrl: "https://appleid.apple.com/auth/authorize",
      clientId: process.env.APPLE_OAUTH_CLIENT_ID,
      scope: "name email",
      extra: { response_mode: "form_post" },
      formPost: true,
    };
  }
  return null;
}

/** redirect_uri stable dérivé de l'origine de la requête (identique start ⇆ callback). */
export function callbackUri(origin: string, provider: string): string {
  return `${origin}/api/auth/oauth/${provider}/callback`;
}
