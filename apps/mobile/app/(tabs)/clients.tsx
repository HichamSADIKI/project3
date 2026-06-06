/**
 * Écran Clients SGI Mobile — individus + sociétés.
 */
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { clientsApi, Client } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

function ClientCard({ client, onPress }: { client: Client; onPress: () => void }) {
  const name = client.type === "individual"
    ? `${client.first_name ?? ""} ${client.last_name ?? ""}`.trim()
    : client.company_name ?? "—";

  const initials = name.split(" ").slice(0, 2).map((w) => w[0]).join("").toUpperCase();

  const budgetRange = client.budget_min || client.budget_max
    ? `AED ${(client.budget_min ?? 0).toLocaleString("en-AE")} – ${(client.budget_max ?? 0).toLocaleString("en-AE")}`
    : null;

  return (
    <TouchableOpacity style={cl.card} onPress={onPress} activeOpacity={0.8}>
      <View style={[cl.avatar, client.type === "company" && cl.avatarCompany]}>
        <Text style={cl.avatarTxt}>{initials || (client.type === "company" ? "🏢" : "👤")}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={cl.cardTop}>
          <Text style={cl.cardName} numberOfLines={1}>{name}</Text>
          <View style={[cl.typeBadge, client.type === "company" && cl.typeBadgeCompany]}>
            <Text style={cl.typeTxt}>{client.type === "individual" ? "Individu" : "Société"}</Text>
          </View>
        </View>
        {client.email && <Text style={cl.cardEmail}>{client.email}</Text>}
        {client.phone && <Text style={cl.cardPhone}>{client.phone}</Text>}
        {budgetRange && <Text style={cl.cardBudget}>{budgetRange}</Text>}
        {client.nationality && <Text style={cl.cardNat}>🌍 {client.nationality}</Text>}
      </View>
    </TouchableOpacity>
  );
}

export default function ClientsScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [q, setQ]       = useState("");
  const [type, setType] = useState<"" | "individual" | "company">("");
  const debouncedQ      = useDebounce(q);

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ["clients", debouncedQ, type],
      queryFn: ({ pageParam = 1 }) =>
        clientsApi.list({ page: pageParam, limit: 20, q: debouncedQ || undefined, type: type || undefined })
          .then((r) => r.data),
      getNextPageParam: (last) => last.meta.page < last.meta.pages ? last.meta.page + 1 : undefined,
      initialPageParam: 1,
    });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={[cl.root, { paddingTop: insets.top }]}>
      <View style={cl.header}>
        <Text style={cl.headerTitle}>{t("nav_clients")}</Text>
        <TouchableOpacity style={cl.addBtn}><Text style={cl.addTxt}>＋</Text></TouchableOpacity>
      </View>

      <View style={cl.searchRow}>
        <TextInput
          style={cl.search}
          placeholder={t("client_search")}
          placeholderTextColor="#64748B"
          value={q}
          onChangeText={setQ}
        />
      </View>

      <View style={cl.typeRow}>
        {(["", "individual", "company"] as const).map((tp) => (
          <TouchableOpacity
            key={tp}
            style={[cl.chip, type === tp && cl.chipActive]}
            onPress={() => setType(tp)}
          >
            <Text style={[cl.chipTxt, type === tp && cl.chipTxtActive]}>
              {tp === "" ? "Tous" : tp === "individual" ? t("client_individual") : t("client_company")}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View style={cl.center}><ActivityIndicator color="#B8924F" size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(c) => c.id}
          renderItem={({ item }) => (
            <ClientCard client={item} onPress={() => router.push(`/clients/${item.id}`)} />
          )}
          contentContainerStyle={{ padding: 16, gap: 10, paddingBottom: 40 }}
          refreshControl={<RefreshControl onRefresh={refetch} tintColor="#B8924F" refreshing={isLoading} />}
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#B8924F" style={{ margin: 16 }} /> : null}
          ListEmptyComponent={
            <View style={cl.center}>
              <Text style={cl.emptyTxt}>{t("no_results")}</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const cl = StyleSheet.create({
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
  searchRow: { padding: 12, paddingBottom: 8 },
  search: {
    backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151",
    borderRadius: 10, height: 44, paddingHorizontal: 14,
    fontSize: 14, color: "#E2E8F0",
  },
  typeRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, paddingBottom: 10 },
  chip: {
    paddingHorizontal: 16, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151",
  },
  chipActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.12)" },
  chipTxt: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  chipTxtActive: { color: "#B8924F" },

  card: {
    flexDirection: "row", gap: 14, backgroundColor: "#1F2937",
    borderRadius: 12, padding: 14, borderWidth: 1, borderColor: "#374151",
    alignItems: "flex-start",
  },
  avatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: "rgba(59,130,246,0.15)", alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: "rgba(59,130,246,0.3)",
  },
  avatarCompany: {
    backgroundColor: "rgba(184,146,79,0.12)", borderColor: "rgba(184,146,79,0.3)",
  },
  avatarTxt: { fontSize: 16, fontWeight: "700", color: "#E2E8F0" },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  cardName: { fontSize: 15, fontWeight: "700", color: "#E2E8F0", flex: 1, marginRight: 8 },
  typeBadge: {
    backgroundColor: "rgba(59,130,246,0.12)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 2,
  },
  typeBadgeCompany: { backgroundColor: "rgba(184,146,79,0.12)" },
  typeTxt: { fontSize: 10, fontWeight: "700", color: "#3B82F6" },
  cardEmail: { fontSize: 12, color: "#64748B", marginBottom: 2 },
  cardPhone: { fontSize: 12, color: "#94A3B8", marginBottom: 2 },
  cardBudget: { fontSize: 12, color: "#B8924F", fontWeight: "600", marginTop: 4 },
  cardNat: { fontSize: 11, color: "#64748B", marginTop: 2 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTxt: { color: "#64748B", fontSize: 14 },
});
