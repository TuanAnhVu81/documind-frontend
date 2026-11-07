import { describe, expect, it } from 'vitest';
import { credentialsSchema } from '@/features/auth/validation';

describe('kiểm tra thông tin đăng nhập', () => {
  it('chấp nhận thông tin hợp lệ', () => {
    expect(
      credentialsSchema.safeParse({ email: '  demo@example.test ', password: 'password123' })
        .success,
    ).toBe(true);
  });
  it('từ chối email sai và mật khẩu ngắn', () => {
    expect(credentialsSchema.safeParse({ email: 'bad', password: 'short' }).success).toBe(false);
  });
  it('từ chối mật khẩu quá 72 byte UTF-8', () => {
    expect(
      credentialsSchema.safeParse({ email: 'demo@example.test', password: 'ậ'.repeat(25) }).success,
    ).toBe(false);
  });
});
