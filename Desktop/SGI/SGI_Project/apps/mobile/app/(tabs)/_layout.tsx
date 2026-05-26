/**
 * Bottom tab navigation SGI Mobile.
 * 5 onglets : Dashboard · Properties · CRM · Clients · Profile
 */
import { Tabs } from "expo-router";
import { useTranslation } from "react-i18next";
import { View, Text } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function TabIcon({ name, focused }: { name: string; focused: boolean }) {
  const icons: Record<string, string> = {
    dashboard: "⊞", properties: "🏢", crm: "📊", clients: "👥", profile: "👤",
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

  return (
    <Tabs
      screenOptions={{
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
        tabBarLabelStyle: { fontSize: 10, fontWeight: "600", marginTop: -2 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t("nav_dashboard"),
          tabBarIcon: ({ focused }) => <TabIcon name="dashboard" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="properties"
        options={{
          title: t("nav_properties"),
          tabBarIcon: ({ focused }) => <TabIcon name="properties" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="crm"
        options={{
          title: t("nav_crm"),
          tabBarIcon: ({ focused }) => <TabIcon name="crm" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="clients"
        options={{
          title: t("nav_clients"),
          tabBarIcon: ({ focused }) => <TabIcon name="clients" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: t("nav_profile"),
          tabBarIcon: ({ focused }) => <TabIcon name="profile" focused={focused} />,
        }}
      />
    </Tabs>
  );
}
