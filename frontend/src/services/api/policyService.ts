import api from "./config";
import { ApiResponse } from "./admin/types";
import { Policy } from "./admin/adminPolicyService";

export const getPolicyByType = async (type: string): Promise<ApiResponse<Policy>> => {
  const response = await api.get<ApiResponse<Policy>>(`/policies/${type}`);
  return response.data;
};

export const getAllPolicies = async (): Promise<ApiResponse<Policy[]>> => {
  const response = await api.get<ApiResponse<Policy[]>>("/policies");
  return response.data;
};

export interface PublicSettings {
  appName: string;
  contactEmail: string;
  contactPhone: string;
  supportEmail?: string;
  supportPhone?: string;
}

export const getPublicSettings = async (): Promise<ApiResponse<PublicSettings>> => {
  const response = await api.get<ApiResponse<PublicSettings>>("/policies/settings");
  return response.data;
};
