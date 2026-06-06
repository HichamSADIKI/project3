/**
 * Écran Client — Messagerie.
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clientPortalApi, type ClientMessage } from "@/lib/api";

export default function MessagesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["client-messages"],
    queryFn: async () => (await clientPortalApi.messages()).data,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => clientPortalApi.markMessageRead(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-messages"] }),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function renderItem({ item }: { item: ClientMessage }) {
    const isUnread = item.read_at === null;
    return (
      <TouchableOpacity
        onPress={() => isUnread && markReadMutation.mutate(item.id)}
        style={[s.card, isUnread && s.cardUnread]}
        activeOpacity={0.75}
      >
        <View style={s.row}>
          <Text style={s.subject}>{item.subject ?? "(sans sujet)"}</Text>
          {isUnread && <View style={s.unreadDot} />}
        </View>
        <Text style={s.body} numberOfLines={3}>{item.body}</Text>
        <Text style={s.date}>{new Date(item.created_at).toLocaleString("fr-FR")}</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Messages</Text>
      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={<Text style={s.empty}>Aucun message.</Text>}
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
  cardUnread: { borderColor: "#60A5FA" },
  row: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  subject: { color: "#E2E8F0", fontSize: 15, fontWeight: "600", flex: 1 },
  unreadDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: "#60A5FA", marginLeft: 8 },
  body: { color: "#CBD5E1", fontSize: 13, marginTop: 6, lineHeight: 18 },
  date: { color: "#64748B", fontSize: 11, marginTop: 8 },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
