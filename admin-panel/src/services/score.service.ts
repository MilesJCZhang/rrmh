import axios from '../utils/axios.config';

const API_BASE = '/api/admin';

export const scoreService = {
  getRules: async (): Promise<any> => {
    return axios.get(`${API_BASE}/score/rules`);
  },

  updateRule: async (id: number, data: { max_score?: number; status?: string; field_label?: string }): Promise<any> => {
    return axios.put(`${API_BASE}/score/rules/${id}`, data);
  },

  toggleRule: async (id: number): Promise<any> => {
    return axios.post(`${API_BASE}/score/rules/${id}/toggle`, {});
  },

  getOverview: async (): Promise<any> => {
    const res = await axios.get(`${API_BASE}/score/overview`);
    // axios interceptor 返回 response.data，即 { code, data }
    return res;
  },

  recalculateAll: async (): Promise<any> => {
    return axios.post(`${API_BASE}/score/recalculate-all`, {});
  },
};

export default scoreService;
