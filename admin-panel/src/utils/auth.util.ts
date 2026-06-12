/**
 * 认证工具函数
 */

/**
 * 获取存储的token
 */
export const getToken = (): string | null => {
  return localStorage.getItem('token');
};

/**
 * 设置token
 */
export const setToken = (token: string): void => {
  localStorage.setItem('token', token);
};

/**
 * 移除token
 */
export const removeToken = (): void => {
  localStorage.removeItem('token');
};

/**
 * 检查是否已登录
 */
export const isAuthenticated = (): boolean => {
  const token = getToken();
  return !!token;
};

/**
 * 登出
 */
export const logout = (): void => {
  removeToken();
  window.location.href = '/admin/login';
};
