export type ServerEvent = { event: string; data: string };

/** Parses SSE framing independently from byte boundaries, including CRLF split across reads. */
export class SseParser {
  private readonly decoder = new TextDecoder('utf-8', { fatal: true });
  private buffer = '';
  private name = '';
  private data: string[] = [];
  private readonly onEvent: (event: ServerEvent) => void;
  constructor(onEvent: (event: ServerEvent) => void) {
    this.onEvent = onEvent;
  }
  push(bytes: Uint8Array) {
    this.buffer += this.decoder.decode(bytes, { stream: true });
    this.drain(false);
  }
  finish() {
    this.buffer += this.decoder.decode();
    this.drain(true);
  }
  private drain(final: boolean) {
    while (true) {
      const match = /[\r\n]/.exec(this.buffer);
      if (!match) return;
      const index = match.index;
      if (!final && this.buffer[index] === '\r' && index === this.buffer.length - 1) return;
      const line = this.buffer.slice(0, index);
      const width = this.buffer[index] === '\r' && this.buffer[index + 1] === '\n' ? 2 : 1;
      this.buffer = this.buffer.slice(index + width);
      this.line(line);
    }
  }
  private line(line: string) {
    if (!line) {
      if (this.data.length)
        this.onEvent({ event: this.name || 'message', data: this.data.join('\n') });
      this.name = '';
      this.data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const split = line.indexOf(':');
    const field = split < 0 ? line : line.slice(0, split);
    let value = split < 0 ? '' : line.slice(split + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') this.name = value;
    if (field === 'data') this.data.push(value);
  }
}
