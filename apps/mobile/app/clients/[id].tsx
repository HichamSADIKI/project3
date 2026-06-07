/**
 * Écran détail d'un client SGI Mobile.
 */
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clientsApi, Client } from "@/lib/api";

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <View style={d.infoRow}>
      <Text style={d.infoKey}>{label}</Text>
      <Text style={d.infoVal}>{value}</Text>
    </View>
  );
}

function ActionBtn({ icon, label, onPress, color = "#3B82F6" }: {
  icon: string; label: string; onPress: () => void; color?: string;
}) {
  return (
    <TouchableOpacity
      style={[d.actionBtn, { backgroundColor: color + "18", borderColor: color + "44" }]}
      onPress={onPress}
    >
      <Text style={d.actionIcon}>{icon}</Text>
      <Text style={[d.actionLabel, { color }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function ClientDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: client, isLoading, isError } = useQuery({
    queryKey: ["client", id],
    queryFn: () => clientsApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <ActivityIndicator color="#B8924F" size="large" />
      </View>
    );
  }

  if (isError || !client) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <Text style={d.errorTxt}>Client introuvable</Text>
        <TouchableOpacity style={d.backBtn} onPress={() => router.back()}>
          <Text style={d.backBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const name = client.type === "individual"
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : client.company_name ?? "—";

  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();
  const isCompany = client.type === "company";

  const budgetRange = client.budget_min || client.budget_max
    ? `AED ${(client.budget_min ?? 0).toLocaleString("en-AE")} — AED ${(client.budget_max ?? 0).toLocaleString("en-AE")}`
    : null;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      <View style={d.header}>
        <TouchableOpacity onPress={() => router.back()} style={d.backIcon}>
          <Text style={d.backIconTxt}>←</Text>
        </TouchableOpacity>
        <Text style={d.headerTitle} numberOfLines={1}>{name}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Profile card */}
        <View style={d.profileCard}>
          <View style={[d.avatar, isCompany && d.avatarCompany]}>
            <Text style={d.avatarTxt}>{initials || (isCompany ? "🏢" : "👤")}</Text>
          </View>
          <Text style={d.profileName}>{name}</Text>
          <View style={[d.typeBadge, isCompany && d.typeBadgeCompany]}>
            <Text style={[d.typeTxt, isCompany && d.typeTxtCompany]}>
              {isCompany ? "Société" : "Individu"}
            </Text>
          </View>
          {client.nationality && (
            <Text style={d.nationality}>🌍 {client.nationality}</Text>
          )}
        </View>

        {/* Quick actions */}
        <View style={d.actionsRow}>
          {client.phone && (
            <ActionBtn icon="📞" label="Appeler" color="#10B981"
              onPress={() => Linking.openURL(`tel:${client.phone}`)} />
          )}
          {client.email && (
            <ActionBtn icon="✉️" label="Email" color="#3B82F6"
              onPress={() => Linking.openURL(`mailto:${client.email}`)} />
          )}
          {client.phone && (
            <ActionBtn icon="💬" label="WhatsApp" color="#25D366"
              onPress={() => Linking.openURL(`https://wa.me/${client.phone?.replace(/\D/g, "")}`)} />
          )}
        </View>

        {/* Contact */}
        <View style={d.section}>
          <Text style={d.sectionTitle}>Contact</Text>
          <InfoRow label="Email" value={client.email} />
          <InfoRow label="Téléphone" value={client.phone} />
          <InfoRow label="Nationalité" value={client.nationality} />
        </View>

        {/* Preferences */}
        <View style={d.section}>
          <Text style={d.sectionTitle}>Préférences</Text>
          <InfoRow label="Budget min" value={client.budget_min ? `AED ${client.budget_min.toLocaleString("en-AE")}` : null} />
          <InfoRow label="Budget max" value={client.budget_max ? `AED ${client.budget_max.toLocaleString("en-AE")}` : null} />
          {budgetRange && (
            <View style={d.budgetBanner}>
              <Text style={d.budgetBannerTxt}>{budgetRange}</Text>
            </View>
          )}
          <InfoRow label="Type recherché" value={client.preferred_property_type} />
          <InfoRow label="Source" value={client.source} />
        </View>

        {/* Meta */}
        <View style={d.section}>
          <Text style={d.sectionTitle}>Informations système</Text>
          <InfoRow label="ID" value={client.id.slice(0, 8) + "…"} />
          <InfoRow label="Créé le" value={new Date(client.created_at).toLocaleDateString("fr-FR")} />
        </View>
      </ScrollView>
    </View>
  );
}

const d = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#161B22" },
  errorTxt: { color: "#64748B", fontSize: 15, marginBottom: 16 },
  backBtn: {
    paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10,
    backgroundColor: "rgba(184,146,79,0.15)", borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  backBtnTxt: { color: "#B8924F", fontWeight: "700" },

  header: {
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  backIcon: { padding: 4 },
  backIconTxt: { color: "#B8924F", fontSize: 22, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#E2E8F0" },

  profileCard: {
    alignItems: "center", padding: 32, paddingBottom: 24,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: "rgba(59,130,246,0.15)",
    alignItems: "center", justifyContent: "center",
    borderWidth: 2, borderColor: "rgba(59,130,246,0.4)", marginBottom: 16,
  },
  avatarCompany: {
    backgroundColor: "rgba(184,146,79,0.12)", borderColor: "rgba(184,146,79,0.4)",
  },
  avatarTxt: { fontSize: 28, fontWeight: "700", color: "#E2E8F0" },
  profileName: { fontSize: 22, fontWeight: "700", color: "#E2E8F0", marginBottom: 10, textAlign: "center" },
  typeBadge: {
    backgroundColor: "rgba(59,130,246,0.12)", borderRadius: 8,
    paddingHorizontal: 14, paddingVertical: 5, marginBottom: 8,
  },
  typeBadgeCompany: { backgroundColor: "rgba(184,146,79,0.12)" },
  typeTxt: { fontSize: 12, fontWeight: "700", color: "#3B82F6" },
  typeTxtCompany: { color: "#B8924F" },
  nationality: { fontSize: 14, color: "#64748B", marginTop: 4 },

  actionsRow: {
    flexDirection: "row", gap: 10, padding: 16,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  actionBtn: {
    flex: 1, alignItems: "center", paddingVertical: 12,
    borderRadius: 10, borderWidth: 1, gap: 4,
  },
  actionIcon: { fontSize: 20 },
  actionLabel: { fontSize: 11, fontWeight: "700" },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748B",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  infoKey: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, color: "#94A3B8", fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },

  budgetBanner: {
    marginTop: 8, padding: 14, borderRadius: 10,
    backgroundColor: "rgba(184,146,79,0.08)", borderWidth: 1, borderColor: "rgba(184,146,79,0.25)",
    alignItems: "center",
  },
  budgetBannerTxt: { fontSize: 15, fontWeight: "700", color: "#B8924F" },
});
