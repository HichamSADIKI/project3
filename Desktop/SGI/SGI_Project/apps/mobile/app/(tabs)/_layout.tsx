/**
 * Bottom tab navigation SGI Mobile — adaptatif selon le rôle de l'utilisateur.
 *
 * - agent / manager / admin : tabs métier (dashboard, properties, crm, clients, profile).
 * - client                  : tabs client (dashboard, favorites, visits, messages, profile).
 * - partner                 : tabs partner (dashboard, submissions, leads, commissions, profile).
 */
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore, type ModuleKey } from "@/stores/preferences";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    dashboard: "⊞",
    properties: "🏢",
    crm: "📊",
    clients: "👥",
    favorites: "★",
    visits: "📅",
    messages: "✉",
    submissions: "📤",
    leads: "🎯",
    commissions: "💰",
    profile: "👤",
  };
  return (
    <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.45 }}>
      {icons[name] ?? "○"}
    </Text>
  );
}

export default function TabsLayout() {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role ?? "agent");
  const modules = usePreferencesStore((s) => s.modules);
  const enabled = (m: ModuleKey) => modules.includes(m);

  const screenOptions = {
    headerShown: false,
    tabBarStyle: {
      backgroundColor: "#1F2937",
      borderTopColor: "#374151",
      borderTopWidth: 1,
      height: 56 + insets.bottom,
      paddingBottom: insets.bottom,
    },
    tabBarActiveTintColor: "#B8924F",
    tabBarInactiveTintColor: "#64748B",
    tabBarLabelStyle: { fontSize: 10, fontWeight: "600" as const, marginTop: -2 },
  };

  if (role === "client") {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav_dashboard"),
            tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="favorites"
          options={{
            title: t("nav_favorites", "Favoris"),
            tabBarIcon: ({ focused }) => <TabIcon name="favorites" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="visits"
          options={{
            title: t("nav_visits", "Visites"),
            tabBarIcon: ({ focused }) => <TabIcon name="visits" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="messages"
          options={{
            title: t("nav_messages", "Messages"),
            tabBarIcon: ({ focused }) => <TabIcon name="messages" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("nav_profile"),
            tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          }}
        />
        <Tabs.Screen name="properties" options={{ href: null }} />
        <Tabs.Screen name="crm" options={{ href: null }} />
        <Tabs.Screen name="clients" options={{ href: null }} />
        <Tabs.Screen name="submissions" options={{ href: null }} />
        <Tabs.Screen name="leads" options={{ href: null }} />
        <Tabs.Screen name="commissions" options={{ href: null }} />
      </Tabs>
    );
  }

  if (role === "partner" || role === "fournisseur") {
    return (
      <Tabs screenOptions={screenOptions}>
        <Tabs.Screen
          name="index"
          options={{
            title: t("nav_dashboard"),
            tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="submissions"
          options={{
            title: t("nav_submissions", "Soumissions"),
            tabBarIcon: ({ focused }) => <TabIcon name="submissions" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="leads"
          options={{
            title: t("nav_leads", "Leads"),
            tabBarIcon: ({ focused }) => <TabIcon name="leads" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="commissions"
          options={{
            title: t("nav_commissions", "Commissions"),
            tabBarIcon: ({ focused }) => <TabIcon name="commissions" focused={focused} />,
          }}
        />
        <Tabs.Screen
          name="profile"
          options={{
            title: t("nav_profile"),
            tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          }}
        />
        <Tabs.Screen name="properties" options={{ href: null }} />
        <Tabs.Screen name="crm" options={{ href: null }} />
        <Tabs.Screen name="clients" options={{ href: null }} />
        <Tabs.Screen name="favorites" options={{ href: null }} />
        <Tabs.Screen name="visits" options={{ href: null }} />
        <Tabs.Screen name="messages" options={{ href: null }} />
      </Tabs>
    );
  }

  return (
    <Tabs screenOptions={screenOptions}>
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav_dashboard"),
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
          href: enabled("dashboard") ? "/(tabs)/" : null,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t("nav_properties"),
          tabBarIcon: ({ focused }) => <TabIcon name="properties" focused={focused} />,
          href: enabled("properties") ? "/(tabs)/properties" : null,
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: t("nav_crm"),
          tabBarIcon: ({ focused }) => <TabIcon name="crm" focused={focused} />,
          href: enabled("crm") ? "/(tabs)/crm" : null,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t("nav_clients"),
          tabBarIcon: ({ focused }) => <TabIcon name="clients" focused={focused} />,
          href: enabled("clients") ? "/(tabs)/clients" : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav_profile"),
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
          href: enabled("profile") ? "/(tabs)/profile" : null,
        }}
      />
      <Tabs.Screen name="favorites" options={{ href: null }} />
      <Tabs.Screen name="visits" options={{ href: null }} />
      <Tabs.Screen name="messages" options={{ href: null }} />
      <Tabs.Screen name="submissions" options={{ href: null }} />
      <Tabs.Screen name="leads" options={{ href: null }} />
      <Tabs.Screen name="commissions" options={{ href: null }} />
    </Tabs>
  );
}
