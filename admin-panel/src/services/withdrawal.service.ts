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
  const data = res.data || [];
  return { list: data, total: data.length };
};

export const approveWithdrawal = async (id: number, approved: boolean): Promise<void> => {
  await axios.put(`/api/admin/withdrawals/${id}/approve`, { approved });
};

export const markWithdrawalPaid = async (id: number): Promise<void> => {
  await axios.put(`/api/admin/withdrawals/${id}/mark-paid`);
};
