import axios from '../utils/axios.config';
import { setToken } from '../utils/auth.util';

export interface LoginParams {
  username: string;
  password: string;
}

export interface LoginResult {
  token: string;
  user: {
    id: number;
    username: string;
    role: string;
  };
}

/**
 * 管理员登录
 */
export const login = async (params: LoginParams): Promise<LoginResult> => {
  const response = await axios.post<LoginResult>('/api/auth/login', params);
  const result = response.data;
  if (result.token) {
    setToken(result.token);
  }
  return result;
};

/**
 * 退出登录
 */
export const logout = async (): Promise<void> => {
  return axios.post('/api/auth/logout');
};
