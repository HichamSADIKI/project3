/**
 * Helpers d'authentification sociale SGI Mobile.
 *
 * Google  : OAuth 2.0 + PKCE via expo-auth-session/providers/google → id_token
 * Apple   : flux natif iOS via expo-apple-authentication → identityToken (JWT)
 *
 * Les autres providers (Facebook, Microsoft, Instagram, Snapchat, WhatsApp,
 * Telegram) tombent sur le stub backend tant qu'aucun SDK natif n'est branché.
 *
 * Credentials à provisionner :
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID
 *   EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  (requis pour le mode Expo Go / proxy)
 */
import { useEffect } from "react";
import { Platform } from "react-native";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import * as AppleAuthentication from "expo-apple-authentication";

// Termine la session WebBrowser quand l'utilisateur revient à l'app (Google flow).
WebBrowser.maybeCompleteAuthSession();

const GOOGLE_IOS_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID;
const GOOGLE_ANDROID_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID;
const GOOGLE_WEB_CLIENT_ID     = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export const googleConfigured =
  !!(GOOGLE_IOS_CLIENT_ID || GOOGLE_ANDROID_CLIENT_ID || GOOGLE_WEB_CLIENT_ID);

export interface GoogleAuthResult {
  idToken: string;
  accessToken?: string;
}

/**
 * Hook Google — expose un déclencheur impératif `prompt()` et un callback
 * invoqué dès que Google renvoie un `id_token`.
 *
 * Usage:
 *   const google = useGoogleAuth({ onSuccess: ({ idToken }) => authStore.socialLogin({ provider: 'google', id_token: idToken }) });
 *   <Button onPress={google.prompt} disabled={!google.ready} />
 */
export function useGoogleAuth(opts: {
  onSuccess: (r: GoogleAuthResult) => void;
  onError?: (err: unknown) => void;
}) {
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    iosClientId:     GOOGLE_IOS_CLIENT_ID,
    androidClientId: GOOGLE_ANDROID_CLIENT_ID,
    webClientId:     GOOGLE_WEB_CLIENT_ID,
    scopes: ["openid", "profile", "email"],
  });

  useEffect(() => {
    if (!response) return;
    if (response.type === "success") {
      const idToken = response.params?.id_token ?? response.authentication?.idToken;
      const accessToken = response.authentication?.accessToken;
      if (idToken) {
        opts.onSuccess({ idToken, accessToken });
      } else {
        opts.onError?.(new Error("missing_id_token"));
      }
    } else if (response.type === "error") {
      opts.onError?.(response.error ?? new Error("google_auth_error"));
    }
  }, [response]);

  return {
    ready: !!request && googleConfigured,
    configured: googleConfigured,
    prompt: () => promptAsync(),
  };
}

export interface AppleAuthResult {
  identityToken: string;
  authorizationCode?: string;
  email?: string | null;
  fullName?: {
    givenName?: string | null;
    familyName?: string | null;
  };
}

/** Vrai si Sign in with Apple est dispo (iOS ≥ 13). */
export async function isAppleAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Lance le flux natif Sign in with Apple.
 * Lève si l'utilisateur annule (code `ERR_REQUEST_CANCELED`) ou en cas d'échec.
 */
export async function signInWithApple(): Promise<AppleAuthResult> {
  const cred = await AppleAuthentication.signInAsync({
    requestedScopes: [
      AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
      AppleAuthentication.AppleAuthenticationScope.EMAIL,
    ],
  });
  if (!cred.identityToken) {
    throw new Error("apple_missing_identity_token");
  }
  return {
    identityToken: cred.identityToken,
    authorizationCode: cred.authorizationCode ?? undefined,
    email: cred.email,
    fullName: cred.fullName
      ? {
          givenName: cred.fullName.givenName,
          familyName: cred.fullName.familyName,
        }
      : undefined,
  };
}
