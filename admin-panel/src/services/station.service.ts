import axios from '../utils/axios.config';

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
  const res = await axios.get('/api/admin/stations', { params });
  const data = res.data || [];
  return { list: data, total: data.length };
};

export const createStation = async (params: StationParams): Promise<Station> => {
  const res = await axios.post('/api/admin/stations', params);
  return res.data;
};

export const updateStation = async (id: number, params: Partial<StationParams>): Promise<Station> => {
  const res = await axios.put(`/api/admin/stations/${id}`, params);
  return res.data;
};

export const deleteStation = async (id: number): Promise<void> => {
  await axios.delete(`/api/admin/stations/${id}`);
};
