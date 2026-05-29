import type { User, UserRole, UserStatus } from "./user";

export interface JwtPayload {
  sub: string;
  company_id: string;
  role: UserRole;
  status: UserStatus;
  email: string;
  exp: number;
  iat: number;
}

export interface AuthSession {
  token: string;
  user: User;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface PublicRegisterRequest {
  email: string;
  password: string;
  full_name: string;
  company_slug: string;
}

export interface RegisterResponse {
  user_id: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  message: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
}

/** Route par défaut selon le rôle (utilisé pour redirect post-login). */
export const DEFAULT_HOME_BY_ROLE: Record<UserRole, string> = {
  admin: "/dashboard",
  manager: "/dashboard",
  agent: "/dashboard",
  client: "/client",
  fournisseur: "/fournisseur",
};
