/**
 * Écran Agenda (agent) — RDV / visites / tâches / appels.
 * Câblé sur le backend `/agenda` (auth Bearer injectée par lib/api → secure-store).
 */
import { useState } from "react";
import {
  View,
  Text,
  FlatList,
  RefreshControl,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { agendaApi, type AgendaEvent } from "@/lib/api";

const STATUS_COLOR: Record<string, string> = {
  scheduled: "#60A5FA",
  done: "#34D399",
  cancelled: "#F87171",
};

const STATUS_LABEL: Record<string, string> = {
  scheduled: "Planifié",
  done: "Effectué",
  cancelled: "Annulé",
};

const TYPE_ICON: Record<string, string> = {
  appointment: "📌",
  visit: "🏠",
  task: "✅",
  call: "📞",
  other: "•",
};

/** Date/heure courte lisible (locale en-AE, chiffres latins). */
function formatWhen(iso: string, allDay: boolean): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const opts: Intl.DateTimeFormatOptions = allDay
    ? { month: "short", day: "2-digit" }
    : { month: "short", day: "2-digit", hour: "2-digit", minute: "2-digit" };
  return new Intl.DateTimeFormat("en-AE", opts).format(d);
}

export default function AgendaScreen() {
  const insets = useSafeAreaInsets();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading, isError } = useQuery({
    queryKey: ["agenda-events"],
    queryFn: async () => (await agendaApi.list({ limit: 50 })).data.data,
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderItem({ item }: { item: AgendaEvent }) {
    const color = STATUS_COLOR[item.status] ?? "#64748B";
    return (
      <View style={s.card}>
        <Text style={s.icon}>{TYPE_ICON[item.event_type] ?? "•"}</Text>
        <View style={s.body}>
          <Text style={s.title} numberOfLines={1}>
            {item.title}
          </Text>
          <Text style={s.when}>{formatWhen(item.start_at, item.all_day)}</Text>
          {item.location ? (
            <Text style={s.meta} numberOfLines={1}>
              📍 {item.location}
            </Text>
          ) : null}
        </View>
        <View style={[s.badge, { backgroundColor: `${color}20` }]}>
          <Text style={[s.badgeText, { color }]}>
            {STATUS_LABEL[item.status] ?? item.status}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[s.screen, { paddingTop: insets.top + 12 }]}>
      <Text style={s.heading}>Agenda</Text>
      {isLoading ? (
        <ActivityIndicator color="#B8924F" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={data ?? []}
          keyExtractor={(e) => e.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#B8924F" />
          }
          ListEmptyComponent={
            <Text style={s.empty}>
              {isError ? "Erreur de chargement." : "Aucun événement à venir."}
            </Text>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#0F172A", paddingHorizontal: 16 },
  heading: { color: "#F8FAFC", fontSize: 22, fontWeight: "700", marginBottom: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#1E293B",
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
  },
  icon: { fontSize: 20 },
  body: { flex: 1, minWidth: 0 },
  title: { color: "#F1F5F9", fontSize: 15, fontWeight: "600" },
  when: { color: "#94A3B8", fontSize: 12.5, marginTop: 3 },
  meta: { color: "#64748B", fontSize: 12, marginTop: 2 },
  badge: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  badgeText: { fontSize: 11, fontWeight: "700" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
