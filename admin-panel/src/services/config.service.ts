import axios from '../utils/axios.config';

const API_BASE = '/v1/admin';

export const configService = {
  getConfig: async (): Promise<any> => {
    return axios.get(`${API_BASE}/config/map`);
  },

  updateConfig: async (data: Record<string, string>): Promise<any> => {
    return axios.put(`${API_BASE}/config`, data);
  },
};

export default configService;
