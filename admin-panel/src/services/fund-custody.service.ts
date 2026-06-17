import axios from '../utils/axios.config';

export interface FundCustody {
  id: number;
  user_id: number;
  nickname: string;
  avatar_url: string;
  phone: string;
  amount: number;
  service_fee: number;
  service_fee_deducted: number;
  refund_amount: number;
  status: string;
  settle_type: string;
  settled_at: string;
  created_at: string;
}

export interface FundCustodyStats {
  total_count: number;
  total_amount: number;
  active_amount: number;
  settled_amount: number;
}

export interface FundCustodyListParams {
  status?: string;
  page?: number;
  pageSize?: number;
}

export interface FundCustodyListResult {
  list: FundCustody[];
  total: number;
  page: number;
  pageSize: number;
  stats: FundCustodyStats;
}

const API_BASE = '/v1/admin';

export const getFundCustodyList = async (params: FundCustodyListParams): Promise<FundCustodyListResult> => {
  const res = await axios.get(`${API_BASE}/fund-custody`, { params });
  return res.data || { list: [], total: 0, page: 1, pageSize: 20, stats: {} };
};

export const settleFundCustody = async (id: number, settleType: 'marriage' | 'refund'): Promise<{ refundAmount: number; serviceFee: number }> => {
  const res = await axios.put(`${API_BASE}/fund-custody/${id}`, { settleType });
  return res.data || { refundAmount: 0, serviceFee: 0 };
};
