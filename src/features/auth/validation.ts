import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z
    .string()
    .trim()
    .min(1, 'Vui lòng nhập email.')
    .max(254, 'Email quá dài.')
    .email('Email chưa đúng định dạng.'),
  password: z
    .string()
    .min(8, 'Mật khẩu cần ít nhất 8 ký tự.')
    .refine((value) => value.trim().length > 0, 'Vui lòng nhập mật khẩu.')
    .max(72, 'Mật khẩu không được quá 72 ký tự.')
    .refine(
      (value) => new TextEncoder().encode(value).length <= 72,
      'Mật khẩu không được vượt quá 72 byte UTF-8.',
    ),
});
export type CredentialsForm = z.infer<typeof credentialsSchema>;
