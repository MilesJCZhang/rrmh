import axios from '../utils/axios.config';

export interface Order {
  id: number;
  user_id: number;
  type: string;
  status: string;
  total_fee: number;
  payer_nickname: string;
  payer_avatar: string;
  created_at: string;
}

export interface OrderListParams {
  type?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
  page?: number;
  pageSize?: number;
}

export interface TypeStats {
  type: string;
  count: number;
  total_amount: number;
}

export interface OrderListResult {
  list: Order[];
  total: number;
  page: number;
  pageSize: number;
  typeStats: TypeStats[];
}

export const getOrders = async (params: OrderListParams): Promise<OrderListResult> => {
  const res = await axios.get('/api/admin/orders', { params });
  return res.data || { list: [], total: 0, page: 1, pageSize: 20, typeStats: [] };
};
