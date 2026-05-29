/**
 * Client API SGI — axios avec intercepteurs auth + tenant.
 * Injecte automatiquement le JWT depuis le secure store.
 */
import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";
import * as SecureStore from "expo-secure-store";

const API_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:8000/api/v1";

export const api = axios.create({
  baseURL: API_URL,
  timeout: 15_000,
  headers: { "Content-Type": "application/json" },
});

// Injecte le Bearer token sur chaque requête
api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  const token = await SecureStore.getItemAsync("sgi_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Logout automatique sur 401
api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync("sgi_token");
      // Le router Expo redirigera vers /login via le guard auth
    }
    return Promise.reject(error);
  }
);

// ─── Types de réponse standard ───────────────────────────────────────────────

export interface ApiList<T> {
  success: boolean;
  data: T[];
  meta: { total: number; page: number; limit: number; pages: number };
}

export interface ApiDetail<T> {
  success: boolean;
  data: T;
}

// ─── Endpoints Properties ─────────────────────────────────────────────────────

export interface Property {
  id: string;
  reference: string;
  type: string;
  title_en: string | null;
  title_ar: string | null;
  title_fr: string | null;
  price: number;
  area_sqm: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  latitude: number | null;
  longitude: number | null;
  address_en: string | null;
  address_ar: string | null;
  district: string | null;
  city: string;
  developer: string | null;
  furnished: boolean;
  parking_spaces: number;
  amenities: string[];
  images: string[];
  is_featured: boolean;
  views_count: number;
  created_at: string;
}

export const propertiesApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiList<Property>>("/properties/", { params }),
  get: (id: string) => api.get<ApiDetail<Property>>(`/properties/${id}`),
  create: (data: unknown) => api.post<ApiDetail<Property>>("/properties/", data),
  update: (id: string, data: unknown) => api.patch<ApiDetail<Property>>(`/properties/${id}`, data),
  delete: (id: string) => api.delete(`/properties/${id}`),
  searchRadius: (data: { latitude: number; longitude: number; radius_m: number }) =>
    api.post<{ success: boolean; data: (Property & { dist_m: number })[] }>("/properties/search/radius", data),
};

// ─── Endpoints CRM ───────────────────────────────────────────────────────────

export interface Lead {
  id: string;
  client_id: string;
  agent_id: string | null;
  status: string;
  source: string | null;
  budget: number | null;
  property_type: string | null;
  golden_visa_eligible: boolean;
  score: number;
  contact_attempts: number;
  last_contact_at: string | null;
  next_action_at: string | null;
  next_action_type: string | null;
  lost_reason: string | null;
  notes: string | null;
  created_at: string;
}

export const crmApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiList<Lead>>("/crm/leads", { params }),
  get: (id: string) => api.get<ApiDetail<Lead>>(`/crm/leads/${id}`),
  create: (data: unknown) => api.post<ApiDetail<Lead>>("/crm/leads", data),
  updateStatus: (id: string, data: { status: string; reason?: string }) =>
    api.post<ApiDetail<Lead>>(`/crm/leads/${id}/status`, data),
  pipeline: () => api.get<{ success: boolean; data: Record<string, number> }>("/crm/pipeline"),
  addActivity: (leadId: string, data: unknown) =>
    api.post(`/crm/leads/${leadId}/activities`, data),
  activities: (leadId: string) =>
    api.get(`/crm/leads/${leadId}/activities`),
};

// ─── Endpoints Clients ────────────────────────────────────────────────────────

export interface Client {
  id: string;
  type: "individual" | "company";
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  budget_min: number | null;
  budget_max: number | null;
  preferred_property_type: string | null;
  source: string | null;
  created_at: string;
}

export const clientsApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiList<Client>>("/clients/", { params }),
  get: (id: string) => api.get<ApiDetail<Client>>(`/clients/${id}`),
  create: (data: unknown) => api.post<ApiDetail<Client>>("/clients/", data),
  update: (id: string, data: unknown) => api.patch<ApiDetail<Client>>(`/clients/${id}`, data),
};

// ─── Endpoints Golden Visa ────────────────────────────────────────────────────

export interface GoldenVisa {
  id: string;
  client_id: string;
  property_id: string | null;
  status: string;
  application_number: string | null;
  visa_expiry_date: string | null;
  alert_90_sent: boolean;
  alert_30_sent: boolean;
  created_at: string;
}

export const goldenVisaApi = {
  list: (params?: Record<string, unknown>) =>
    api.get<ApiList<GoldenVisa>>("/golden-visa/", { params }),
  get: (id: string) => api.get<ApiDetail<GoldenVisa>>(`/golden-visa/${id}`),
};

// ─── Endpoints Finance ────────────────────────────────────────────────────────

export const financeApi = {
  summary: () => api.get("/finance/summary"),
  transactions: (params?: Record<string, unknown>) =>
    api.get("/finance/transactions", { params }),
};

// ─── Auth ─────────────────────────────────────────────────────────────────────

export type SocialProvider =
  | "google" | "apple" | "facebook" | "microsoft"
  | "instagram" | "snapchat" | "whatsapp" | "telegram";

export interface SocialLoginPayload {
  provider: SocialProvider;
  id_token?: string;
  access_token?: string;
  code?: string;
}

export const authApi = {
  login: (email: string, password: string) =>
    api.post<{ access_token: string; expires_in: number }>("/auth/login", { email, password }),
  me: () => api.get("/auth/me"),
  social: (payload: SocialLoginPayload) =>
    api.post<{ access_token: string; expires_in: number }>("/auth/social", payload),
  registerClient: (body: { email: string; password: string; full_name: string; company_slug: string }) =>
    api.post("/auth/register/client", body),
  registerPartner: (body: { email: string; password: string; full_name: string; company_slug: string }) =>
    api.post("/auth/register/partner", body),
};

// ─── Endpoints Client portal ─────────────────────────────────────────────────

export interface ClientDashboard {
  favorites_count: number;
  active_contracts: number;
  upcoming_payments: number;
  pending_visits: number;
  unread_messages: number;
}

export interface Favorite {
  id: string;
  property_id: string;
  created_at: string;
}

export interface VisitRequest {
  id: string;
  property_id: string;
  preferred_date: string;
  preferred_time_slot: string | null;
  status: string;
  client_notes: string | null;
  agent_notes: string | null;
  created_at: string;
}

export interface ClientMessage {
  id: string;
  sender_user_id: string;
  recipient_user_id: string;
  subject: string | null;
  body: string;
  related_property_id: string | null;
  related_contract_id: string | null;
  read_at: string | null;
  created_at: string;
}

export const clientPortalApi = {
  dashboard: () => api.get<ClientDashboard>("/client/dashboard"),
  favorites: () => api.get<Favorite[]>("/client/favorites"),
  addFavorite: (property_id: string) =>
    api.post<Favorite>("/client/favorites", { property_id }),
  removeFavorite: (id: string) => api.delete(`/client/favorites/${id}`),
  visits: () => api.get<VisitRequest[]>("/client/visits"),
  createVisit: (body: {
    property_id: string;
    preferred_date: string;
    preferred_time_slot?: string | null;
    client_notes?: string | null;
  }) => api.post<VisitRequest>("/client/visits", body),
  messages: () => api.get<ClientMessage[]>("/client/messages"),
  sendMessage: (body: {
    recipient_user_id: string;
    subject?: string | null;
    body: string;
    related_property_id?: string | null;
    related_contract_id?: string | null;
  }) => api.post<ClientMessage>("/client/messages", body),
  markMessageRead: (id: string) => api.post(`/client/messages/${id}/read`),
};

// ─── Endpoints Partner ───────────────────────────────────────────────────────

export interface PartnerDashboard {
  active_mandates: number;
  pending_submissions: number;
  active_leads: number;
  converted_leads: number;
  commissions_pending_aed: string;
  commissions_paid_aed: string;
  active_services: number;
}

export interface PropertySubmission {
  id: string;
  title: string;
  type: string;
  district: string | null;
  city: string;
  asking_price: string;
  area_sqm: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  status: string;
  review_notes: string | null;
  converted_property_id: string | null;
  created_at: string;
}

export interface PartnerLead {
  id: string;
  prospect_first_name: string;
  prospect_last_name: string | null;
  prospect_email: string | null;
  prospect_phone: string;
  interest_type: string;
  budget_aed: string | null;
  status: string;
  commission_rate: string | null;
  created_at: string;
}

export interface PartnerCommission {
  id: string;
  source_type: string;
  source_id: string;
  base_amount_aed: string;
  commission_rate: string;
  commission_amount_aed: string;
  status: string;
  paid_at: string | null;
  created_at: string;
}

export interface PartnerService {
  id: string;
  service_type: string;
  title: string;
  description: string | null;
  fee_aed: string | null;
  is_active: boolean;
  created_at: string;
}

export const partnerApi = {
  dashboard: () => api.get<PartnerDashboard>("/fournisseur/dashboard"),
  submissions: () => api.get<PropertySubmission[]>("/fournisseur/submissions"),
  createSubmission: (body: unknown) =>
    api.post<PropertySubmission>("/fournisseur/submissions", body),
  leads: () => api.get<PartnerLead[]>("/fournisseur/leads"),
  createLead: (body: unknown) => api.post<PartnerLead>("/fournisseur/leads", body),
  commissions: () => api.get<PartnerCommission[]>("/fournisseur/commissions"),
  services: () => api.get<PartnerService[]>("/fournisseur/services"),
  createService: (body: unknown) => api.post<PartnerService>("/fournisseur/services", body),
  updateService: (id: string, body: unknown) =>
    api.patch<PartnerService>(`/partner/services/${id}`, body),
};
