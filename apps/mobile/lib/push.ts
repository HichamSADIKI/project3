/**
 * Notifications push natives (Expo) — prolonge le centre de notifications WS
 * côté serveur (#227). Demande la permission, récupère le jeton push Expo et
 * l'enregistre via /notifications/devices (jeton Bearer injecté par lib/api).
 *
 * Best-effort : tout échec (simulateur, permission refusée, réseau) est avalé —
 * l'absence de push ne doit jamais bloquer l'application.
 */
import Constants from "expo-constants";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { notificationsApi } from "./api";

// Affiche les notifications reçues au premier plan (bandeau + son + badge).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Plateforme normalisée acceptée par le backend (`^(ios|android|web)$`). */
export function devicePlatform(): "ios" | "android" | "web" {
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  return "web";
}

/** projectId EAS (depuis app.json) requis par `getExpoPushTokenAsync`. */
function easProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

let _registered = false;

/**
 * Demande la permission, récupère le jeton push Expo et l'enregistre côté
 * backend. Idempotent par session ; renvoie le jeton ou `null` si indisponible.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  if (_registered) return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    let granted = current.granted;
    if (!granted) {
      const asked = await Notifications.requestPermissionsAsync();
      granted = asked.granted;
    }
    if (!granted) return null;

    const projectId = easProjectId();
    const resp = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    const token = resp.data;
    if (!token) return null;

    await notificationsApi.registerDevice(token, devicePlatform());
    _registered = true;
    return token;
  } catch {
    return null; // best-effort : pas de push ≠ blocage
  }
}
