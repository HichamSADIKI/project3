/**
 * Écran Partenaire — Mes commissions.
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { partnerApi, type PartnerCommission } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  pending: "#D9B777",
  payable: "#60A5FA",
  paid: "#34D399",
  cancelled: "#F87171",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "En attente",
  payable: "À payer",
  paid: "Payée",
  cancelled: "Annulée",
};

function fmtAed(raw: string): string {
  const n = parseFloat(raw);
  return new Intl.NumberFormat("en-AE", { style: "currency", currency: "AED", maximumFractionDigits: 2 }).format(
    isFinite(n) ? n : 0,
  );
}

export default function CommissionsScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["partner-commissions"],
    queryFn: async () => (await partnerApi.commissions()).data,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  // Totaux
  const totalPending = (data ?? [])
    .filter((c) => c.status === "pending" || c.status === "payable")
    .reduce((acc, c) => acc + parseFloat(c.commission_amount_aed), 0);
  const totalPaid = (data ?? [])
    .filter((c) => c.status === "paid")
    .reduce((acc, c) => acc + parseFloat(c.commission_amount_aed), 0);

  function renderItem({ item }: { item: PartnerCommission }) {
    return (
      <View style={s.card}>
        <View style={s.row}>
          <Text style={s.source}>{item.source_type}</Text>
          <View style={[s.badge, { backgroundColor: `${STATUS_COLOR[item.status] ?? "#64748B"}22` }]}>
            <Text style={[s.badgeText, { color: STATUS_COLOR[item.status] ?? "#94A3B8" }]}>
              {STATUS_LABEL[item.status] ?? item.status}
            </Text>
          </View>
        </View>
        <Text style={s.amount}>{fmtAed(item.commission_amount_aed)}</Text>
        <Text style={s.meta}>
          Base {fmtAed(item.base_amount_aed)} · {item.commission_rate}%
        </Text>
        <Text style={s.date}>{new Date(item.created_at).toLocaleDateString("fr-FR")}</Text>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.screenTitle}>Mes commissions</Text>

      <View style={s.summaryRow}>
        <View style={[s.summaryCard, { borderColor: "#D9B777" }]}>
          <Text style={s.summaryLabel}>À percevoir</Text>
          <Text style={[s.summaryValue, { color: "#D9B777" }]}>{fmtAed(totalPending.toString())}</Text>
        </View>
        <View style={[s.summaryCard, { borderColor: "#34D399" }]}>
          <Text style={s.summaryLabel}>Payées</Text>
          <Text style={[s.summaryValue, { color: "#34D399" }]}>{fmtAed(totalPaid.toString())}</Text>
        </View>
      </View>

      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={<Text style={s.empty}>Aucune commission à afficher.</Text>}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#161B22" },
  screenTitle: { color: "#E2E8F0", fontSize: 22, fontWeight: "700", paddingHorizontal: 16, paddingBottom: 16 },
  summaryRow: { flexDirection: "row", gap: 12, paddingHorizontal: 16, paddingBottom: 16 },
  summaryCard: {
    flex: 1,
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderTopWidth: 2,
  },
  summaryLabel: { color: "#94A3B8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  summaryValue: { fontSize: 18, fontWeight: "700", marginTop: 4 },
  card: {
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#30404D",
  },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  source: { color: "#94A3B8", fontSize: 12, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: "600" },
  badge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 4 },
  badgeText: { fontSize: 11, fontWeight: "700", textTransform: "uppercase" },
  amount: { color: "#E2E8F0", fontSize: 18, fontWeight: "700", marginTop: 6 },
  meta: { color: "#94A3B8", fontSize: 12, marginTop: 4 },
  date: { color: "#64748B", fontSize: 11, marginTop: 6 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
