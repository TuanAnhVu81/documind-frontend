import { describe, expect, it } from 'vitest';
import { formatCost, formatTokens, formatUsageTime } from '@/features/usage/usage-format';

describe('Định dạng usage', () => {
  it('phân biệt giá trị chưa biết và số không thực sự', () => {
    expect(formatTokens(null)).toBe('Chưa có số liệu');
    expect(formatTokens(0)).toBe('0');
    expect(formatCost(null)).toBe('Chưa có số liệu');
    expect(formatCost(0)).toBe('0,00 USD');
  });
  it('giữ chi phí nhỏ có nghĩa và không bịa ngày thiếu', () => {
    expect(formatCost(0.000000001)).toBe('0,000000001 USD');
    expect(formatUsageTime('not-a-date')).toBe('Chưa xác định');
  });
});
