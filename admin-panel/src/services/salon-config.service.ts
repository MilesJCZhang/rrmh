import axios from '../utils/axios.config';

/**
 * 沙龙配置接口
 */
export interface SalonConfig {
  id?: number;
  type: string;  // 'mixed' | 'male_salon' | 'female_salon'
  name: string;
  description: string;
  emoji: string;
  
  // 主题配置
  theme: {
    color: string;
    lightColor: string;
    gradient: string;
    bannerBg: string;
    icon: string;
  };
  
  // 页面配置
  page: {
    list: string;
    detail: string;
    create: string;
  };
  
  // 功能配置
  features: {
    totalCap: number;
    maxRecommenders: number;
    maxPerGender: number;
    showScoreFilter: boolean;
    allowCompanion: boolean;
    maxCompanions: number;
    requireProfile: boolean;
    allowWalkIn: boolean;
    maxPerWeek: number;
  };
  
  // 报名配置
  registration: {
    needPayment: boolean;
    defaultFee: number;
    needProfile: boolean;
    allowCompanion: boolean;
    companionFields: string[];
  };
  
  // 权限配置
  permissions: {
    creatorRoles: string[];
    participantRoles: string[];
    genderLimit: 'none' | 'male_only' | 'female_only';
    minAge: number;
    maxAge: number;
    minScore: number;
  };
  
  // 收益配置
  commission: {
    referrer: number;
    platform: number;
    matchmaker: number;
  };
  
  // API配置
  api: {
    list: string;
    detail: string;
    register: string;
    create: string;
    update: string;
    cancel: string;
    approve: string;
  };
  
  // 状态
  status: 'active' | 'inactive';
  created_at?: string;
  updated_at?: string;
}

/**
 * 获取所有沙龙配置
 */
export const getSalonConfigs = async (): Promise<SalonConfig[]> => {
  const response = await axios.get('/api/admin/salon-configs');
  return response.data || [];
};

/**
 * 获取单个沙龙配置
 */
export const getSalonConfig = async (type: string): Promise<SalonConfig> => {
  const response = await axios.get(`/api/admin/salon-configs/${type}`);
  return response.data;
};

/**
 * 创建或更新沙龙配置
 */
export const saveSalonConfig = async (config: SalonConfig): Promise<SalonConfig> => {
  if (config.id) {
    // 更新
    const response = await axios.put(`/api/admin/salon-configs/${config.type}`, config);
    return response.data;
  } else {
    // 创建
    const response = await axios.post('/api/admin/salon-configs', config);
    return response.data;
  }
};

/**
 * 删除沙龙配置
 */
export const deleteSalonConfig = async (type: string): Promise<void> => {
  await axios.delete(`/api/admin/salon-configs/${type}`);
};

/**
 * 启用/禁用沙龙配置
 */
export const toggleSalonConfigStatus = async (type: string, status: 'active' | 'inactive'): Promise<SalonConfig> => {
  const response = await axios.patch(`/api/admin/salon-configs/${type}/status`, { status });
  return response.data;
};
