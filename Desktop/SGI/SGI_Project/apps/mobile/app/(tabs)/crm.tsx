/**
 * Écran CRM Pipeline SGI Mobile.
 * Kanban horizontal par statut + score de lead.
 */
import {
  View, Text, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, ScrollView, RefreshControl,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { crmApi, Lead } from "@/lib/api";

const PIPELINE_COLS = [
  { key: "new",           label: "Nouveau",    color: "#64748B" },
  { key: "contacted",     label: "Contacté",   color: "#3B82F6" },
  { key: "qualified",     label: "Qualifié",   color: "#8B5CF6" },
  { key: "proposal_sent", label: "Offre",      color: "#F59E0B" },
  { key: "negotiation",   label: "Négo.",      color: "#F97316" },
  { key: "won",           label: "Gagné",      color: "#10B981" },
  { key: "lost",          label: "Perdu",      color: "#EF4444" },
];

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <View style={sc.scoreRow}>
      <View style={sc.scoreTrack}>
        <View style={[sc.scoreFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
      <Text style={[sc.scoreTxt, { color }]}>{score}</Text>
    </View>
  );
}

function LeadCard({ lead, onPress }: { lead: Lead; onPress: () => void }) {
  const aed = (n: number | null) =>
    n ? `AED ${n.toLocaleString("en-AE")}` : "—";

  return (
    <TouchableOpacity style={sc.card} onPress={onPress} activeOpacity={0.8}>
      <ScoreBar score={lead.score} />
      <Text style={sc.cardTitle} numberOfLines={1}>Lead #{lead.id.slice(0, 8)}</Text>
      {lead.property_type && (
        <Text style={sc.cardType}>{lead.property_type}</Text>
      )}
      <Text style={sc.cardBudget}>{aed(lead.budget)}</Text>
      {lead.next_action_type && (
        <View style={sc.actionTag}>
          <Text style={sc.actionTxt}>
            {lead.next_action_type === "call" ? "📞" : lead.next_action_type === "email" ? "✉️" : "💬"}{" "}
            {lead.next_action_type}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function CRMScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeCol, setActiveCol] = useState("new");

  const { data: pipeline, isLoading: loadPipe, refetch: refPipe } = useQuery({
    queryKey: ["crm-pipeline"],
    queryFn: () => crmApi.pipeline().then((r) => r.data.data as Record<string, number>),
  });

  const { data: leads, isLoading: loadLeads, refetch: refLeads } = useQuery({
    queryKey: ["crm-leads", activeCol],
    queryFn: () => crmApi.list({ status: activeCol, limit: 50 }).then((r) => r.data.data),
  });

  const refetchAll = () => { refPipe(); refLeads(); };

  return (
    <View style={[sc.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={sc.header}>
        <Text style={sc.headerTitle}>Pipeline CRM</Text>
        <TouchableOpacity style={sc.addBtn} onPress={() => {}}>
          <Text style={sc.addTxt}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Pipeline KPI totals */}
      {loadPipe ? (
        <ActivityIndicator color="#B8924F" style={{ margin: 16 }} />
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}
          style={{ maxHeight: 56 }}
          contentContainerStyle={{ paddingHorizontal: 16, gap: 8, alignItems: "center" }}>
          {PIPELINE_COLS.map((col) => (
            <TouchableOpacity
              key={col.key}
              style={[sc.colChip, activeCol === col.key && { borderColor: col.color, backgroundColor: col.color + "18" }]}
              onPress={() => setActiveCol(col.key)}
            >
              <Text style={[sc.colChipCount, { color: col.color }]}>
                {pipeline?.[col.key] ?? 0}
              </Text>
              <Text style={[sc.colChipLabel, activeCol === col.key && { color: col.color }]}>
                {col.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      {/* Leads list for active status */}
      {loadLeads ? (
        <View style={sc.center}><ActivityIndicator color="#B8924F" size="large" /></View>
      ) : (
        <FlatList
          data={leads as Lead[]}
          keyExtractor={(l) => l.id}
          renderItem={({ item }) => (
            <LeadCard lead={item} onPress={() => router.push(`/crm/${item.id}`)} />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl onRefresh={refetchAll} tintColor="#B8924F" refreshing={loadLeads} />}
          ListEmptyComponent={
            <View style={sc.center}>
              <Text style={sc.emptyTxt}>Aucun lead dans ce statut</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const sc = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#161B22" },
  header: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  headerTitle: { fontSize: 20, fontWeight: "700", color: "#E2E8F0" },
  addBtn: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: "rgba(184,146,79,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  addTxt: { color: "#B8924F", fontSize: 20, fontWeight: "300" },

  colChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151",
  },
  colChipCount: { fontSize: 15, fontWeight: "700" },
  colChipLabel: { fontSize: 11, color: "#94A3B8", fontWeight: "600" },

  card: {
    backgroundColor: "#1F2937", borderRadius: 12,
    padding: 14, borderWidth: 1, borderColor: "#374151",
  },
  scoreRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  scoreTrack: { flex: 1, height: 4, backgroundColor: "#374151", borderRadius: 2, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 2 },
  scoreTxt: { fontSize: 12, fontWeight: "700", minWidth: 24, textAlign: "right" },
  cardTitle: { fontSize: 14, fontWeight: "600", color: "#E2E8F0", marginBottom: 3 },
  cardType: { fontSize: 12, color: "#94A3B8", marginBottom: 4 },
  cardBudget: { fontSize: 16, fontWeight: "700", color: "#B8924F", marginBottom: 6 },
  actionTag: {
    alignSelf: "flex-start", backgroundColor: "rgba(59,130,246,0.12)",
    borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3,
    borderWidth: 1, borderColor: "rgba(59,130,246,0.25)",
  },
  actionTxt: { fontSize: 11, color: "#3B82F6", fontWeight: "600" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTxt: { color: "#64748B", fontSize: 14 },
});
