/**
 * Écran détail d'un lead CRM SGI Mobile.
 * Affiche le score, les activités et les transitions de statut.
 */
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert, TextInput, Modal,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { crmApi, Lead } from "@/lib/api";

const STATUS_COLORS: Record<string, string> = {
  new: "#64748B", contacted: "#3B82F6", qualified: "#8B5CF6",
  proposal_sent: "#F59E0B", negotiation: "#F97316", won: "#10B981", lost: "#EF4444",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Nouveau", contacted: "Contacté", qualified: "Qualifié",
  proposal_sent: "Offre envoyée", negotiation: "Négociation", won: "Gagné", lost: "Perdu",
};

const VALID_NEXT: Record<string, string[]> = {
  new: ["contacted", "lost"],
  contacted: ["qualified", "lost"],
  qualified: ["proposal_sent", "lost"],
  proposal_sent: ["negotiation", "lost"],
  negotiation: ["won", "lost"],
  won: [], lost: [],
};

const ACTIVITY_ICONS: Record<string, string> = {
  call: "📞", email: "✉️", whatsapp: "💬", visit: "🏠",
  note: "📝", status_change: "🔄", golden_visa: "🌟",
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 70 ? "#10B981" : score >= 40 ? "#F59E0B" : "#EF4444";
  return (
    <View style={d.scoreWrap}>
      <View style={d.scoreHeader}>
        <Text style={d.scoreLabel}>Score</Text>
        <Text style={[d.scoreNum, { color }]}>{score}/100</Text>
      </View>
      <View style={d.scoreTrack}>
        <View style={[d.scoreFill, { width: `${score}%` as any, backgroundColor: color }]} />
      </View>
    </View>
  );
}

export default function LeadDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [activityType, setActivityType] = useState("note");
  const [activityNote, setActivityNote] = useState("");
  const [lostReason, setLostReason] = useState("");

  const { data: lead, isLoading, isError } = useQuery({
    queryKey: ["lead", id],
    queryFn: () => crmApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const { data: activities, refetch: refetchActivities } = useQuery({
    queryKey: ["lead-activities", id],
    queryFn: () => crmApi.activities(id).then((r: any) => r.data.data),
    enabled: !!id,
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { status: string; reason?: string }) =>
      crmApi.updateStatus(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["lead", id] });
      qc.invalidateQueries({ queryKey: ["crm-leads"] });
      qc.invalidateQueries({ queryKey: ["crm-pipeline"] });
      setShowStatusModal(false);
    },
  });

  const activityMutation = useMutation({
    mutationFn: (payload: unknown) => crmApi.addActivity(id, payload),
    onSuccess: () => {
      refetchActivities();
      setShowActivityModal(false);
      setActivityNote("");
    },
  });

  if (isLoading) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <ActivityIndicator color="#B8924F" size="large" />
      </View>
    );
  }

  if (isError || !lead) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <Text style={d.errorTxt}>Lead introuvable</Text>
        <TouchableOpacity style={d.backBtn} onPress={() => router.back()}>
          <Text style={d.backBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[lead.status] ?? "#64748B";
  const nextStatuses = VALID_NEXT[lead.status] ?? [];

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={d.header}>
        <TouchableOpacity onPress={() => router.back()} style={d.backIcon}>
          <Text style={d.backIconTxt}>←</Text>
        </TouchableOpacity>
        <Text style={d.headerTitle}>Lead #{lead.id.slice(0, 8)}</Text>
        <TouchableOpacity
          style={[d.statusChip, { borderColor: statusColor, backgroundColor: statusColor + "18" }]}
          onPress={() => nextStatuses.length > 0 && setShowStatusModal(true)}
        >
          <Text style={[d.statusChipTxt, { color: statusColor }]}>{STATUS_LABELS[lead.status]}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Score */}
        <View style={d.card}>
          <ScoreBar score={lead.score} />
          {lead.golden_visa_eligible && (
            <View style={d.visaBadge}>
              <Text style={d.visaTxt}>🌟 Éligible Golden Visa</Text>
            </View>
          )}
        </View>

        {/* Lead info */}
        <View style={d.section}>
          <Text style={d.sectionTitle}>Informations</Text>
          {lead.budget && (
            <View style={d.budgetBanner}>
              <Text style={d.budgetTxt}>AED {lead.budget.toLocaleString("en-AE")}</Text>
            </View>
          )}
          {lead.property_type && (
            <View style={d.infoRow}>
              <Text style={d.infoKey}>Type recherché</Text>
              <Text style={d.infoVal}>{lead.property_type}</Text>
            </View>
          )}
          {lead.source && (
            <View style={d.infoRow}>
              <Text style={d.infoKey}>Source</Text>
              <Text style={d.infoVal}>{lead.source}</Text>
            </View>
          )}
          <View style={d.infoRow}>
            <Text style={d.infoKey}>Tentatives contact</Text>
            <Text style={d.infoVal}>{lead.contact_attempts}</Text>
          </View>
          {lead.next_action_at && (
            <View style={d.infoRow}>
              <Text style={d.infoKey}>Prochaine action</Text>
              <Text style={d.infoVal}>
                {lead.next_action_type && ACTIVITY_ICONS[lead.next_action_type]}{" "}
                {new Date(lead.next_action_at).toLocaleDateString("fr-FR")}
              </Text>
            </View>
          )}
          {lead.last_contact_at && (
            <View style={d.infoRow}>
              <Text style={d.infoKey}>Dernier contact</Text>
              <Text style={d.infoVal}>{new Date(lead.last_contact_at).toLocaleDateString("fr-FR")}</Text>
            </View>
          )}
          <View style={d.infoRow}>
            <Text style={d.infoKey}>Créé le</Text>
            <Text style={d.infoVal}>{new Date(lead.created_at).toLocaleDateString("fr-FR")}</Text>
          </View>
          {lead.notes && (
            <View style={d.notesBox}>
              <Text style={d.notesTxt}>{lead.notes}</Text>
            </View>
          )}
        </View>

        {/* Pipeline actions */}
        {nextStatuses.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionTitle}>Avancer le pipeline</Text>
            <View style={d.nextStatusRow}>
              {nextStatuses.map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[d.nextBtn, { borderColor: STATUS_COLORS[s] + "66", backgroundColor: STATUS_COLORS[s] + "18" }]}
                  onPress={() => {
                    if (s === "lost") {
                      setShowStatusModal(true);
                    } else {
                      Alert.alert(
                        "Changer le statut",
                        `Passer le lead en "${STATUS_LABELS[s]}" ?`,
                        [
                          { text: "Annuler", style: "cancel" },
                          { text: "Confirmer", onPress: () => statusMutation.mutate({ status: s }) },
                        ]
                      );
                    }
                  }}
                >
                  <Text style={[d.nextBtnTxt, { color: STATUS_COLORS[s] }]}>{STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Activities */}
        <View style={d.section}>
          <View style={d.sectionHeader}>
            <Text style={d.sectionTitle}>Activités</Text>
            <TouchableOpacity
              style={d.addActivityBtn}
              onPress={() => setShowActivityModal(true)}
            >
              <Text style={d.addActivityTxt}>＋ Ajouter</Text>
            </TouchableOpacity>
          </View>
          {(activities as any[])?.length > 0 ? (
            (activities as any[]).map((act: any) => (
              <View key={act.id} style={d.activityItem}>
                <Text style={d.activityIcon}>{ACTIVITY_ICONS[act.type] ?? "•"}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={d.activityType}>{act.type}</Text>
                  {act.notes && <Text style={d.activityNote}>{act.notes}</Text>}
                  <Text style={d.activityDate}>{new Date(act.created_at).toLocaleDateString("fr-FR")}</Text>
                </View>
              </View>
            ))
          ) : (
            <Text style={d.emptyTxt}>Aucune activité enregistrée</Text>
          )}
        </View>
      </ScrollView>

      {/* Lost reason modal */}
      <Modal visible={showStatusModal} transparent animationType="fade">
        <View style={d.modalOverlay}>
          <View style={d.modalBox}>
            <Text style={d.modalTitle}>Marquer comme perdu</Text>
            <TextInput
              style={d.modalInput}
              placeholder="Raison (optionnel)"
              placeholderTextColor="#64748B"
              value={lostReason}
              onChangeText={setLostReason}
            />
            <View style={d.modalActions}>
              <TouchableOpacity style={d.modalCancel} onPress={() => setShowStatusModal(false)}>
                <Text style={d.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={d.modalConfirm}
                onPress={() => statusMutation.mutate({ status: "lost", reason: lostReason || undefined })}
              >
                <Text style={d.modalConfirmTxt}>Confirmer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Add activity modal */}
      <Modal visible={showActivityModal} transparent animationType="slide">
        <View style={d.modalOverlay}>
          <View style={d.modalBox}>
            <Text style={d.modalTitle}>Nouvelle activité</Text>
            <View style={d.actTypeRow}>
              {(["call", "email", "whatsapp", "visit", "note"] as const).map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[d.actTypeBtn, activityType === t && d.actTypeBtnActive]}
                  onPress={() => setActivityType(t)}
                >
                  <Text style={d.actTypeBtnTxt}>{ACTIVITY_ICONS[t]}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput
              style={[d.modalInput, { height: 80, textAlignVertical: "top" }]}
              placeholder="Notes…"
              placeholderTextColor="#64748B"
              value={activityNote}
              onChangeText={setActivityNote}
              multiline
            />
            <View style={d.modalActions}>
              <TouchableOpacity style={d.modalCancel} onPress={() => setShowActivityModal(false)}>
                <Text style={d.modalCancelTxt}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={d.modalConfirm}
                onPress={() => activityMutation.mutate({ type: activityType, notes: activityNote || undefined })}
              >
                <Text style={d.modalConfirmTxt}>Enregistrer</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  backIcon: { padding: 4 },
  backIconTxt: { color: "#B8924F", fontSize: 22, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#E2E8F0" },
  statusChip: {
    borderWidth: 1, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5,
  },
  statusChipTxt: { fontSize: 12, fontWeight: "700" },

  card: {
    margin: 16, padding: 20, backgroundColor: "#1F2937",
    borderRadius: 14, borderWidth: 1, borderColor: "#374151",
  },
  scoreWrap: {},
  scoreHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 8 },
  scoreLabel: { fontSize: 13, color: "#94A3B8", fontWeight: "600" },
  scoreNum: { fontSize: 18, fontWeight: "700" },
  scoreTrack: { height: 8, backgroundColor: "#374151", borderRadius: 4, overflow: "hidden" },
  scoreFill: { height: "100%", borderRadius: 4 },
  visaBadge: {
    marginTop: 14, padding: 10, borderRadius: 10,
    backgroundColor: "rgba(184,146,79,0.12)", borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
    alignItems: "center",
  },
  visaTxt: { color: "#B8924F", fontWeight: "700", fontSize: 13 },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748B",
    letterSpacing: 1, textTransform: "uppercase",
  },
  addActivityBtn: {
    paddingHorizontal: 12, paddingVertical: 5, borderRadius: 8,
    backgroundColor: "rgba(184,146,79,0.12)", borderWidth: 1, borderColor: "rgba(184,146,79,0.3)",
  },
  addActivityTxt: { color: "#B8924F", fontSize: 12, fontWeight: "700" },

  budgetBanner: {
    padding: 16, borderRadius: 12, marginBottom: 12,
    backgroundColor: "rgba(184,146,79,0.08)", borderWidth: 1, borderColor: "rgba(184,146,79,0.25)",
    alignItems: "center",
  },
  budgetTxt: { fontSize: 22, fontWeight: "700", color: "#B8924F" },

  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  infoKey: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, color: "#94A3B8", fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },

  notesBox: {
    marginTop: 12, padding: 14, borderRadius: 10,
    backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151",
  },
  notesTxt: { fontSize: 14, color: "#94A3B8", lineHeight: 22 },

  nextStatusRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  nextBtn: {
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1,
  },
  nextBtnTxt: { fontSize: 13, fontWeight: "700" },

  activityItem: {
    flexDirection: "row", gap: 12, paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  activityIcon: { fontSize: 20, marginTop: 2 },
  activityType: { fontSize: 13, color: "#94A3B8", fontWeight: "600", textTransform: "capitalize" },
  activityNote: { fontSize: 13, color: "#64748B", marginTop: 2, lineHeight: 18 },
  activityDate: { fontSize: 11, color: "#475569", marginTop: 4 },
  emptyTxt: { color: "#64748B", fontSize: 13, textAlign: "center", paddingVertical: 20 },

  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalBox: {
    width: "100%", backgroundColor: "#1F2937",
    borderRadius: 16, padding: 24, borderWidth: 1, borderColor: "#374151",
  },
  modalTitle: { fontSize: 17, fontWeight: "700", color: "#E2E8F0", marginBottom: 16 },
  modalInput: {
    backgroundColor: "#161B22", borderWidth: 1, borderColor: "#374151",
    borderRadius: 10, padding: 14, color: "#E2E8F0", fontSize: 14, marginBottom: 16,
  },
  actTypeRow: { flexDirection: "row", gap: 8, marginBottom: 16 },
  actTypeBtn: {
    flex: 1, alignItems: "center", paddingVertical: 10, borderRadius: 10,
    backgroundColor: "#161B22", borderWidth: 1, borderColor: "#374151",
  },
  actTypeBtnActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.12)" },
  actTypeBtnTxt: { fontSize: 20 },
  modalActions: { flexDirection: "row", gap: 10 },
  modalCancel: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(100,116,139,0.15)", borderWidth: 1, borderColor: "#374151",
  },
  modalCancelTxt: { color: "#94A3B8", fontWeight: "700" },
  modalConfirm: {
    flex: 1, padding: 14, borderRadius: 10, alignItems: "center",
    backgroundColor: "rgba(184,146,79,0.15)", borderWidth: 1, borderColor: "rgba(184,146,79,0.4)",
  },
  modalConfirmTxt: { color: "#B8924F", fontWeight: "700" },
});
