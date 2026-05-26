/**
 * Écran liste des propriétés SGI Mobile.
 * Filtres statut/type + recherche texte + pagination infinie.
 */
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  StyleSheet, ActivityIndicator, RefreshControl,
} from "react-native";
import { useInfiniteQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useState } from "react";
import { propertiesApi, Property } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";

const STATUS_COLORS: Record<string, string> = {
  available: "#10B981", sold: "#64748B", rented: "#3B82F6",
  reserved: "#F59E0B", under_offer: "#B8924F",
};

const STATUSES = ["", "available", "sold", "rented", "reserved"];
const TYPES    = ["", "villa", "apartment", "office", "penthouse", "townhouse"];

function PropertyCard({ item, onPress }: { item: Property; onPress: () => void }) {
  const { t } = useTranslation();
  const statusColor = STATUS_COLORS[item.status] ?? "#64748B";
  const title = item.title_en ?? item.reference;

  return (
    <TouchableOpacity style={s.card} onPress={onPress} activeOpacity={0.8}>
      {/* Image placeholder */}
      <View style={s.imgBox}>
        <Text style={s.imgIcon}>🏢</Text>
        {item.is_featured && (
          <View style={s.featuredBadge}>
            <Text style={s.featuredTxt}>{t("prop_featured")}</Text>
          </View>
        )}
      </View>

      <View style={s.cardBody}>
        <View style={s.cardTop}>
          <Text style={s.cardRef}>{item.reference}</Text>
          <View style={[s.statusDot, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
            <Text style={[s.statusTxt, { color: statusColor }]}>{t(`prop_${item.status}` as never)}</Text>
          </View>
        </View>

        <Text style={s.cardTitle} numberOfLines={1}>{title}</Text>
        {item.district && <Text style={s.cardLoc}>{item.district}, {item.city}</Text>}

        <View style={s.cardMeta}>
          {item.bedrooms !== null && (
            <Text style={s.metaItem}>{item.bedrooms} {t("prop_beds")}</Text>
          )}
          {item.bathrooms !== null && (
            <Text style={s.metaItem}>{item.bathrooms} {t("prop_baths")}</Text>
          )}
          {item.area_sqm !== null && (
            <Text style={s.metaItem}>{item.area_sqm} {t("prop_area")}</Text>
          )}
        </View>

        <Text style={s.cardPrice}>
          {t("prop_aed")} {Number(item.price).toLocaleString("en-AE")}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function PropertiesScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [q, setQ]             = useState("");
  const [status, setStatus]   = useState("");
  const [type, setType]       = useState("");
  const debouncedQ            = useDebounce(q);

  const LIMIT = 15;

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading, refetch } =
    useInfiniteQuery({
      queryKey: ["properties", debouncedQ, status, type],
      queryFn: ({ pageParam = 1 }) =>
        propertiesApi.list({ page: pageParam, limit: LIMIT, q: debouncedQ || undefined, status: status || undefined, type: type || undefined })
          .then((r) => r.data),
      getNextPageParam: (last) => {
        const { page, pages } = last.meta;
        return page < pages ? page + 1 : undefined;
      },
      initialPageParam: 1,
    });

  const items = data?.pages.flatMap((p) => p.data) ?? [];

  return (
    <View style={[s.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>{t("nav_properties")}</Text>
        <TouchableOpacity style={s.addBtn} onPress={() => {}}>
          <Text style={s.addTxt}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={s.searchRow}>
        <TextInput
          style={s.search}
          placeholder={t("prop_search")}
          placeholderTextColor="#64748B"
          value={q}
          onChangeText={setQ}
          returnKeyType="search"
        />
      </View>

      {/* Status filter chips */}
      <FlatList
        data={STATUSES}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 8 }}
        renderItem={({ item: st }) => (
          <TouchableOpacity
            style={[s.chip, status === st && s.chipActive]}
            onPress={() => setStatus(st)}
          >
            <Text style={[s.chipTxt, status === st && s.chipTxtActive]}>
              {st ? t(`prop_${st}` as never) : "Tous"}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* Properties list */}
      {isLoading ? (
        <View style={s.center}><ActivityIndicator color="#B8924F" size="large" /></View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <PropertyCard item={item} onPress={() => router.push(`/properties/${item.id}`)} />
          )}
          contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 32 }}
          ListEmptyComponent={
            <View style={s.center}>
              <Text style={s.emptyTxt}>{t("no_results")}</Text>
            </View>
          }
          onEndReached={() => hasNextPage && fetchNextPage()}
          onEndReachedThreshold={0.4}
          refreshControl={<RefreshControl onRefresh={refetch} tintColor="#B8924F" refreshing={isLoading} />}
          ListFooterComponent={isFetchingNextPage ? <ActivityIndicator color="#B8924F" style={{ marginVertical: 16 }} /> : null}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
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
  chip: {
    paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20,
    backgroundColor: "#1F2937", borderWidth: 1, borderColor: "#374151",
  },
  chipActive: { borderColor: "#B8924F", backgroundColor: "rgba(184,146,79,0.12)" },
  chipTxt: { fontSize: 12, color: "#64748B", fontWeight: "600" },
  chipTxtActive: { color: "#B8924F" },

  card: {
    backgroundColor: "#1F2937", borderRadius: 14,
    borderWidth: 1, borderColor: "#374151", overflow: "hidden",
  },
  imgBox: {
    height: 140, backgroundColor: "#253346",
    alignItems: "center", justifyContent: "center",
  },
  imgIcon: { fontSize: 48 },
  featuredBadge: {
    position: "absolute", top: 10, right: 10,
    backgroundColor: "rgba(184,146,79,0.9)", borderRadius: 6,
    paddingHorizontal: 8, paddingVertical: 3,
  },
  featuredTxt: { color: "#fff", fontSize: 10, fontWeight: "700" },
  cardBody: { padding: 14 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardRef: { fontSize: 11, color: "#64748B", fontWeight: "600" },
  statusDot: {
    borderWidth: 1, borderRadius: 6, paddingHorizontal: 8, paddingVertical: 2,
  },
  statusTxt: { fontSize: 10, fontWeight: "700" },
  cardTitle: { fontSize: 15, fontWeight: "700", color: "#E2E8F0", marginBottom: 3 },
  cardLoc: { fontSize: 12, color: "#64748B", marginBottom: 8 },
  cardMeta: { flexDirection: "row", gap: 12, marginBottom: 10 },
  metaItem: { fontSize: 12, color: "#94A3B8", fontWeight: "500" },
  cardPrice: { fontSize: 18, fontWeight: "700", color: "#B8924F" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 },
  emptyTxt: { color: "#64748B", fontSize: 14 },
});
