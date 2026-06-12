import axios from '../utils/axios.config';

export interface Activity {
  id: number;
  title: string;
  type: string;
  status: string;
  // 后端 camelCase 字段
  location?: string;
  city?: string;
  organizer?: string;
  startTime?: string;
  endTime?: string;
  maxParticipants?: number;
  registrationFee?: string;
  coverImage?: string;
  registeredCount?: number;
  createdAt?: string;
  updatedAt?: string;
  companions_count?: number;
  reject_reason?: string;
  // 兼容旧数据（snake_case）
  description?: string;
  max_participants?: number;
  male_count?: number;
  female_count?: number;
  max_per_gender?: number;
  total_cap?: number;
  registration_fee?: number;
  created_at?: string;
  updated_at?: string;
  organizer_name?: string;
  event_date?: string;
  start_time?: string;
  end_time?: string;
  poster_url?: string;
}

export interface ActivityListParams {
  page?: number;
  limit?: number;
  status?: string;
  keyword?: string;
  type?: string;
}

export interface ActivityListResult {
  list: Activity[];
  total: number;
  page: number;
  limit: number;
}

/** 获取活动列表（管理后台） */
export const getActivities = async (params: ActivityListParams): Promise<ActivityListResult> => {
  const res = await axios.get('/v1/admin/activities', { params });
  const data = (res as any).data || { list: [], total: 0, page: 1, limit: 10 };
  return data;
};

/** 审核活动（通过/拒绝） */
export const approveActivity = async (id: number, action: 'approve' | 'reject', reject_reason?: string): Promise<void> => {
  await axios.put(`/v1/salon/${id}/approve`, { action, reject_reason });
};
