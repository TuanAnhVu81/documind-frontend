import { ApiError } from '@/api/errors';
import { authManager } from '@/features/auth/auth-manager';

export async function documentToken(userId: string): Promise<string> {
  const token = await authManager.accessToken();
  if (!token || authManager.getSnapshot().user?.id !== userId) {
    throw new ApiError('Phiên đã thay đổi. Vui lòng đăng nhập lại.', { status: 401 });
  }
  return token;
}
