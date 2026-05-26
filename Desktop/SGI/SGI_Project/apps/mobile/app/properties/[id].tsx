/**
 * Écran détail d'une propriété SGI Mobile.
 */
import {
  View, Text, ScrollView, TouchableOpacity,
  StyleSheet, ActivityIndicator, Linking, Alert,
} from "react-native";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { propertiesApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";

const STATUS_COLORS: Record<string, string> = {
  available: "#10B981", sold: "#64748B", rented: "#3B82F6",
  reserved: "#F59E0B", under_offer: "#B8924F",
};

const STATUS_LABELS: Record<string, string> = {
  available: "Disponible", sold: "Vendu", rented: "Loué",
  reserved: "Réservé", under_offer: "Offre en cours",
};

function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  if (value == null || value === "") return null;
  return (
    <View style={d.infoRow}>
      <Text style={d.infoKey}>{label}</Text>
      <Text style={d.infoVal}>{value}</Text>
    </View>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuthStore();
  const qc = useQueryClient();

  const { data, isLoading, isError } = useQuery({
    queryKey: ["property", id],
    queryFn: () => propertiesApi.get(id).then((r) => r.data.data),
    enabled: !!id,
  });

  const deleteMutation = useMutation({
    mutationFn: () => propertiesApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["properties"] });
      router.back();
    },
  });

  const handleDelete = () => {
    Alert.alert(
      "Supprimer la propriété",
      "Cette action est irréversible. Confirmer ?",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: () => deleteMutation.mutate() },
      ]
    );
  };

  const openMaps = () => {
    if (!data?.latitude || !data?.longitude) return;
    const url = `https://maps.google.com/?q=${data.latitude},${data.longitude}`;
    Linking.openURL(url);
  };

  if (isLoading) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <ActivityIndicator color="#B8924F" size="large" />
      </View>
    );
  }

  if (isError || !data) {
    return (
      <View style={[d.center, { paddingTop: insets.top + 20 }]}>
        <Text style={d.errorTxt}>Propriété introuvable</Text>
        <TouchableOpacity style={d.backBtn} onPress={() => router.back()}>
          <Text style={d.backBtnTxt}>Retour</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const statusColor = STATUS_COLORS[data.status] ?? "#64748B";
  const price = `AED ${Number(data.price).toLocaleString("en-AE")}`;
  const title = data.title_en ?? data.reference;

  return (
    <View style={[d.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={d.header}>
        <TouchableOpacity onPress={() => router.back()} style={d.backIcon}>
          <Text style={d.backIconTxt}>←</Text>
        </TouchableOpacity>
        <Text style={d.headerTitle} numberOfLines={1}>{data.reference}</Text>
        {(user?.role === "admin" || user?.role === "manager") && (
          <TouchableOpacity style={d.deleteIcon} onPress={handleDelete}>
            <Text style={d.deleteIconTxt}>🗑</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Image hero */}
        <View style={d.hero}>
          <Text style={d.heroIcon}>🏢</Text>
          {data.is_featured && (
            <View style={d.featuredBadge}>
              <Text style={d.featuredTxt}>FEATURED</Text>
            </View>
          )}
          <View style={[d.statusBadge, { backgroundColor: statusColor + "22", borderColor: statusColor }]}>
            <Text style={[d.statusTxt, { color: statusColor }]}>{STATUS_LABELS[data.status] ?? data.status}</Text>
          </View>
        </View>

        {/* Price + Title */}
        <View style={d.priceSection}>
          <Text style={d.price}>{price}</Text>
          <Text style={d.title}>{title}</Text>
          {(data.district || data.city) && (
            <Text style={d.location}>📍 {[data.district, data.city].filter(Boolean).join(", ")}</Text>
          )}
        </View>

        {/* Quick stats */}
        <View style={d.statsRow}>
          {data.bedrooms != null && (
            <View style={d.statBox}>
              <Text style={d.statVal}>{data.bedrooms}</Text>
              <Text style={d.statKey}>Chambres</Text>
            </View>
          )}
          {data.bathrooms != null && (
            <View style={d.statBox}>
              <Text style={d.statVal}>{data.bathrooms}</Text>
              <Text style={d.statKey}>SDB</Text>
            </View>
          )}
          {data.area_sqm != null && (
            <View style={d.statBox}>
              <Text style={d.statVal}>{data.area_sqm}</Text>
              <Text style={d.statKey}>m²</Text>
            </View>
          )}
          {data.parking_spaces > 0 && (
            <View style={d.statBox}>
              <Text style={d.statVal}>{data.parking_spaces}</Text>
              <Text style={d.statKey}>Parking</Text>
            </View>
          )}
        </View>

        {/* Details section */}
        <View style={d.section}>
          <Text style={d.sectionTitle}>Informations</Text>
          <InfoRow label="Référence" value={data.reference} />
          <InfoRow label="Type" value={data.type} />
          <InfoRow label="Promoteur" value={data.developer} />
          <InfoRow label="Meublé" value={data.furnished ? "Oui" : "Non"} />
          <InfoRow label="Vues" value={data.views_count} />
          <InfoRow label="Créé le" value={new Date(data.created_at).toLocaleDateString("fr-FR")} />
        </View>

        {/* Address */}
        {(data.address_en || data.address_ar) && (
          <View style={d.section}>
            <Text style={d.sectionTitle}>Adresse</Text>
            {data.address_en && <Text style={d.addressTxt}>{data.address_en}</Text>}
          </View>
        )}

        {/* Amenities */}
        {data.amenities?.length > 0 && (
          <View style={d.section}>
            <Text style={d.sectionTitle}>Équipements</Text>
            <View style={d.amenitiesWrap}>
              {data.amenities.map((a) => (
                <View key={a} style={d.amenityChip}>
                  <Text style={d.amenityTxt}>{a}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Map button */}
        {data.latitude && data.longitude && (
          <TouchableOpacity style={d.mapBtn} onPress={openMaps}>
            <Text style={d.mapBtnTxt}>📍 Ouvrir sur la carte</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
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
    flexDirection: "row", alignItems: "center", gap: 12,
    paddingHorizontal: 16, paddingBottom: 12, paddingTop: 8,
    borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  backIcon: { padding: 4 },
  backIconTxt: { color: "#B8924F", fontSize: 22, fontWeight: "700" },
  headerTitle: { flex: 1, fontSize: 18, fontWeight: "700", color: "#E2E8F0" },
  deleteIcon: { padding: 4 },
  deleteIconTxt: { fontSize: 18 },

  hero: {
    height: 200, backgroundColor: "#253346",
    alignItems: "center", justifyContent: "center",
  },
  heroIcon: { fontSize: 64 },
  featuredBadge: {
    position: "absolute", top: 12, left: 12,
    backgroundColor: "rgba(184,146,79,0.9)", borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  featuredTxt: { color: "#fff", fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  statusBadge: {
    position: "absolute", top: 12, right: 12,
    borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 5,
  },
  statusTxt: { fontSize: 12, fontWeight: "700" },

  priceSection: { padding: 20, paddingBottom: 0 },
  price: { fontSize: 28, fontWeight: "700", color: "#B8924F", marginBottom: 6 },
  title: { fontSize: 18, fontWeight: "700", color: "#E2E8F0", marginBottom: 6 },
  location: { fontSize: 13, color: "#64748B" },

  statsRow: {
    flexDirection: "row", gap: 0, marginHorizontal: 16, marginTop: 20,
    backgroundColor: "#1F2937", borderRadius: 12,
    borderWidth: 1, borderColor: "#374151", overflow: "hidden",
  },
  statBox: {
    flex: 1, alignItems: "center", paddingVertical: 14,
    borderRightWidth: 1, borderRightColor: "#374151",
  },
  statVal: { fontSize: 18, fontWeight: "700", color: "#E2E8F0" },
  statKey: { fontSize: 11, color: "#64748B", marginTop: 2 },

  section: { marginHorizontal: 16, marginTop: 24 },
  sectionTitle: {
    fontSize: 11, fontWeight: "700", color: "#64748B",
    letterSpacing: 1, textTransform: "uppercase", marginBottom: 12,
  },
  infoRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#374151",
  },
  infoKey: { fontSize: 13, color: "#64748B" },
  infoVal: { fontSize: 13, color: "#94A3B8", fontWeight: "500", textAlign: "right", flex: 1, marginLeft: 16 },

  addressTxt: { fontSize: 14, color: "#94A3B8", lineHeight: 22 },

  amenitiesWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  amenityChip: {
    backgroundColor: "#1F2937", borderRadius: 8,
    paddingHorizontal: 12, paddingVertical: 6,
    borderWidth: 1, borderColor: "#374151",
  },
  amenityTxt: { fontSize: 12, color: "#94A3B8" },

  mapBtn: {
    margin: 16, marginTop: 24, padding: 16, borderRadius: 12,
    backgroundColor: "rgba(59,130,246,0.1)", borderWidth: 1, borderColor: "rgba(59,130,246,0.3)",
    alignItems: "center",
  },
  mapBtnTxt: { color: "#3B82F6", fontWeight: "700", fontSize: 15 },
});
