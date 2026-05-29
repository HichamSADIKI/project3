/**
 * Dashboard — variante Fournisseur (rôle=fournisseur).
 * KPIs : mandats actifs, soumissions pending, leads, commissions, services.
 */
import { ScrollView, View, Text, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { partnerApi, type PartnerDashboard } from "@/lib/api";

function fmtAed(raw: string | undefined): string {
  const n = parseFloat(raw ?? "0");
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 0,
  }).format(isFinite(n) ? n : 0);
}

function Kpi({ label, value, color, hint }: { label: string; value: string | number; color: string; hint?: string }) {
  return (
    <View style={[s.kpi, { borderTopColor: color }]}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {hint ? <Text style={s.kpiHint}>{hint}</Text> : null}
    </View>
  );
}

export function FournisseurDashboard() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((u) => u.user);
  const logout = useAuthStore((u) => u.logout);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["partner-dashboard"],
    queryFn: async () => (await partnerApi.dashboard()).data as PartnerDashboard,
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
          <Text style={s.headerName}>{user?.full_name ?? "Partenaire"}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={s.logoutBtn}>
          <Text style={s.logoutText}>↩</Text>
        </TouchableOpacity>
      </View>

      <View style={s.kpiGrid}>
        <Kpi label="Mandats actifs" value={data?.active_mandates ?? 0} color="#34D399" />
        <Kpi label="Soumissions en attente" value={data?.pending_submissions ?? 0} color="#D9B777" />
        <Kpi label="Leads actifs" value={data?.active_leads ?? 0} color="#60A5FA" />
        <Kpi label="Leads convertis" value={data?.converted_leads ?? 0} color="#34D399" />
        <Kpi label="Commissions à percevoir" value={fmtAed(data?.commissions_pending_aed)} color="#D9B777" hint="AED" />
        <Kpi label="Commissions payées" value={fmtAed(data?.commissions_paid_aed)} color="#34D399" hint="AED" />
        <Kpi label="Services actifs" value={data?.active_services ?? 0} color="#A78BFA" />
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
  kpiValue: { color: "#E2E8F0", fontSize: 22, fontWeight: "700" },
  kpiLabel: { color: "#94A3B8", fontSize: 11, marginTop: 4, textTransform: "uppercase", letterSpacing: 0.5 },
  kpiHint: { color: "#64748B", fontSize: 10, marginTop: 2 },
});
