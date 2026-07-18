import axios from '../utils/axios.config';

export interface VisitorLog {
  id: number;
  referrerCode: string;
  referrerId?: number;
  referrerName: string;
  referrerRole?: string;
  visitorOpenid: string;
  visitorNickname: string;
  visitorAvatar?: string;
  visitTime?: string;
  regStatus: string;
  createdAt?: string;
  updatedAt?: string;
}

/**
 * 管理后台：查询所有推荐官发展的访客日志（跨推荐官）
 * GET /api/admin/referral-codes/visitors
 * 兼容两种后端返回：S1 success({list,...}) 与 S2 {code:0, data:{list,...}}
 */
export const getVisitorLogs = async (params?: any): Promise<{ list: VisitorLog[]; total: number }> => {
  const res = await axios.get('/api/admin/referral-codes/visitors', { params });
  const response = res.data || res;
  const payload = response.data || response;
  const list: VisitorLog[] = Array.isArray(payload.list) ? payload.list : [];
  const total: number = payload.total || 0;
  return { list, total };
};
