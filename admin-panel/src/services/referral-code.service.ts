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
  count: number;
  maxUsage: number;
}

export const getReferralCodes = async (params?: any): Promise<{ list: ReferralCode[]; total: number }> => {
  const res = await axios.get('/api/admin/referral-codes/list', { params });
  const rawData: any[] = res.data || [];
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
  }));
  return { list: data, total: data.length };
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
