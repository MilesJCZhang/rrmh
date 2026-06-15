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
  const res = await axios.get('/admin-api/commissions', { params });
  // axios interceptor 返回 response.data，即 { code, data }
  const d = res.data || res;
  return { list: d.list || [], total: d.total || 0, page: d.page || 1, pageSize: d.pageSize || 20, typeStats: d.typeStats || [] };
};
