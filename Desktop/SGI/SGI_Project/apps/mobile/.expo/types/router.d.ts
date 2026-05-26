/* eslint-disable */
import * as Router from 'expo-router';

export * from 'expo-router';

declare module 'expo-router' {
  export namespace ExpoRouter {
    export interface __routes<T extends string = string> extends Record<string, unknown> {
      StaticRoutes: `/` | `/(auth)/login` | `/(tabs)` | `/(tabs)/` | `/(tabs)/clients` | `/(tabs)/crm` | `/(tabs)/profile` | `/(tabs)/properties` | `/_sitemap` | `/clients` | `/crm` | `/login` | `/profile` | `/properties`;
      DynamicRoutes: `/clients/${Router.SingleRoutePart<T>}` | `/crm/${Router.SingleRoutePart<T>}` | `/properties/${Router.SingleRoutePart<T>}`;
      DynamicRouteTemplate: `/clients/[id]` | `/crm/[id]` | `/properties/[id]`;
    }
  }
}
