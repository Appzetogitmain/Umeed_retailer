import api from './config';

export interface CustomerProfile {
  id: string;
  name: string;
  phone: string;
  email: string;
  dateOfBirth?: string;
  registrationDate: string;
  status: string;
  refCode: string;
  walletAmount: number;
  totalOrders: number;
  totalSpent: number;
}

export interface GetProfileResponse {
  success: boolean;
  message: string;
  data: CustomerProfile;
}

export interface UpdateProfileData {
  name?: string;
  email?: string;
  dateOfBirth?: string;
}

export interface UpdateProfileResponse {
  success: boolean;
  message: string;
  data: CustomerProfile;
}

/**
 * Get customer profile
 */
export const getProfile = async (): Promise<GetProfileResponse> => {
  const response = await api.get<GetProfileResponse>('/customer/profile');
  return response.data;
};

/**
 * Update customer profile
 */
export const updateProfile = async (data: UpdateProfileData): Promise<UpdateProfileResponse> => {
  const response = await api.put<UpdateProfileResponse>('/customer/profile', data);
  return response.data;
};

/**
 * Delete customer account
 */
export const deleteAccount = async (phone: string, otp: string, sessionId: string): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete('/customer/profile', {
    data: { phone, otp, sessionId }
  });
  return response.data;
};

/**
 * Delete customer account directly without OTP verification
 */
export const deleteAccountDirect = async (): Promise<{ success: boolean; message: string }> => {
  const response = await api.delete('/customer/delete-account');
  return response.data;
};

