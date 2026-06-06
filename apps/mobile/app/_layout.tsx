/**
 * Root layout — charge i18n, QueryClient, auth guard, thème sombre.
 */
import "../lib/i18n";
import { useEffect } from "react";
import { View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { useAuthStore } from "@/stores/auth";
import { usePreferencesStore } from "@/stores/preferences";
import { loadSavedLanguage } from "@/lib/i18n";
import { SessionWarningModal } from "@/components/ui/SessionWarningModal";
import { useInactivityTimeout } from "@/hooks/useInactivityTimeout";

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 2, staleTime: 30_000 },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, loadToken } = useAuthStore();
  const hydratePrefs = usePreferencesStore((s) => s.hydrate);
  const segments = useSegments();
  const router = useRouter();
  const reportActivity = useInactivityTimeout();

  useEffect(() => {
    Promise.all([loadToken(), hydratePrefs()]).finally(() => SplashScreen.hideAsync());
  }, []);

  useEffect(() => {
    const inAuth = segments[0] === "(auth)";
    if (!token && !inAuth) {
      router.replace("/(auth)/login");
    } else if (token && inAuth) {
      router.replace("/(tabs)");
    }
  }, [token, segments]);

  return (
    <View
      style={{ flex: 1 }}
      onStartShouldSetResponderCapture={() => {
        reportActivity();
        return false;
      }}
      onMoveShouldSetResponderCapture={() => {
        reportActivity();
        return false;
      }}
    >
      {children}
    </View>
  );
}

export default function RootLayout() {
  useEffect(() => {
    loadSavedLanguage();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" backgroundColor="#161B22" />
        <AuthGuard>
          <Stack screenOptions={{ headerShown: false, animation: "fade" }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen
              name="properties/[id]"
              options={{ headerShown: true, headerStyle: { backgroundColor: "#1F2937" }, headerTintColor: "#E2E8F0", title: "" }}
            />
            <Stack.Screen
              name="clients/[id]"
              options={{ headerShown: true, headerStyle: { backgroundColor: "#1F2937" }, headerTintColor: "#E2E8F0", title: "" }}
            />
            <Stack.Screen
              name="crm/[id]"
              options={{ headerShown: true, headerStyle: { backgroundColor: "#1F2937" }, headerTintColor: "#E2E8F0", title: "" }}
            />
          </Stack>
          <SessionWarningModal />
        </AuthGuard>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
