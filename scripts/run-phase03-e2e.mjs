import { spawn, spawnSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer as createTcpServer } from 'node:net';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
import { createServer as createViteServer } from 'vite';

const root = process.cwd();
const container = 'local_postgres';
const dbName = `documind_fe_e2e_${randomBytes(8).toString('hex')}`;
const nonce = randomBytes(32).toString('hex');
let dbCreated = false;
let tempDir;
let backend;
let vite;
let browserTests;
let stopping = false;

function docker(...args) {
  const result = spawnSync('docker', args, { encoding: 'utf8', windowsHide: true });
  if (result.error || result.status !== 0)
    throw new Error(`Docker command failed: ${args.slice(0, 2).join(' ')}`);
  return result.stdout.trim();
}
async function freePort() {
  const server = createTcpServer();
  await new Promise((ok, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', ok);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Cannot reserve local port');
  const port = address.port;
  await new Promise((ok, fail) => server.close((error) => (error ? fail(error) : ok())));
  return port;
}
async function waitForBackend(url, child) {
  for (let i = 0; i < 90; i++) {
    if (child.exitCode !== null || child.signalCode !== null)
      throw new Error('Backend test stopped during startup');
    try {
      const response = await fetch(`${url}/actuator/health`);
      if (response.ok && (await response.json()).status === 'UP') return;
    } catch {
      /* waiting */
    }
    await delay(1000);
  }
  throw new Error('Backend test did not become ready');
}
function waitForExit(child) {
  if (child.exitCode !== null || child.signalCode !== null) return Promise.resolve();
  return new Promise((ok) => child.once('close', ok));
}
async function stop(child) {
  if (!child || child.exitCode !== null || child.signalCode !== null) return;
  const exited = waitForExit(child);
  child.kill();
  await exited;
}
async function cleanup() {
  if (stopping) return;
  stopping = true;
  await stop(browserTests);
  if (vite) await vite.close();
  await stop(backend);
  if (dbCreated) {
    if (!/^documind_fe_e2e_[0-9a-f]{16}$/.test(dbName))
      throw new Error('Unsafe test database name');
    docker('exec', container, 'dropdb', '-U', 'postgres', '--if-exists', dbName);
  }
  if (tempDir) await rm(tempDir, { recursive: true, force: true });
}
for (const signal of ['SIGINT', 'SIGTERM'])
  process.once(signal, () => {
    void cleanup().finally(() => process.exit(130));
  });

try {
  const password = docker('exec', container, 'printenv', 'POSTGRES_PASSWORD');
  if (!password) throw new Error('PostgreSQL test password unavailable');
  tempDir = await mkdtemp(resolve(tmpdir(), 'documind-fe-e2e-'));
  docker('exec', container, 'createdb', '-U', 'postgres', dbName);
  dbCreated = true;
  const bePort = await freePort();
  const fePort = await freePort();
  const backendUrl = `http://127.0.0.1:${bePort}`;
  const frontendUrl = `http://127.0.0.1:${fePort}`;
  process.env.BACKEND_PROXY_TARGET = backendUrl;
  vite = await createViteServer({
    root,
    server: { host: '127.0.0.1', port: fePort, strictPort: true },
    plugins: [
      {
        name: 'phase03-harness-marker',
        configureServer(server) {
          server.middlewares.use('/__phase03_harness', (_request, response) => {
            response.end(nonce);
          });
        },
      },
    ],
  });
  await vite.listen();
  const env = { ...process.env };
  for (const key of Object.keys(env)) {
    if (
      /^(SPRING_|DOCUMIND_|DB_|TEST_DB_|GEMINI_|JWT_SECRET|SERVER_|AUTH_|DOCUMENT_STORAGE_|JAVA_TOOL_OPTIONS|_JAVA_OPTIONS|JDK_JAVA_OPTIONS)/i.test(
        key,
      )
    )
      delete env[key];
  }
  Object.assign(env, {
    DB_URL: `jdbc:postgresql://localhost:5432/${dbName}`,
    DB_USERNAME: 'postgres',
    DB_PASSWORD: password,
    DB_MIGRATION_USERNAME: 'postgres',
    DB_MIGRATION_PASSWORD: password,
    JWT_SECRET: randomBytes(32).toString('base64'),
  });
  const jar = resolve(root, '../documind-backend/target/documind-backend-0.0.1-SNAPSHOT.jar');
  backend = spawn(
    'java',
    [
      '-jar',
      jar,
      '--server.address=127.0.0.1',
      `--server.port=${bePort}`,
      '--spring.profiles.active=dev',
      `--documind.auth.allowed-origins=${frontendUrl}`,
      `--documind.storage.path=${resolve(tempDir, 'storage')}`,
      '--documind.gemini.enabled=false',
      '--documind.chat.enabled=false',
      '--documind.ingestion.worker-enabled=false',
      '--documind.ingestion.pipeline-enabled=false',
    ],
    { cwd: tempDir, env, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true },
  );
  backend.stderr.on('data', () => {});
  await waitForBackend(backendUrl, backend);
  console.log('Backend and Vite test instances ready; Gemini and ingestion disabled.');
  browserTests = spawn(
    process.execPath,
    [
      resolve(root, 'node_modules/@playwright/test/cli.js'),
      'test',
      'e2e/api-phase03.spec.ts',
      '--workers=1',
    ],
    {
      cwd: root,
      stdio: 'inherit',
      windowsHide: true,
      env: {
        ...process.env,
        DOCUMIND_E2E_BASE_URL: frontendUrl,
        DOCUMIND_E2E_HARNESS_NONCE: nonce,
      },
    },
  );
  await waitForExit(browserTests);
  if (browserTests.exitCode !== 0) process.exitCode = 1;
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Test harness failed');
  process.exitCode = 1;
} finally {
  try {
    await cleanup();
  } catch (error) {
    console.error(error instanceof Error ? error.message : 'Test cleanup failed');
    process.exitCode = 1;
  }
}
