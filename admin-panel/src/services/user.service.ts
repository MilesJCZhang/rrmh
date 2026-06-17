import axios from '../utils/axios.config';

export interface User {
  id: number;
  nickname: string;
  avatar: string;
  gender: number;
  birthday: string;
  height: number;
  education: string;
  occupation: string;
  income: string;
  location: string;
  status: number;
  createdAt: string;
}

export interface UserListParams {
  page?: number;
  limit?: number;
  keyword?: string;
  status?: number;
}

export interface UserListResult {
  list: User[];
  total: number;
  page: number;
  limit: number;
}

export const getUsers = async (params: UserListParams): Promise<UserListResult> => {
  const res = await axios.get('/v1/admin/users', { params });
  // axios interceptor 已返回 response.data，即 { code, data: { list, total } }
  const result = res.data || res;
  return { list: result.list || [], total: result.total || 0, page: params.page || 1, limit: params.limit || 10 };
};

export const getUserDetail = async (id: number): Promise<User> => {
  const res = await axios.get(`/v1/admin/users/${id}`);
  // axios interceptor 已返回 response.data，即 { code, data }
  const result = res.data || res;
  return result;
};

export const updateUserStatus = async (id: number, status: number): Promise<void> => {
  await axios.put(`/v1/admin/users/${id}/status`, { status });
};
