export function retryAfterDeadline(value: string | undefined, now = Date.now()): number {
  if (!value) return now + 1000;
  const trimmed = value.trim();
  if (/^\d+$/.test(trimmed))
    return now + Math.min(Number(trimmed), (Number.MAX_SAFE_INTEGER - now) / 1000) * 1000;
  const date = Date.parse(trimmed);
  return Number.isFinite(date) ? Math.max(now, date) : now + 1000;
}

export function historyConfirmsDone(
  messages: { id: string; status: string }[],
  assistantId: string,
  doneAt: number,
  requestAt: number,
): boolean {
  return (
    requestAt >= doneAt &&
    messages.some((item) => item.id === assistantId && item.status !== 'GENERATING')
  );
}

export async function readWithIdleTimeout(
  reader: ReadableStreamDefaultReader<Uint8Array>,
  timeoutMs: number,
  onTimeout: () => void,
): Promise<ReadableStreamReadResult<Uint8Array>> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      reader.read(),
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => {
          onTimeout();
          reject(new Error('SSE idle timeout'));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
