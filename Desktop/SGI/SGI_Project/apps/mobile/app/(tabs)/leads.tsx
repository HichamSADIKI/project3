/**
 * Écran Partenaire — Mes leads (apporteur d'affaires).
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { partnerApi, type PartnerLead } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  new: "#D9B777",
  contacted: "#60A5FA",
  qualified: "#60A5FA",
  converted: "#34D399",
  lost: "#F87171",
};

const STATUS_LABEL: Record<string, string> = {
  new: "Nouveau",
  contacted: "Contacté",
  qualified: "Qualifié",
  converted: "Converti",
  lost: "Perdu",
};

const INTEREST_LABEL: Record<string, string> = {
  buy: "Achat",
  rent: "Location",
  golden_visa: "Golden Visa",
  commercial: "Commercial",
};

export default function LeadsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["partner-leads"],
    queryFn: async () => (await partnerApi.leads()).data,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderItem({ item }: { item: PartnerLead }) {
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.name}>
            {item.prospect_first_name} {item.prospect_last_name ?? ""}
          </Text>
          <View style={[s.badge, { backgroundColor: `${STATUS_COLOR[item.status] ?? "#64748B"}22` }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? "#94A3B8" }]}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text style={s.contact}>{item.prospect_phone}</Text>
        {item.prospect_email && <Text style={s.email}>{item.prospect_email}</Text>}
        <Text style={s.meta}>
          {INTEREST_LABEL[item.interest_type] ?? item.interest_type}
          {item.budget_aed
            ? ` · ${parseFloat(item.budget_aed).toLocaleString("en-AE")} AED`
            : ""}
        </Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.screenTitle}>Mes leads</Text>
      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={<Text style={s.empty}>Aucun lead soumis pour l'instant.</Text>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#161B22" },
  screenTitle: { color: "#E2E8F0", fontSize: 22, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#30404D",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  name: { color: "#E2E8F0", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  contact: { color: "#CBD5E1", fontSize: 13, marginTop: 6 },
  email: { color: "#94A3B8", fontSize: 12, marginTop: 2 },
  meta: { color: "#D9B777", fontSize: 13, marginTop: 8, fontWeight: "500" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
