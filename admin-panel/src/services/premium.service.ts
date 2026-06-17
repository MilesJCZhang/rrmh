import axios from '../utils/axios.config';

const API_BASE = '/v1/admin';

export const premiumService = {
  getVerifications: async (params: { status?: string; page?: number; pageSize?: number }): Promise<any> => {
    return axios.get(`${API_BASE}/premium-verifications`, { params });
  },

  reviewVerification: async (id: number, action: 'approve' | 'reject', rejectReason?: string): Promise<any> => {
    return axios.put(`${API_BASE}/premium-verifications/${id}`, { action, rejectReason });
  },

  getCustodyList: async (params: { status?: string; page?: number; pageSize?: number }): Promise<any> => {
    return axios.get(`${API_BASE}/fund-custody`, { params });
  },

  settleCustody: async (id: number, settleType: 'marriage' | 'refund'): Promise<any> => {
    return axios.put(`${API_BASE}/fund-custody/${id}`, { settleType });
  },
};

export default premiumService;
