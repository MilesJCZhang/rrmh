import axios from '../utils/axios.config';

// 生产 API 前缀
const API_BASE = '/api/admin/verifications';

export interface Verification {
  id: number;
  user_id: number;
  user_nickname?: string;
  user_phone?: string;
  user_avatar?: string;
  real_name?: string;
  id_card?: string;
  verify_type: 'online' | 'offline';
  id_card_front?: string;
  id_card_back?: string;
  face_image?: string;
  status: 'pending' | 'approved' | 'rejected' | 'none';
  reject_reason?: string;
  reviewed_at?: string;
  reviewed_by?: number;
  created_at: string;
}

export interface VerificationStats {
  total: number;
  pending: number;
  approved: number;
  rejected: number;
}

export interface VerificationListParams {
  page?: number;
  pageSize?: number;
  status?: string;
}

// 获取认证统计
export const getVerificationStats = async (): Promise<VerificationStats> => {
  const res = await axios.get(`${API_BASE}/stats`);
  return res.data?.data || res.data || { total: 0, pending: 0, approved: 0, rejected: 0 };
};

// 获取认证列表
export const getVerifications = async (params: VerificationListParams = {}): Promise<{ list: Verification[]; total: number }> => {
  const res = await axios.get(API_BASE, { params });
  const d = res.data?.data || res.data || res;
  const items = d.items || d.list || d || [];
  const total = typeof d.total === 'number' ? d.total : Array.isArray(items) ? items.length : 0;
  return { list: Array.isArray(items) ? items : [], total };
};

// 获取认证详情
export const getVerificationDetail = async (userId: number): Promise<Verification> => {
  const res = await axios.get(`${API_BASE}/${userId}`);
  return res.data?.data || res.data;
};

// 审核认证
export const reviewVerification = async (
  userId: number,
  status: 'approved' | 'rejected',
  remark?: string
): Promise<void> => {
  await axios.put(`${API_BASE}/${userId}/review`, { status, remark });
};

export default {
  getVerificationStats,
  getVerifications,
  getVerificationDetail,
  reviewVerification,
};
