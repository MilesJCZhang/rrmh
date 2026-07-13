import axios from '../utils/axios.config';

// 生产 API 前缀：/api/admin
const API_BASE = '/api/admin';

// 安全提取响应数据
function extractData<T = any>(res: any, fallback: T): T {
  const payload = res?.data || res;
  return payload ?? fallback;
}

export const financeService = {
  // 收益明细
  getEarnings: async (params: {
    page?: number;
    pageSize?: number;
    userId?: number;
    type?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const res = await axios.get(`${API_BASE}/earnings`, { params });
    return extractData(res, { list: [], total: 0, page: 1, pageSize: 20 });
  },

  // 被动收益（生产无独立接口，复用 earnings）
  getPassiveEarnings: async (params: {
    page?: number;
    pageSize?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const res = await axios.get(`${API_BASE}/earnings`, { params });
    return extractData(res, { list: [], total: 0, page: 1, pageSize: 20 });
  },

  // 支付记录
  getPayments: async (params: {
    page?: number;
    pageSize?: number;
    userId?: number;
    status?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    const res = await axios.get(`${API_BASE}/payments`, { params });
    return extractData(res, { list: [], total: 0, page: 1, pageSize: 20 });
  },

  // 提现记录
  getWithdrawals: async (params: {
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }): Promise<any> => {
    const res = await axios.get(`${API_BASE}/withdrawals`, { params });
    return extractData(res, { list: [], total: 0, page: 1, pageSize: 20 });
  },

  // 处理提现审核
  processWithdrawal: async (id: number, data: { status: string; remark?: string }): Promise<any> => {
    const res = await axios.put(`${API_BASE}/withdrawals/${id}/process`, data);
    return res?.data ?? res;
  },

  // 财务统计汇总
  getSummary: async (): Promise<any> => {
    const res = await axios.get(`${API_BASE}/finance-stats`);
    return extractData(res, {});
  },
};

export default financeService;
