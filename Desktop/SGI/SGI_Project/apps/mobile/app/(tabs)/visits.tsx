/**
 * Écran Client — Mes visites.
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clientPortalApi, type VisitRequest } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  pending: "#D9B777",
  confirmed: "#60A5FA",
  done: "#34D399",
  cancelled: "#F87171",
  no_show: "#F87171",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  confirmed: "Confirmée",
  done: "Effectuée",
  cancelled: "Annulée",
  no_show: "Absence",
};

export default function VisitsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["client-visits"],
    queryFn: async () => (await clientPortalApi.visits()).data,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderItem({ item }: { item: VisitRequest }) {
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.date}>
            {new Date(item.preferred_date).toLocaleDateString("fr-FR")}
            {item.preferred_time_slot ? ` · ${item.preferred_time_slot}` : ""}
          </Text>
          <View style={[s.badge, { backgroundColor: `${STATUS_COLOR[item.status] ?? "#64748B"}20` }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? "#94A3B8" }]}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text style={s.meta}>Bien {item.property_id.slice(0, 8)}…</Text>
        {item.client_notes && <Text style={s.notes}>{item.client_notes}</Text>}
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Mes visites</Text>
      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={<Text style={s.empty}>Aucune visite planifiée.</Text>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#161B22" },
  title: { color: "#E2E8F0", fontSize: 22, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 16 },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#30404D",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  date: { color: "#E2E8F0", fontSize: 14, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  meta: { color: "#64748B", fontSize: 12, fontFamily: "monospace", marginTop: 8 },
  notes: { color: "#CBD5E1", fontSize: 13, marginTop: 8, lineHeight: 18 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
