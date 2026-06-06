/**
 * SGI — Types utilisateur partagés (web / portal / mobile).
 * Source de vérité : apps/api/app/models/user.py
 */

export const USER_ROLES = ["admin", "manager", "agent", "client", "fournisseur"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ["active", "pending", "rejected", "suspended"] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  status: UserStatus;
  company_id: string;
}

/** Public roles (inscriptions libres autorisées). */
export const PUBLIC_ROLES: readonly UserRole[] = ["client", "fournisseur"] as const;

/** Roles internes (créés uniquement par admin). */
export const INTERNAL_ROLES: readonly UserRole[] = ["admin", "manager", "agent"] as const;

export function isPublicRole(role: string): role is "client" | "fournisseur" {
  return role === "client" || role === "fournisseur";
}

export function isInternalRole(role: string): role is "admin" | "manager" | "agent" {
  return role === "admin" || role === "manager" || role === "agent";
}
