import axios from '../utils/axios.config';

export interface Partner {
  id: number;
  userId: number;
  userName: string;
  userPhone: string;
  stationId: number;
  stationName: string;
  status: number;
  totalEarnings: number;
  pendingEarnings: number;
  createdAt: string;
}

export interface PartnerEarning {
  id: number;
  partnerId: number;
  amount: number;
  type: number;
  relatedUserId: number;
  status: number;
  createdAt: string;
}

export interface PartnerListParams {
  page?: number;
  limit?: number;
  status?: number;
  stationId?: number;
}

export const getPartners = async (params: PartnerListParams): Promise<{ list: Partner[]; total: number }> => {
  const res = await axios.get('/api/admin/partners', { params });
  const data = res.data || [];
  return { list: data, total: data.length };
};

export const getPartnerDetail = async (id: number): Promise<Partner> => {
  const res = await axios.get(`/api/admin/partners/${id}`);
  return res.data;
};

export const approvePartner = async (id: number, approved: boolean): Promise<void> => {
  await axios.put(`/api/admin/partners/${id}/approve`, { approved });
};

export const getPartnerEarnings = async (id: number, params?: any): Promise<{ list: PartnerEarning[]; total: number }> => {
  const res = await axios.get(`/api/admin/partners/${id}/earnings`, { params });
  const data = res.data || [];
  return { list: data, total: data.length };
};
