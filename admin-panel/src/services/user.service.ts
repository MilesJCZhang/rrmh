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
  const res = await axios.get('/admin-api/users', { params });
  // axios interceptor 返回 response.data，即 { code, data: { list, total, page, limit } }
  const d = res.data || res;
  const list = (d.list || []).map((u: any) => ({
    id: u.id,
    nickname: u.nickname || '',
    avatar: u.avatar_url || u.avatar || '',
    gender: u.gender,
    birthday: u.birthday || '',
    height: u.height || 0,
    education: u.education || '',
    occupation: u.occupation || '',
    income: u.income || '',
    location: u.location || '',
    status: u.status,
    createdAt: u.created_at || '',
  }));
  return { list, total: d.total || 0, page: d.page || params.page || 1, limit: d.limit || params.limit || 10 };
};

export const getUserDetail = async (id: number): Promise<User> => {
  const res = await axios.get(`/admin-api/users/${id}`);
  // axios interceptor 已返回 response.data，即 { code, data: user }
  const d = res.data || res;
  // 统一字段格式
  return {
    id: d.id,
    nickname: d.nickname || '',
    avatar: d.avatar_url || d.avatar || '',
    gender: d.gender || 0,
    birthday: d.birthday || '',
    height: d.height || 0,
    education: d.education || '',
    occupation: d.occupation || '',
    income: d.income || '',
    location: d.location || '',
    status: d.status,
    createdAt: d.created_at || d.createdAt || '',
  } as User;
};

export const updateUserStatus = async (id: number, status: number): Promise<void> => {
  await axios.put(`/admin-api/users/${id}/status`, { status });
};
