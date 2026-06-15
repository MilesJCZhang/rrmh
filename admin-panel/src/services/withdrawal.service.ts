import axios from '../utils/axios.config';

// 生产 API 前缀
const API_BASE = '/api/admin';

export interface Withdrawal {
  id: number;
  userId: number;
  userName: string;
  userPhone: string;
  amount: number;
  status: number;
  accountInfo: string;
  remark: string;
  processedAt?: string;
  createdAt: string;
}

export interface WithdrawalListParams {
  page?: number;
  limit?: number;
  status?: number;
}

export const getWithdrawals = async (params: WithdrawalListParams): Promise<{ list: Withdrawal[]; total: number }> => {
  const res = await axios.get(`${API_BASE}/withdrawals`, { params });
  const d = res.data?.data || res.data || res;
  const items = d.items || d.list || d || [];
  const total = typeof d.total === 'number' ? d.total : Array.isArray(items) ? items.length : 0;
  return { list: Array.isArray(items) ? items : [], total };
};

export const approveWithdrawal = async (id: number, approved: boolean): Promise<void> => {
  await axios.put(`${API_BASE}/withdrawals/${id}/process`, { approved });
};

export const markWithdrawalPaid = async (id: number): Promise<void> => {
  await axios.put(`${API_BASE}/withdrawals/${id}/process`, { action: 'mark-paid' });
};
