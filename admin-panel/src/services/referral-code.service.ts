import axios from '../utils/axios.config';

export interface ReferralCode {
  id: number;
  code: string;
  stationId?: number;
  stationName?: string;
  usedCount: number;
  maxUsage: number;
  status: string;
  referrerName?: string;
  createdAt: string;
  code_type?: string;
  type_name?: string;
  user_role?: string;
  use_count?: number;
  useCount?: number;
  max_uses?: number;
  maxUses?: number;
  expires_at?: string;
  created_at?: string;
  referrer_id?: string;
  referrerId?: string;
  referrer_name?: string;
  referrer_wechat_account?: string;
  referrer_phone?: string;
  parent_referrer_name?: string;
  parent_referrer_code?: string;
}

export interface GenerateCodeParams {
  stationId: number;
  count: number;
  maxUsage: number;
}

/**
 * 获取推荐码统计（按类型分组）
 */
export const getReferralCodeStats = async (params?: any): Promise<Record<string, number>> => {
  const res = await axios.get('/api/admin/referral-codes/stats', { params });
  const response = res.data || res;
  return response.data || response || {};
};

export const getReferralCodes = async (params?: any): Promise<{ list: ReferralCode[]; total: number }> => {
  const res = await axios.get('/api/admin/referral-codes/list', { params });
  console.log('[getReferralCodes] 完整响应:', res);
  console.log('[getReferralCodes] 响应数据:', res.data);
  
  const response = res.data || res;
  const apiData = response.data || response;
  console.log('[getReferralCodes] apiData:', apiData);
  
  // 兼容两种后端返回格式：
  // 格式1: {code: 0, data: {codes: [...], pagination: {total: N}}}
  // 格式2: {code: 200, data: [...]} (当前后端实际格式)
  let rawData: any[];
  let total: number;
  
  if (Array.isArray(apiData)) {
    // 格式2: data 直接是数组
    rawData = apiData;
    total = apiData.length;
  } else if (apiData && Array.isArray(apiData.codes)) {
    // 格式1: data 包含 codes 和 pagination
    rawData = apiData.codes;
    total = apiData.pagination?.total ?? apiData.codes.length;
  } else {
    rawData = [];
    total = 0;
  }
  
  console.log('[getReferralCodes] rawData:', rawData);
  
  const data: ReferralCode[] = rawData.map((item: any) => ({
    id: item.id,
    code: item.code,
    status: item.status,
    usedCount: item.useCount ?? item.use_count ?? item.usedCount ?? 0,
    maxUsage: item.maxUses ?? item.max_uses ?? item.maxUsage ?? 0,
    referrerName: item.referrer_name || item.referrerName || '',
    createdAt: item.created_at || item.createdAt || '',
    code_type: item.codeType || item.code_type,
    type_name: item.type_name,
    expires_at: item.expires_at,
    referrer_id: item.referrer_id,
    referrer_wechat_account: item.referrer_wechat_account,
    referrer_phone: item.referrer_phone,
    parent_referrer_name: item.parent_referrer_name,
    parent_referrer_code: item.parent_referrer_code,
    user_role: item.user_role,
  }));
  return { list: data, total };
};

export const generateCodes = async (params: GenerateCodeParams): Promise<ReferralCode[]> => {
  const res = await axios.post('/api/admin/referral-codes/generate', params);
  return res.data || [];
};

export const exportCodes = async (): Promise<Blob> => {
  const response = await axios.get('/api/admin/referral-codes/export', { responseType: 'blob' });
  return response as unknown as Blob;
};

export const assignCode = async (params: any): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/assign', params);
  return res.data;
};

export const unbindCode = async (code: string): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/unbind', { code });
  return res.data;
};

export const deleteCode = async (code: string): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/delete', { code });
  return res.data;
};

export const getInsight = async (code: string): Promise<any> => {
  const res = await axios.get(`/api/admin/referral-codes/insight/${code}`, {
    headers: { 'Cache-Control': 'no-cache' },
    params: { _t: Date.now() } // 添加时间戳防止缓存
  });
  return res.data;
};

// 双码互绑：通过两个推荐码建立推荐关系
export const bindCodes = async (params: { referrer_code: string; referred_code: string; remark?: string }): Promise<any> => {
  // 后端使用 Prisma，期望驼峰命名
  const res = await axios.post('/api/admin/referral-codes/bind', {
    referrerCode: params.referrer_code,
    referredCode: params.referred_code,
    remark: params.remark || undefined,
  });
  return res.data;
};
