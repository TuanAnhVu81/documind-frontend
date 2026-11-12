const codeMessages: Record<string, string> = {
  LOGIN_INVALID: 'Email hoặc mật khẩu không đúng.',
  EMAIL_ALREADY_REGISTERED: 'Email này đã được đăng ký.',
  CSRF_INVALID: 'Phiên bảo mật đã hết hạn. Vui lòng thử lại.',
  REFRESH_RACE: 'Phiên đang được làm mới. Vui lòng thử lại.',
  REFRESH_INVALID: 'Phiên đã hết hạn. Vui lòng đăng nhập lại.',
  REFRESH_REUSED: 'Phiên không còn hợp lệ. Vui lòng đăng nhập lại.',
  DOCUMENT_NOT_READY: 'Tài liệu chưa sẵn sàng.',
  GENERATION_IN_PROGRESS: 'Hội thoại đang có lượt trả lời.',
  GENERATION_NOT_REPLAYABLE: 'Không thể phát lại lượt trả lời. Vui lòng xem lịch sử.',
  IDEMPOTENCY_KEY_REUSED: 'Yêu cầu này không khớp với lần gửi trước.',
  INVALID_DOCUMENT_SCOPE: 'Phạm vi tài liệu không hợp lệ.',
  FILE_TOO_LARGE: 'Tệp vượt quá kích thước cho phép.',
  STORAGE_CAPACITY_EXCEEDED: 'Không gian lưu trữ đã đầy. Vui lòng xóa bớt tài liệu và thử lại.',
  UNSUPPORTED_MEDIA_TYPE: 'Định dạng tệp không được hỗ trợ.',
  RATE_LIMITED: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
};
const statusMessages: Record<number, string> = {
  400: 'Thông tin gửi đi chưa hợp lệ.',
  401: 'Vui lòng đăng nhập để tiếp tục.',
  403: 'Bạn không có quyền thực hiện thao tác này.',
  404: 'Không tìm thấy nội dung yêu cầu.',
  409: 'Yêu cầu đang xung đột với trạng thái hiện tại.',
  413: 'Tệp vượt quá kích thước cho phép.',
  415: 'Định dạng tệp không được hỗ trợ.',
  429: 'Bạn đã gửi quá nhiều yêu cầu. Vui lòng thử lại sau.',
  503: 'Dịch vụ tạm thời chưa sẵn sàng. Vui lòng thử lại sau.',
};

type ErrorDetails = {
  status?: number;
  code?: string;
  requestId?: string;
  retryAfter?: string;
  generationId?: string;
  assistantMessageId?: string;
  generationStatus?: string;
};
export class ApiError extends Error {
  readonly status: number | undefined;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly retryAfter: string | undefined;
  readonly generationId: string | undefined;
  readonly assistantMessageId: string | undefined;
  readonly generationStatus: string | undefined;
  constructor(message: string, details: ErrorDetails = {}) {
    super(message);
    this.name = 'ApiError';
    Object.assign(this, details);
  }
}
function stringField(data: unknown, key: string): string | undefined {
  if (
    data &&
    typeof data === 'object' &&
    key in data &&
    typeof data[key as keyof typeof data] === 'string'
  ) {
    return data[key as keyof typeof data] as string;
  }
  return undefined;
}
export async function errorFromResponse(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const code = stringField(body, 'code');
  return new ApiError(
    (code && codeMessages[code]) ||
      statusMessages[response.status] ||
      'Không thể hoàn tất yêu cầu. Vui lòng thử lại sau.',
    {
      status: response.status,
      code,
      requestId:
        stringField(body, 'requestId') || response.headers.get('X-Request-ID') || undefined,
      retryAfter: response.headers.get('Retry-After') || undefined,
      generationId: stringField(body, 'generationId'),
      assistantMessageId: stringField(body, 'assistantMessageId'),
      generationStatus: stringField(body, 'status'),
    },
  );
}
