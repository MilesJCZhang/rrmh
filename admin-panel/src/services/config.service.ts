import axios, { InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// 轮播图等大字段上传需要更长超时
const longTimeoutInstance = axios.create({
  baseURL: process.env.REACT_APP_API_URL || '',
  timeout: 60000, // 60秒，轮播图 base64 数据量大
  headers: { 'Content-Type': 'application/json' },
});

longTimeoutInstance.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('token');
    if (token && config.headers) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

longTimeoutInstance.interceptors.response.use(
  (response: AxiosResponse) => response.data,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/admin/login';
    }
    return Promise.reject(error);
  }
);

// 生产 API 前缀：/api/admin/config
const API_BASE = '/api/admin/config';

export const configService = {
  // 获取配置
  getConfig: async (): Promise<any> => {
    const res: any = await longTimeoutInstance.get(`${API_BASE}/map`);
    const body = res.data || res;
    // 生产返回 { code: 200, message: "获取成功", data: { key: value } }
    if (body && body.data && typeof body.data === 'object') {
      return body.data;
    }
    return {};
  },

  // 保存配置（大字段上传用 60s 超时）
  updateConfig: async (data: Record<string, string>): Promise<any> => {
    return longTimeoutInstance.put(API_BASE, data);
  },
};

export default configService;
