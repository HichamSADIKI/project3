/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)/login` | `/(tabs)` | `/(tabs)/` | `/(tabs)/agenda` | `/(tabs)/clients` | `/(tabs)/commissions` | `/(tabs)/crm` | `/(tabs)/dashboard-client` | `/(tabs)/dashboard-fournisseur` | `/(tabs)/favorites` | `/(tabs)/leads` | `/(tabs)/messages` | `/(tabs)/profile` | `/(tabs)/properties` | `/(tabs)/submissions` | `/(tabs)/visits` | `/_sitemap` | `/agenda` | `/clients` | `/commissions` | `/crm` | `/dashboard-client` | `/dashboard-fournisseur` | `/favorites` | `/leads` | `/login` | `/messages` | `/profile` | `/properties` | `/submissions` | `/visits`;
      DynamicRoutes: `/clients/${Router.SingleRoutePart<T>}` | `/crm/${Router.SingleRoutePart<T>}` | `/properties/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/clients/[id]` | `/crm/[id]` | `/properties/[id]`;
    }
  }
}
