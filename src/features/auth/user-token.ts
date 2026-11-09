import { ApiError } from '@/api/errors';
import { authManager } from './auth-manager';

export async function accessTokenForUser(userId: string): Promise<string> {
  const token = await authManager.accessToken();
  if (!token || authManager.getSnapshot().user?.id !== userId)
    throw new ApiError('Phiên đã thay đổi. Vui lòng đăng nhập lại.', { status: 401 });
  return token;
}
