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
  use_count?: number;
  max_uses?: number;
  expires_at?: string;
  created_at?: string;
  referrer_id?: string;
  referrer_name?: string;
  referrer_wechat_account?: string;
  referrer_phone?: string;
}

export interface GenerateCodeParams {
  stationId: number;
  codeType: string;
  count: number;
  maxUsage: number;
}

export const getReferralCodes = async (params?: any): Promise<{ list: ReferralCode[]; total: number }> => {
  const res = await axios.get('/api/admin/referral-codes/list', { params });
  // axios interceptor 返回 response.data，即 { code, data } 或直接数组
  // 后端返回格式：{ code: 0, data: { codes: [...], pagination: { total } } }
  // 或兼容格式：{ code: 0, data: [...] }
  const responseData = res.data || res;
  const codesArray = responseData.codes || responseData.data || responseData.list || [];
  const total = responseData.pagination?.total || (Array.isArray(codesArray) ? codesArray.length : 0);
  const data: ReferralCode[] = (Array.isArray(codesArray) ? codesArray : []).map((item: any) => ({
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
  }));
  return { list: data, total };
};

export const generateCodes = async (params: GenerateCodeParams): Promise<ReferralCode[]> => {
  const res = await axios.post('/api/admin/referral-codes/generate', params);
  return res.data || res || [];
};

export const exportCodes = async (): Promise<Blob> => {
  const response = await axios.get('/api/admin/referral-codes/export', { responseType: 'blob' });
  return response as unknown as Blob;
};

export const assignCode = async (params: any): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/assign', params);
  return res.data || res;
};

export const unbindCode = async (code: string): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/unbind', { code });
  return res.data || res;
};

export const deleteCode = async (code: string): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/delete', { code });
  return res.data || res;
};

export const updateCode = async (oldCode: string, newCode: string, codeType: string): Promise<any> => {
  const res = await axios.post('/api/admin/referral-codes/update-code', { oldCode, newCode, codeType });
  return res.data || res;
};

export const getInsight = async (code: string): Promise<any> => {
  const res = await axios.get(`/api/admin/referral-codes/${code}/insight`, {
    headers: { 'Cache-Control': 'no-cache' },
    params: { _t: Date.now() }
  });
  return res.data || res;
};
