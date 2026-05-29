/**
 * Dashboard — variante Client (rôle=client).
 * 5 KPIs : favoris, contrats actifs, paiements à venir, visites pending, messages non lus.
 */
import { ScrollView, View, Text, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { clientPortalApi, type ClientDashboard } from "@/lib/api";

function Kpi({ label, value, color }: { label: string; value: number | string; color: string }) {
  return (
    <View style={[s.kpi, { borderTopColor: color }]}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
    </View>
  );
}

export function ClientDashboard() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((u) => u.user);
  const logout = useAuthStore((u) => u.logout);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["client-dashboard"],
    queryFn: async () => (await clientPortalApi.dashboard()).data as ClientDashboard,
  });

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl onRefresh={refetch} tintColor="#B8924F" refreshing={isLoading} />}
    >
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.headerHello}>Bonjour</Text>
          <Text style={s.headerName}>{user?.full_name ?? "Client"}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>↩</Text>
        </TouchableOpacity>
      </View>

      <View style={s.kpiGrid}>
        <Kpi label="Favoris" value={data?.favorites_count ?? 0} color="#D9B777" />
        <Kpi label="Contrats actifs" value={data?.active_contracts ?? 0} color="#34D399" />
        <Kpi label="Paiements à venir" value={data?.upcoming_payments ?? 0} color="#60A5FA" />
        <Kpi label="Visites planifiées" value={data?.pending_visits ?? 0} color="#A78BFA" />
        <Kpi label="Messages non lus" value={data?.unread_messages ?? 0} color="#F87171" />
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  headerHello: { color: "#94A3B8", fontSize: 13 },
  headerName: { color: "#E2E8F0", fontSize: 22, fontWeight: "700", marginTop: 2 },
  logoutBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "#1F2937", alignItems: "center", justifyContent: "center" },
  logoutText: { color: "#E2E8F0", fontSize: 18 },
  kpiGrid: { paddingHorizontal: 12, flexDirection: "row", flexWrap: "wrap" },
  kpi: {
    width: "47%",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 14,
    margin: "1.5%",
    borderTopWidth: 2,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderColor: "#30404D",
  },
  kpiValue: { color: "#E2E8F0", fontSize: 26, fontWeight: "700" },
  kpiLabel: { color: "#94A3B8", fontSize: 11, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
});
