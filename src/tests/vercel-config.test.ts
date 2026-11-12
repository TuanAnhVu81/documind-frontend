/// <reference types="node" />
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const script = resolve('scripts/configure-vercel.mjs');

describe('Vercel routing configuration', () => {
  it('generates API and health routes before SPA fallback without overwriting files', () => {
    const dir = mkdtempSync(join(tmpdir(), 'documind-vercel-test-'));
    try {
      execFileSync(process.execPath, [script, 'https://documind-demo.onrender.com'], { cwd: dir });
      const config = JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8')) as {
        rewrites: { source: string; destination: string }[];
      };
      expect(config.rewrites).toEqual([
        { source: '/api/v1/:path*', destination: 'https://documind-demo.onrender.com/api/v1/:path*' },
        { source: '/actuator/health', destination: 'https://documind-demo.onrender.com/actuator/health' },
        { source: '/:path*', destination: '/index.html' },
      ]);
      expect(spawnSync(process.execPath, [script, 'https://other.onrender.com'], { cwd: dir }).status).toBe(1);
      expect(JSON.parse(readFileSync(join(dir, 'vercel.json'), 'utf8'))).toEqual(config);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('rejects addresses that are not HTTPS Render origins', () => {
    const dir = mkdtempSync(join(tmpdir(), 'documind-vercel-test-'));
    try {
      expect(spawnSync(process.execPath, [script, 'https://evil.example/path'], { cwd: dir }).status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
