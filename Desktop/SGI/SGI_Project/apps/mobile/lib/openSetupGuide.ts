/**
 * Ouvre le PDF de configuration social-login embarqué dans le bundle.
 * Le PDF est copié dans le cache via FileSystem puis présenté via le share sheet
 * natif (iOS) ou un viewer (Android).
 */
import { Asset } from "expo-asset";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

/** Le require est résolu par metro grâce à `assetExts` (cf. metro.config.js). */
const PDF_MODULE = require("../assets/docs/social-login-setup.pdf");

export async function openSetupGuide(): Promise<void> {
  const asset = Asset.fromModule(PDF_MODULE);
  await asset.downloadAsync();

  // En dev (Expo serve), `localUri` peut être une URL http : on télécharge dans le cache.
  let uri = asset.localUri ?? asset.uri;
  if (uri.startsWith("http")) {
    const dest = `${FileSystem.cacheDirectory}sgi-social-login-setup.pdf`;
    const dl = await FileSystem.downloadAsync(uri, dest);
    uri = dl.uri;
  }

  const canShare = await Sharing.isAvailableAsync();
  if (!canShare) {
    throw new Error("sharing_unavailable");
  }

  await Sharing.shareAsync(uri, {
    mimeType: "application/pdf",
    dialogTitle: "SGI — Guide social login",
    UTI: Platform.OS === "ios" ? "com.adobe.pdf" : undefined,
  });
}
