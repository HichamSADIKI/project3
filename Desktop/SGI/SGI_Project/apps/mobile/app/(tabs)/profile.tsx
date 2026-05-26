/**
 * Écran Profil / Paramètres SGI Mobile.
 */
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, Alert,
} from "react-native";
import { useTranslation } from "react-i18next";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { setLanguage } from "@/lib/i18n";

const LANGS = [
  { code: "en" as const, label: "English", flag: "🇬🇧" },
  { code: "fr" as const, label: "Français", flag: "🇫🇷" },
  { code: "ar" as const, label: "العربية", flag: "🇦🇪" },
];

const ROLE_LABELS: Record<string, string> = {
  admin: "Administrateur", manager: "Manager",
  agent: "Agent", accounting: "Comptable", legal: "Juridique",
};

export default function ProfileScreen() {
  const { t, i18n } = useTranslation();
  const { user, logout } = useAuthStore();
  const insets = useSafeAreaInsets();

  const handleLogout = () => {
    Alert.alert("Déconnexion", "Voulez-vous vous déconnecter ?", [
      { text: t("cancel"), style: "cancel" },
      { text: t("logout"), onPress: logout, style: "destructive" },
    ]);
  };

  return (
    <ScrollView style={[pr.root, { paddingTop: insets.top }]} contentContainerStyle={{ paddingBottom: 40 }}>
      {/* Header */}
      <View style={pr.header}>
        <Text style={pr.headerTitle}>{t("nav_profile")}</Text>
      </View>

      {/* User card */}
      <View style={pr.userCard}>
        <View style={pr.avatar}>
          <Text style={pr.avatarTxt}>{user?.full_name?.[0] ?? "?"}</Text>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={pr.userName}>{user?.full_name}</Text>
          <Text style={pr.userEmail}>{user?.email}</Text>
          <View style={pr.roleBadge}>
            <Text style={pr.roleTxt}>{ROLE_LABELS[user?.role ?? ""] ?? user?.role}</Text>
          </View>
        </View>
      </View>

      {/* Language */}
      <View style={pr.section}>
        <Text style={pr.sectionTitle}>Langue de l'interface</Text>
        {LANGS.map((l) => (
          <TouchableOpacity
            key={l.code}
            style={[pr.langRow, i18n.language === l.code && pr.langRowActive]}
            onPress={() => setLanguage(l.code)}
          >
            <Text style={pr.langFlag}>{l.flag}</Text>
            <Text style={[pr.langLabel, i18n.language === l.code && pr.langLabelActive]}>
              {l.label}
            </Text>
            {i18n.language === l.code && <Text style={pr.checkmark}>✓</Text>}
          </TouchableOpacity>
        ))}
      </View>

      {/* App info */}
      <View style={pr.section}>
        <Text style={pr.sectionTitle}>Application</Text>
        <View style={pr.infoRow}>
          <Text style={pr.infoKey}>Version</Text>
          <Text style={pr.infoVal}>1.0.0</Text>
        </View>
        <View style={pr.infoRow}>
          <Text style={pr.infoKey}>Société</Text>
          <Text style={pr.infoVal}>Infinity International UAE</Text>
        </View>
        <View style={pr.infoRow}>
          <Text style={pr.infoKey}>ID entreprise</Text>
          <Text style={pr.infoVal}>{user?.company_id?.slice(0, 8)}…</Text>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity style={pr.logoutBtn} onPress={handleLogout}>
        <Text style={pr.logoutTxt}>{t("logout")}</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const pr = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  header: {
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#E2E8F0" },

  userCard: {
    flexDirection: "row", alignItems: "center", gap: 16,
    margin: 16, padding: 20, backgroundColor: "#1F2937",
    borderRadius: 14, borderWidth: 1, borderColor: "#374151",
  },
  avatar: {
    width: 56, height: 56, borderRadius: 28,
    backgroundColor: "rgba(184,146,79,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "#B8924F",
  },
  avatarTxt: { fontSize: 22, fontWeight: "700", color: "#B8924F" },
  userName: { fontSize: 16, fontWeight: "700", color: "#E2E8F0", marginBottom: 3 },
  userEmail: { fontSize: 13, color: "#64748B", marginBottom: 8 },
  roleBadge: {
    alignSelf: "flex-start", backgroundColor: "rgba(184,146,79,0.12)",
    borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  roleTxt: { fontSize: 11, color: "#B8924F", fontWeight: "700" },

  section: { marginHorizontal: 16, marginTop: 20 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748B",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 10,
  },

  langRow: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#1F2937", borderRadius: 10, padding: 14,
    borderWidth: 1, borderColor: "#374151", marginBottom: 8,
  },
  langRowActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.08)" },
  langFlag: { fontSize: 20 },
  langLabel: { flex: 1, fontSize: 14, color: "#94A3B8", fontWeight: "500" },
  langLabelActive: { color: "#E2E8F0", fontWeight: "700" },
  checkmark: { fontSize: 16, color: "#B8924F", fontWeight: "700" },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  infoKey: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, color: "#94A3B8", fontWeight: "500" },

  logoutBtn: {
    margin: 16, marginTop: 32, padding: 16, borderRadius: 12,
    backgroundColor: "rgba(239,68,68,0.1)", borderWidth: 1, borderColor: "rgba(239,68,68,0.3)",
    alignItems: "center",
  },
  logoutTxt: { color: "#EF4444", fontWeight: "700", fontSize: 15 },
});
