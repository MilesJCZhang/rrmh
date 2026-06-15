import axios from '../utils/axios.config';

// 生产 API 前缀：/api/admin
const API_BASE = '/api/admin';

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
    return axios.get(`${API_BASE}/earnings`, { params });
  },

  // 被动收益（生产无独立接口，复用 earnings）
  getPassiveEarnings: async (params: {
    page?: number;
    pageSize?: number;
    userId?: number;
    startDate?: string;
    endDate?: string;
  }): Promise<any> => {
    return axios.get(`${API_BASE}/earnings`, { params });
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
    return axios.get(`${API_BASE}/payments`, { params });
  },

  // 提现记录
  getWithdrawals: async (params: {
    page?: number;
    pageSize?: number;
    status?: string;
    keyword?: string;
  }): Promise<any> => {
    return axios.get(`${API_BASE}/withdrawals`, { params });
  },

  // 处理提现审核
  processWithdrawal: async (id: number, data: { status: string; remark?: string }): Promise<any> => {
    return axios.put(`${API_BASE}/withdrawals/${id}/process`, data);
  },

  // 财务统计汇总
  getSummary: async (): Promise<any> => {
    return axios.get(`${API_BASE}/finance-stats`);
  },
};

export default financeService;
