export function formatTokens(value: number | null): string {
  return value === null || !Number.isFinite(value)
    ? 'Chưa có số liệu'
    : new Intl.NumberFormat('vi-VN').format(value);
}
export function formatCost(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return 'Chưa có số liệu';
  return `${new Intl.NumberFormat('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 9 }).format(value)} USD`;
}
export function formatUsageTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.valueOf())
    ? 'Chưa xác định'
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
