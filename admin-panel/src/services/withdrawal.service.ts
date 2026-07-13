import axios from '../utils/axios.config';

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
  const res = await axios.get('/api/admin/withdrawals', { params });
  // 兼容两种后端响应格式：
  // 1) admin-finance: { code, message, data: { list: [...], pagination: { total } } }
  // 2) adminController: { code, message, data: { list: [...], total } }
  const payload = res.data || res;
  const list = Array.isArray(payload) ? payload : (payload.list || []);
  const total = payload.pagination?.total ?? payload.total ?? (Array.isArray(payload) ? payload.length : 0);
  return { list, total };
};

export const approveWithdrawal = async (id: number, approved: boolean): Promise<void> => {
  await axios.put(`/api/admin/withdrawals/${id}/approve`, { approved });
};

export const markWithdrawalPaid = async (id: number): Promise<void> => {
  await axios.put(`/api/admin/withdrawals/${id}/mark-paid`);
};
