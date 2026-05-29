/**
 * Écran Partenaire — Mes soumissions de biens.
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { partnerApi, type PropertySubmission } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  pending: "#D9B777",
  approved: "#34D399",
  rejected: "#F87171",
  converted: "#60A5FA",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  approved: "Approuvé",
  rejected: "Refusé",
  converted: "Converti",
};

export default function SubmissionsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["partner-submissions"],
    queryFn: async () => (await partnerApi.submissions()).data,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderItem({ item }: { item: PropertySubmission }) {
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.title}>{item.title}</Text>
          <View style={[s.badge, { backgroundColor: `${STATUS_COLOR[item.status] ?? "#64748B"}22` }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? "#94A3B8" }]}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text style={s.meta}>
          {item.type} · {item.district ?? item.city}
          {item.bedrooms != null ? ` · ${item.bedrooms} ch.` : ""}
        </Text>
        <Text style={s.price}>
          {parseFloat(item.asking_price).toLocaleString("en-AE")} AED
        </Text>
        {item.review_notes && <Text style={s.notes}>Note: {item.review_notes}</Text>}
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.screenTitle}>Mes soumissions</Text>
      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={<Text style={s.empty}>Aucune soumission pour l'instant.</Text>}
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
  title: { color: "#E2E8F0", fontSize: 15, fontWeight: "600", flex: 1, marginRight: 8 },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: "#94A3B8", fontSize: 13, marginTop: 6 },
  price: { color: "#D9B777", fontSize: 14, fontWeight: "600", marginTop: 6 },
  notes: { color: "#CBD5E1", fontSize: 12, marginTop: 8, fontStyle: "italic" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
