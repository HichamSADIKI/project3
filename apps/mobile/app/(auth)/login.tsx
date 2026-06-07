/**
 * Écran de connexion SGI Mobile.
 * Supporte AR/EN/FR avec RTL automatique.
 * Permet de choisir pays + modules à charger avant la session.
 */
import { useEffect, useRef, useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, ScrollView, Animated, LayoutAnimation, UIManager,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import {
  usePreferencesStore, COUNTRIES, ALL_MODULES, SYSTEM_MODULES,
  type ModuleKey, type CountryCode,
} from "@/stores/preferences";
import { setLanguage } from "@/lib/i18n";
import type { SocialProvider } from "@/lib/api";
import {
  useGoogleAuth, signInWithApple, isAppleAvailable, googleConfigured,
} from "@/lib/socialAuth";
import { openSetupGuide } from "@/lib/openSetupGuide";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LANGS = [
  { code: "en" as const, label: "EN" },
  { code: "fr" as const, label: "FR" },
  { code: "ar" as const, label: "ع" },
];

const MODULE_ICONS: Record<ModuleKey, string> = {
  dashboard: "⊞",
  properties: "🏢",
  crm: "📊",
  clients: "👥",
  agenda: "🗓",
  profile: "👤",
};

type SocialItem = {
  id: SocialProvider;
  glyph: string;
  bg: string;
  fg: string;
  border?: string;
  labelKey: string;
};

/** Ordre d'affichage : majeurs (Google/Apple/Facebook/Microsoft) d'abord, puis messageries/réseaux. */
const SOCIALS: SocialItem[] = [
  { id: "google",    glyph: "G",  bg: "#FFFFFF", fg: "#1F1F1F", border: "#E2E8F0", labelKey: "social_google" },
  { id: "apple",     glyph: "",  bg: "#000000", fg: "#FFFFFF", labelKey: "social_apple" },
  { id: "facebook",  glyph: "f",  bg: "#1877F2", fg: "#FFFFFF", labelKey: "social_facebook" },
  { id: "microsoft", glyph: "▦", bg: "#2F2F2F", fg: "#FFFFFF", labelKey: "social_microsoft" },
  { id: "instagram", glyph: "◉", bg: "#E1306C", fg: "#FFFFFF", labelKey: "social_instagram" },
  { id: "snapchat",  glyph: "👻", bg: "#FFFC00", fg: "#000000", labelKey: "social_snapchat" },
  { id: "whatsapp",  glyph: "✆", bg: "#25D366", fg: "#FFFFFF", labelKey: "social_whatsapp" },
  { id: "telegram",  glyph: "✈", bg: "#229ED9", fg: "#FFFFFF", labelKey: "social_telegram" },
];

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, socialLogin, isLoading, error, clearError } = useAuthStore();
  const {
    country, modules, hydrated, hydrate, setCountry, toggleModule, reset,
  } = usePreferencesStore();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [resetToast, setResetToast] = useState(false);
  const [pendingProvider, setPendingProvider] = useState<SocialProvider | null>(null);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const toastOpacity = useRef(new Animated.Value(0)).current;

  // Google hook : déclenche socialLogin dès qu'un id_token revient
  const google = useGoogleAuth({
    onSuccess: async ({ idToken }) => {
      try {
        await socialLogin({ provider: "google", id_token: idToken });
      } finally {
        setPendingProvider(null);
      }
    },
    onError: () => setPendingProvider(null),
  });

  useEffect(() => {
    if (!hydrated) hydrate();
  }, [hydrated, hydrate]);

  useEffect(() => {
    isAppleAvailable().then(setAppleAvailable);
  }, []);

  const handleLogin = async () => {
    clearError();
    await login(email.trim(), password);
  };

  const handleSocial = async (provider: SocialProvider) => {
    clearError();
    setPendingProvider(provider);

    // Google : OAuth natif → id_token réel
    if (provider === "google") {
      if (!google.configured) {
        setPendingProvider(null);
        return;
      }
      try {
        await google.prompt();
      } catch {
        setPendingProvider(null);
      }
      return; // suite traitée par le useEffect dans useGoogleAuth
    }

    // Apple : flux natif iOS → identityToken réel
    if (provider === "apple") {
      try {
        const r = await signInWithApple();
        await socialLogin({ provider: "apple", id_token: r.identityToken });
      } catch {
        // utilisateur a annulé ou erreur — silencieux côté UX
      } finally {
        setPendingProvider(null);
      }
      return;
    }

    // Autres providers : envoi direct du provider, backend gérera (501 pour l'instant)
    try {
      await socialLogin({ provider });
    } finally {
      setPendingProvider(null);
    }
  };

  const handleLang = async (code: "ar" | "en" | "fr") => {
    await setLanguage(code);
  };

  const handleReset = async () => {
    setEmail("");
    setPassword("");
    clearError();
    await reset();
    setResetToast(true);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1400),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(() => setResetToast(false));
  };

  const toggleAdvanced = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAdvancedOpen((v) => !v);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={s.scroll}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Lang switcher */}
        <View style={s.langRow}>
          {LANGS.map((l) => (
            <TouchableOpacity
              key={l.code}
              style={[s.langBtn, i18n.language === l.code && s.langBtnActive]}
              onPress={() => handleLang(l.code)}
            >
              <Text style={[s.langTxt, i18n.language === l.code && s.langTxtActive]}>
                {l.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Logo + Title */}
        <View style={s.header}>
          <View style={s.logoBox}>
            <Text style={s.logoText}>∞</Text>
          </View>
          <Text style={s.title}>SGI</Text>
          <Text style={s.subtitle}>Infinity International UAE</Text>
        </View>

        {/* Form */}
        <View style={s.form}>
          <TextInput
            style={s.input}
            placeholder={t("login_email")}
            placeholderTextColor="#64748B"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
          />
          <TextInput
            style={s.input}
            placeholder={t("login_password")}
            placeholderTextColor="#64748B"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="password"
          />

          {/* Advanced options toggle */}
          <TouchableOpacity style={s.advancedToggle} onPress={toggleAdvanced} activeOpacity={0.7}>
            <Text style={s.advancedTxt}>{t("login_advanced")}</Text>
            <Text style={s.advancedChevron}>{advancedOpen ? "▲" : "▼"}</Text>
          </TouchableOpacity>

          {advancedOpen && (
            <View style={s.advancedPanel}>
              {/* Country */}
              <Text style={s.sectionLabel}>{t("login_country")}</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={s.countryRow}
              >
                {COUNTRIES.map((c) => {
                  const active = country === c.code;
                  return (
                    <TouchableOpacity
                      key={c.code}
                      style={[s.countryChip, active && s.countryChipActive]}
                      onPress={() => setCountry(c.code as CountryCode)}
                      activeOpacity={0.8}
                    >
                      <Text style={s.countryFlag}>{c.flag}</Text>
                      <Text style={[s.countryName, active && s.countryNameActive]}>
                        {t(c.nameKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              {/* Modules */}
              <Text style={[s.sectionLabel, { marginTop: 18 }]}>{t("login_modules")}</Text>
              <View style={s.moduleGrid}>
                {ALL_MODULES.map((m) => {
                  const enabled = modules.includes(m);
                  const isSystem = SYSTEM_MODULES.includes(m);
                  return (
                    <TouchableOpacity
                      key={m}
                      style={[
                        s.moduleCard,
                        enabled && s.moduleCardActive,
                        isSystem && s.moduleCardSystem,
                      ]}
                      onPress={() => !isSystem && toggleModule(m)}
                      activeOpacity={isSystem ? 1 : 0.75}
                      disabled={isSystem}
                    >
                      <Text style={s.moduleIcon}>{MODULE_ICONS[m]}</Text>
                      <Text
                        style={[s.moduleLabel, enabled && s.moduleLabelActive]}
                        numberOfLines={1}
                      >
                        {t(`mod_${m}`)}
                      </Text>
                      <View
                        style={[
                          s.moduleCheck,
                          enabled && s.moduleCheckOn,
                          isSystem && s.moduleCheckLocked,
                        ]}
                      >
                        <Text style={s.moduleCheckTxt}>
                          {isSystem ? "🔒" : enabled ? "✓" : ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Reset */}
              <TouchableOpacity style={s.resetBtn} onPress={handleReset} activeOpacity={0.85}>
                <Text style={s.resetIcon}>↺</Text>
                <Text style={s.resetTxt}>{t("login_reset")}</Text>
              </TouchableOpacity>
            </View>
          )}

          {error && (
            <View style={s.errorBox}>
              <Text style={s.errorTxt}>
                {error.startsWith("social_login_provider_not_configured")
                  ? t("login_social_unavailable")
                  : t("login_error")}
              </Text>
            </View>
          )}

          <TouchableOpacity
            style={[s.btn, isLoading && s.btnDisabled]}
            onPress={handleLogin}
            disabled={isLoading || !email || !password}
            activeOpacity={0.85}
          >
            {isLoading && !pendingProvider ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={s.btnTxt}>{t("login_btn")}</Text>
            )}
          </TouchableOpacity>

          {/* Séparateur OR */}
          <View style={s.divider}>
            <View style={s.dividerLine} />
            <Text style={s.dividerTxt}>{t("login_or")}</Text>
            <View style={s.dividerLine} />
          </View>

          {/* Social login grid */}
          <View style={s.socialGrid}>
            {SOCIALS
              .filter((sp) => sp.id !== "apple" || appleAvailable)
              .map((sp) => {
                const busy = pendingProvider === sp.id;
                const disabled =
                  isLoading ||
                  (sp.id === "google" && !googleConfigured);
                return (
                  <TouchableOpacity
                    key={sp.id}
                    style={[
                      s.socialBtn,
                      { backgroundColor: sp.bg, borderColor: sp.border ?? sp.bg },
                      disabled && !busy && s.socialBtnDimmed,
                    ]}
                    onPress={() => handleSocial(sp.id)}
                    disabled={disabled}
                    activeOpacity={0.85}
                    accessibilityLabel={t("login_continue_with", { provider: t(sp.labelKey) })}
                  >
                    {busy ? (
                      <ActivityIndicator color={sp.fg} size="small" />
                    ) : (
                      <Text style={[s.socialGlyph, { color: sp.fg }]}>{sp.glyph}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
          </View>
        </View>

        <TouchableOpacity
          style={s.guideLink}
          onPress={() => { openSetupGuide().catch(() => {}); }}
          activeOpacity={0.7}
        >
          <Text style={s.guideIcon}>📄</Text>
          <Text style={s.guideTxt}>{t("login_setup_guide")}</Text>
        </TouchableOpacity>

        <Text style={s.footer}>© 2026 Infinity International Facilities Management UAE</Text>
      </ScrollView>

      {resetToast && (
        <Animated.View style={[s.toast, { opacity: toastOpacity }]} pointerEvents="none">
          <Text style={s.toastTxt}>↺  {t("login_reset_done")}</Text>
        </Animated.View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  scroll: {
    flexGrow: 1, alignItems: "center", justifyContent: "center",
    padding: 24, paddingTop: 56, paddingBottom: 56,
  },
  langRow: {
    flexDirection: "row", gap: 8, marginBottom: 32,
    alignSelf: "flex-end",
  },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#374151",
  },
  langBtnActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.12)" },
  langTxt: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  langTxtActive: { color: "#B8924F" },

  header: { alignItems: "center", marginBottom: 36 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "rgba(184,146,79,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  logoText: { fontSize: 36, color: "#B8924F" },
  title: { fontSize: 28, fontWeight: "700", color: "#E2E8F0", letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 4 },

  form: { width: "100%", maxWidth: 420, gap: 14 },
  input: {
    backgroundColor: "#1F2937", borderWidth: 1.5, borderColor: "#374151",
    borderRadius: 10, height: 52, paddingHorizontal: 16,
    fontSize: 15, color: "#E2E8F0",
  },

  advancedToggle: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingVertical: 10, paddingHorizontal: 4, marginTop: 2,
  },
  advancedTxt: { color: "#94A3B8", fontSize: 13, fontWeight: "600", letterSpacing: 0.3 },
  advancedChevron: { color: "#64748B", fontSize: 11 },

  advancedPanel: {
    backgroundColor: "rgba(31,41,55,0.55)",
    borderWidth: 1, borderColor: "#2D3748",
    borderRadius: 12, padding: 16,
  },
  sectionLabel: {
    fontSize: 11, fontWeight: "700", color: "#94A3B8",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },

  countryRow: { gap: 8, paddingEnd: 4 },
  countryChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22,
    borderWidth: 1, borderColor: "#374151", backgroundColor: "#1F2937",
  },
  countryChipActive: {
    borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.15)",
  },
  countryFlag: { fontSize: 16 },
  countryName: { fontSize: 13, fontWeight: "600", color: "#94A3B8" },
  countryNameActive: { color: "#E2E8F0" },

  moduleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  moduleCard: {
    width: "48.5%",
    backgroundColor: "#1F2937",
    borderWidth: 1.5, borderColor: "#2D3748",
    borderRadius: 10, padding: 12,
    flexDirection: "row", alignItems: "center", gap: 10,
  },
  moduleCardActive: {
    borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.1)",
  },
  moduleCardSystem: {
    borderColor: "rgba(184,146,79,0.45)",
    backgroundColor: "rgba(184,146,79,0.08)",
    opacity: 0.95,
  },
  moduleIcon: { fontSize: 18 },
  moduleLabel: {
    flex: 1, fontSize: 12, fontWeight: "600", color: "#94A3B8",
  },
  moduleLabelActive: { color: "#E2E8F0" },
  moduleCheck: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 1.5, borderColor: "#374151",
    alignItems: "center", justifyContent: "center",
    backgroundColor: "transparent",
  },
  moduleCheckOn: {
    borderColor: "#B8924F", backgroundColor: "#B8924F",
  },
  moduleCheckLocked: {
    borderColor: "rgba(184,146,79,0.5)", backgroundColor: "transparent",
  },
  moduleCheckTxt: { color: "#fff", fontSize: 11, fontWeight: "800" },

  resetBtn: {
    marginTop: 16, alignSelf: "flex-start",
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8,
    borderWidth: 1, borderColor: "#374151", backgroundColor: "#1F2937",
  },
  resetIcon: { color: "#B8924F", fontSize: 14, fontWeight: "700" },
  resetTxt: { color: "#E2E8F0", fontSize: 12, fontWeight: "600" },

  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10,
    borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  errorTxt: { color: "#EF4444", fontSize: 13, fontWeight: "500" },
  btn: {
    backgroundColor: "#B8924F", borderRadius: 10,
    height: 52, alignItems: "center", justifyContent: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },

  divider: {
    flexDirection: "row", alignItems: "center", gap: 10,
    marginTop: 14, marginBottom: 4,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: "#2D3748" },
  dividerTxt: {
    color: "#64748B", fontSize: 11, fontWeight: "700",
    letterSpacing: 1.5, textTransform: "uppercase",
  },

  socialGrid: {
    flexDirection: "row", flexWrap: "wrap",
    justifyContent: "center", gap: 10,
    marginTop: 8,
  },
  socialBtn: {
    width: 48, height: 48, borderRadius: 12,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1,
    shadowColor: "#000", shadowOpacity: 0.25,
    shadowRadius: 6, shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  socialBtnDimmed: { opacity: 0.45 },
  socialGlyph: { fontSize: 20, fontWeight: "800" },
  guideLink: {
    marginTop: 24, alignSelf: "center",
    flexDirection: "row", alignItems: "center", gap: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8,
    borderWidth: 1, borderColor: "rgba(184,146,79,0.35)",
    backgroundColor: "rgba(184,146,79,0.06)",
  },
  guideIcon: { fontSize: 14 },
  guideTxt: {
    color: "#B8924F", fontSize: 12, fontWeight: "600",
    letterSpacing: 0.3,
  },

  footer: {
    marginTop: 16, fontSize: 10, color: "#374151", textAlign: "center",
  },

  toast: {
    position: "absolute", bottom: 40, alignSelf: "center",
    backgroundColor: "rgba(15,23,42,0.95)",
    borderWidth: 1, borderColor: "rgba(184,146,79,0.4)",
    paddingHorizontal: 18, paddingVertical: 10, borderRadius: 24,
  },
  toastTxt: { color: "#E2E8F0", fontSize: 13, fontWeight: "600" },
});
