import axios from '../utils/axios.config';

const API_BASE = '/v1/admin';

export const commissionService = {
  getList: async (params: { recipientId?: number; payType?: string; status?: string; page?: number; pageSize?: number }): Promise<any> => {
    return axios.get(`${API_BASE}/commissions`, { params });
  },

  getOrders: async (params: { type?: string; status?: string; page?: number; pageSize?: number; startDate?: string; endDate?: string }): Promise<any> => {
    return axios.get(`${API_BASE}/orders`, { params });
  },

  getArchives: async (params: { keyword?: string; scoreTier?: string; page?: number; pageSize?: number }): Promise<any> => {
    return axios.get(`${API_BASE}/archives`, { params });
  },

  getArchiveDetail: async (id: number): Promise<any> => {
    return axios.get(`${API_BASE}/archives/${id}`);
  },
};

export default commissionService;
