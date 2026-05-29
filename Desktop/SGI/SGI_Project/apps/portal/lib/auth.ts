/**
 * SGI Portal — helpers auth client-side et server-side.
 */
"use client";

import { apiClient } from "./api";
import type {
  PublicRegisterRequest,
  RegisterResponse,
  UserRole,
} from "@sgi/shared-types";

export interface LoginResult {
  role: UserRole;
  redirect: string;
  language?: "ar" | "en" | "fr";
}

export async function login(
  email: string,
  password: string,
  companySlug?: string,
): Promise<LoginResult> {
  return apiClient<LoginResult>("/api/auth/login", {
    method: "POST",
    json: companySlug
      ? { email, password, company_slug: companySlug }
      : { email, password },
  });
}

export async function logout(): Promise<void> {
  await apiClient<void>("/api/auth/logout", { method: "POST" });
}

export async function register(
  kind: "client" | "fournisseur",
  body: PublicRegisterRequest,
): Promise<RegisterResponse> {
  return apiClient<RegisterResponse>(`/api/auth/register/${kind}`, {
    method: "POST",
    json: body,
  });
}
