import { describe, expect, it } from 'vitest';
import { credentialsSchema, registrationSchema } from '@/features/auth/validation';

describe('kiểm tra thông tin đăng nhập', () => {
  it('yêu cầu mật khẩu xác nhận khớp khi đăng ký', () => {
    const values = { email: 'demo@example.test', password: 'password123' };
    expect(registrationSchema.safeParse({ ...values, confirmPassword: '' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...values, confirmPassword: 'khac12345' }).success).toBe(false);
    expect(registrationSchema.safeParse({ ...values, confirmPassword: 'password123' }).success).toBe(true);
  });
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
