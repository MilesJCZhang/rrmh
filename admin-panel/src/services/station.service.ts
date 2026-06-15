import axios from '../utils/axios.config';

// 生产 API 前缀：服务站在 /api/stations（无 /admin）
const API_BASE = '/api/stations';

export interface Station {
  id: number;
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
  status: number;
  partnerCount: number;
  createdAt: string;
}

export interface StationParams {
  name: string;
  address: string;
  contactName: string;
  contactPhone: string;
}

export const getStations = async (params?: any): Promise<{ list: Station[]; total: number }> => {
  const res = await axios.get(API_BASE, { params });
  const d = res.data?.data || res.data || res;
  const items = d.items || d.list || d || [];
  const total = typeof d.total === 'number' ? d.total : Array.isArray(items) ? items.length : 0;
  return { list: Array.isArray(items) ? items : [], total };
};

export const createStation = async (params: StationParams): Promise<Station> => {
  const res = await axios.post(API_BASE, params);
  return (res.data?.data || res.data || res) as Station;
};

export const updateStation = async (id: number, params: Partial<StationParams>): Promise<Station> => {
  const res = await axios.put(`${API_BASE}/${id}`, params);
  return (res.data?.data || res.data || res) as Station;
};

export const deleteStation = async (id: number): Promise<void> => {
  await axios.delete(`${API_BASE}/${id}`);
};
