/**
 * Dashboard SGI Mobile — KPIs principaux + alertes + accès rapide.
 */
import {
  View, Text, ScrollView, TouchableOpacity, StyleSheet, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { crmApi, propertiesApi, goldenVisaApi, financeApi } from "@/lib/api";

function KpiCard({ label, value, delta, color }: { label: string; value: string; delta?: string; color: string }) {
  return (
    <View style={[s.kpiCard, { borderTopColor: color, borderTopWidth: 2 }]}>
      <Text style={s.kpiValue}>{value}</Text>
      <Text style={s.kpiLabel}>{label}</Text>
      {delta ? <Text style={[s.kpiDelta, { color }]}>{delta}</Text> : null}
    </View>
  );
}

function QuickAction({ icon, label, onPress }: { icon: string; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={s.quickBtn} onPress={onPress} activeOpacity={0.75}>
      <Text style={s.quickIcon}>{icon}</Text>
      <Text style={s.quickLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function DashboardScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuthStore();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const { data: pipeline, refetch: refPipeline, isLoading: loadPipe } = useQuery({
    queryKey: ["crm-pipeline"],
    queryFn: () => crmApi.pipeline().then((r) => r.data.data),
  });

  const { data: propList, refetch: refProps } = useQuery({
    queryKey: ["properties-summary"],
    queryFn: () => propertiesApi.list({ limit: 1, status: "available" }).then((r) => r.data.meta.total),
  });

  const { data: visaList, refetch: refVisa } = useQuery({
    queryKey: ["golden-visa-summary"],
    queryFn: () => goldenVisaApi.list({ status: "in_review", limit: 1 }).then((r) => r.data.meta.total),
  });

  const { data: finSummary, refetch: refFin } = useQuery({
    queryKey: ["finance-summary"],
    queryFn: () => financeApi.summary().then((r) => r.data),
  });

  const refetchAll = () => { refPipeline(); refProps(); refVisa(); refFin(); };

  const won = pipeline?.won ?? 0;
  const active = (pipeline?.new ?? 0) + (pipeline?.contacted ?? 0) + (pipeline?.qualified ?? 0);

  return (
    <ScrollView
      style={s.root}
      contentContainerStyle={{ paddingBottom: 32 }}
      refreshControl={<RefreshControl onRefresh={refetchAll} tintColor="#B8924F" refreshing={loadPipe} />}
    >
      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 12 }]}>
        <View>
          <Text style={s.greeting}>Bonjour, {user?.full_name?.split(" ")[0]} 👋</Text>
          <Text style={s.subGreeting}>Infinity International UAE</Text>
        </View>
        <TouchableOpacity style={s.avatarBtn}>
          <Text style={s.avatarTxt}>{user?.full_name?.[0] ?? "?"}</Text>
        </TouchableOpacity>
      </View>

      {/* KPI Cards */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.kpiRow} contentContainerStyle={{ gap: 12, paddingHorizontal: 16 }}>
        <KpiCard label="Propriétés disponibles" value={String(propList ?? "—")} color="#B8924F" />
        <KpiCard label="Leads actifs" value={String(active)} color="#3B82F6" />
        <KpiCard label="Deals gagnés" value={String(won)} color="#10B981" />
        <KpiCard label="Visa en cours" value={String(visaList ?? "—")} color="#F59E0B" />
      </ScrollView>

      {/* Finance banner */}
      {finSummary?.data && (
        <View style={s.financeBanner}>
          <View>
            <Text style={s.financeLbl}>Revenus du mois</Text>
            <Text style={s.financeAmt}>
              AED {Number(finSummary.data.paid_this_month ?? 0).toLocaleString("en-AE")}
            </Text>
          </View>
          <View style={s.financeDivider} />
          <View>
            <Text style={s.financeLbl}>Factures en attente</Text>
            <Text style={s.financeCount}>{finSummary.data.pending_invoices ?? 0}</Text>
          </View>
        </View>
      )}

      {/* Pipeline mini-view */}
      {pipeline && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Pipeline CRM</Text>
          <View style={s.pipeRow}>
            {[
              { key: "new", label: "Nouveau", color: "#64748B" },
              { key: "contacted", label: "Contacté", color: "#3B82F6" },
              { key: "qualified", label: "Qualifié", color: "#8B5CF6" },
              { key: "negotiation", label: "Négo.", color: "#F59E0B" },
              { key: "won", label: "Gagné", color: "#10B981" },
            ].map((st) => (
              <View key={st.key} style={s.pipeItem}>
                <Text style={[s.pipeCount, { color: st.color }]}>
                  {(pipeline as Record<string, number>)[st.key] ?? 0}
                </Text>
                <Text style={s.pipeLbl}>{st.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Quick Actions */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Actions rapides</Text>
        <View style={s.quickGrid}>
          <QuickAction icon="🏢" label="Propriétés" onPress={() => router.push("/(tabs)/properties")} />
          <QuickAction icon="📊" label="Nouveau lead" onPress={() => router.push("/(tabs)/crm")} />
          <QuickAction icon="👥" label="Clients" onPress={() => router.push("/(tabs)/clients")} />
          <QuickAction icon="🛂" label="Golden Visa" onPress={() => router.push("/(tabs)/crm")} />
        </View>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: "#1F2937", borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  greeting: { fontSize: 18, fontWeight: "700", color: "#E2E8F0" },
  subGreeting: { fontSize: 12, color: "#64748B", marginTop: 2 },
  avatarBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(184,146,79,0.2)", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "#B8924F",
  },
  avatarTxt: { color: "#B8924F", fontWeight: "700", fontSize: 16 },

  kpiRow: { paddingVertical: 16 },
  kpiCard: {
    backgroundColor: "#1F2937", borderRadius: 12, padding: 16,
    minWidth: 140, borderWidth: 1, borderColor: "#374151",
  },
  kpiValue: { fontSize: 28, fontWeight: "700", color: "#E2E8F0" },
  kpiLabel: { fontSize: 11, color: "#64748B", marginTop: 4 },
  kpiDelta: { fontSize: 11, fontWeight: "600", marginTop: 6 },

  financeBanner: {
    margin: 16, padding: 20, borderRadius: 12,
    backgroundColor: "#1A2233", flexDirection: "row",
    alignItems: "center", borderWidth: 1, borderColor: "rgba(184,146,79,0.2)",
  },
  financeLbl: { fontSize: 11, color: "#64748B", marginBottom: 4 },
  financeAmt: { fontSize: 20, fontWeight: "700", color: "#B8924F" },
  financeCount: { fontSize: 20, fontWeight: "700", color: "#F59E0B" },
  financeDivider: { width: 1, height: 40, backgroundColor: "#374151", marginHorizontal: 20 },

  section: { marginHorizontal: 16, marginTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: "700", color: "#94A3B8", letterSpacing: 0.8, textTransform: "uppercase", marginBottom: 12 },

  pipeRow: {
    flexDirection: "row", backgroundColor: "#1F2937",
    borderRadius: 12, borderWidth: 1, borderColor: "#374151", overflow: "hidden",
  },
  pipeItem: { flex: 1, alignItems: "center", paddingVertical: 14, borderRightWidth: 1, borderRightColor: "#374151" },
  pipeCount: { fontSize: 22, fontWeight: "700" },
  pipeLbl: { fontSize: 9, color: "#64748B", marginTop: 2, textTransform: "uppercase" },

  quickGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  quickBtn: {
    width: "47%", backgroundColor: "#1F2937", borderRadius: 12,
    borderWidth: 1, borderColor: "#374151", padding: 16,
    alignItems: "center", gap: 8,
  },
  quickIcon: { fontSize: 28 },
  quickLabel: { fontSize: 12, fontWeight: "600", color: "#CBD5E1", textAlign: "center" },
});
