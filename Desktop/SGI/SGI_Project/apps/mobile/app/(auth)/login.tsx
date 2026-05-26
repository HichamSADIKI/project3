/**
 * Écran de connexion SGI Mobile.
 * Supporte AR/EN/FR avec RTL automatique.
 */
import { useState } from "react";
import {
  View, Text, TextInput, TouchableOpacity, KeyboardAvoidingView,
  Platform, ActivityIndicator, StyleSheet, Image,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useAuthStore } from "@/stores/auth";
import { setLanguage } from "@/lib/i18n";

const LANGS = [
  { code: "en" as const, label: "EN" },
  { code: "fr" as const, label: "FR" },
  { code: "ar" as const, label: "ع" },
];

export default function LoginScreen() {
  const { t, i18n } = useTranslation();
  const { login, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");

  const handleLogin = async () => {
    clearError();
    await login(email.trim(), password);
  };

  const handleLang = async (code: "ar" | "en" | "fr") => {
    await setLanguage(code);
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
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

        {error && (
          <View style={s.errorBox}>
            <Text style={s.errorTxt}>{t("login_error")}</Text>
          </View>
        )}

        <TouchableOpacity
          style={[s.btn, isLoading && s.btnDisabled]}
          onPress={handleLogin}
          disabled={isLoading || !email || !password}
          activeOpacity={0.85}
        >
          {isLoading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={s.btnTxt}>{t("login_btn")}</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text style={s.footer}>© 2026 Infinity International Facilities Management UAE</Text>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1, backgroundColor: "#161B22",
    alignItems: "center", justifyContent: "center", padding: 24,
  },
  langRow: { flexDirection: "row", gap: 8, marginBottom: 40, alignSelf: "flex-end" },
  langBtn: {
    paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
    borderWidth: 1, borderColor: "#374151",
  },
  langBtnActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.12)" },
  langTxt: { fontSize: 13, color: "#64748B", fontWeight: "600" },
  langTxtActive: { color: "#B8924F" },

  header: { alignItems: "center", marginBottom: 48 },
  logoBox: {
    width: 72, height: 72, borderRadius: 20,
    backgroundColor: "rgba(184,146,79,0.15)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 16, borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  logoText: { fontSize: 36, color: "#B8924F" },
  title: { fontSize: 28, fontWeight: "700", color: "#E2E8F0", letterSpacing: 0.5 },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 4 },

  form: { width: "100%", maxWidth: 400, gap: 14 },
  input: {
    backgroundColor: "#1F2937", borderWidth: 1.5, borderColor: "#374151",
    borderRadius: 10, height: 52, paddingHorizontal: 16,
    fontSize: 15, color: "#E2E8F0",
  },
  errorBox: {
    backgroundColor: "rgba(239,68,68,0.1)", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
  },
  errorTxt: { color: "#EF4444", fontSize: 13, fontWeight: "500" },
  btn: {
    backgroundColor: "#B8924F", borderRadius: 10,
    height: 52, alignItems: "center", justifyContent: "center",
    marginTop: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnTxt: { color: "#fff", fontWeight: "700", fontSize: 16 },
  footer: { position: "absolute", bottom: 24, fontSize: 10, color: "#374151", textAlign: "center" },
});
