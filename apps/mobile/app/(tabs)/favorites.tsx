/**
 * Écran Client — Mes favoris.
 * Liste les biens favoris du client connecté + permet de retirer un favori.
 */
import { useState } from "react";
import { View, Text, FlatList, RefreshControl, StyleSheet, TouchableOpacity, Alert } from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { clientPortalApi, type Favorite } from "@/lib/api";

export default function FavoritesScreen() {
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const { data, refetch, isLoading } = useQuery({
    queryKey: ["client-favorites"],
    queryFn: async () => (await clientPortalApi.favorites()).data,
  });

  const removeMutation = useMutation({
    mutationFn: (id: string) => clientPortalApi.removeFavorite(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client-favorites"] }),
  });

  async function onRefresh() {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  }

  function confirmRemove(id: string) {
    Alert.alert("Retirer ce favori ?", "", [
      { text: "Annuler", style: "cancel" },
      { text: "Retirer", style: "destructive", onPress: () => removeMutation.mutate(id) },
    ]);
  }

  function renderItem({ item }: { item: Favorite }) {
    return (
      <View style={s.card}>
        <View style={{ flex: 1 }}>
          <Text style={s.cardLabel}>Bien favori</Text>
          <Text style={s.cardValue}>{item.property_id.slice(0, 8)}…</Text>
          <Text style={s.cardMeta}>
            Ajouté le {new Date(item.created_at).toLocaleDateString("fr-FR")}
          </Text>
        </View>
        <TouchableOpacity onPress={() => confirmRemove(item.id)} style={s.removeBtn}>
          <Text style={s.removeBtnText}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={[s.container, { paddingTop: insets.top + 16 }]}>
      <Text style={s.title}>Mes favoris</Text>
      <FlatList
        data={data ?? []}
        renderItem={renderItem}
        keyExtractor={(it) => it.id}
        refreshControl={<RefreshControl refreshing={refreshing || isLoading} onRefresh={onRefresh} tintColor="#B8924F" />}
        ListEmptyComponent={
          <Text style={s.empty}>Aucun bien favori pour le moment.</Text>
        }
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
      />
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#161B22" },
  title: {
    color: "#E2E8F0",
    fontSize: 22,
    fontWeight: "700",
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#1F2937",
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#30404D",
  },
  cardLabel: { color: "#94A3B8", fontSize: 11, textTransform: "uppercase", letterSpacing: 0.5 },
  cardValue: { color: "#E2E8F0", fontSize: 16, fontWeight: "600", fontFamily: "monospace", marginTop: 4 },
  cardMeta: { color: "#64748B", fontSize: 12, marginTop: 4 },
  removeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#450A0A",
    alignItems: "center",
    justifyContent: "center",
  },
  removeBtnText: { color: "#F87171", fontSize: 16, fontWeight: "700" },
  empty: { color: "#64748B", textAlign: "center", marginTop: 48, fontSize: 14 },
});
