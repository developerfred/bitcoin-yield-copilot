#!/usr/bin/env node
/**
 * dev-orchestrator.mjs
 *
 * Levanta o ambiente de desenvolvimento completo:
 *   1. Servidor estático (wallet-connect.html)
 *   2. Túnel ngrok (HTTPS para o Telegram)
 *   3. Bot principal (tsx watch)
 *
 * Uso: node dev-orchestrator.mjs
 */

import { spawn } from 'child_process';
import { createServer } from 'http';
import { readFile, access } from 'fs/promises';
import { join, resolve } from 'path';
import { createInterface } from 'readline';
import { writeFileSync, readFileSync, existsSync } from 'fs';

// ─── Config ────────────────────────────────────────────────────────────────

const STATIC_PORT   = parseInt(process.env.STATIC_PORT   || '3001');
const STATIC_DIR    = resolve(process.cwd(), 'public');
const ENV_FILE      = resolve(process.cwd(), '.env');
const BOT_ENTRY     = resolve(process.cwd(), 'src/index.ts');
const NGROK_TIMEOUT = 10_000; // ms to wait for ngrok tunnel

const COLORS = {
  reset:  '\x1b[0m',
  dim:    '\x1b[2m',
  bold:   '\x1b[1m',
  red:    '\x1b[31m',
  green:  '\x1b[32m',
  yellow: '\x1b[33m',
  blue:   '\x1b[34m',
  cyan:   '\x1b[36m',
  orange: '\x1b[33m',
};

function tag(label, color) {
  return `${color}[${label}]${COLORS.reset}`;
}

function log(label, color, ...args) {
  console.log(tag(label, color), ...args);
}

// ─── Tiny static file server ───────────────────────────────────────────────

const MIME = {
  '.html': 'text/html',
  '.js':   'application/javascript',
  '.css':  'text/css',
  '.png':  'image/png',
  '.svg':  'image/svg+xml',
  '.ico':  'image/x-icon',
};

async function startStaticServer() {
  return new Promise((resolveP, rejectP) => {
    const server = createServer(async (req, res) => {
      let urlPath = req.url?.split('?')[0] || '/';
      if (urlPath === '/') urlPath = '/index.html';

      // strip leading slash and resolve safely
      const filePath = join(STATIC_DIR, urlPath.replace(/^\/+/, ''));

      try {
        await access(filePath);
        const ext  = filePath.slice(filePath.lastIndexOf('.'));
        const mime = MIME[ext] || 'application/octet-stream';
        const data = await readFile(filePath);
        res.writeHead(200, {
          'Content-Type': mime,
          'ngrok-skip-browser-warning': 'true',   // ← bypass ngrok warning page
          'Access-Control-Allow-Origin': '*',
        });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end(`Not found: ${urlPath}`);
      }
    });

    server.listen(STATIC_PORT, () => {
      log('static', COLORS.blue, `Serving ${STATIC_DIR} on http://localhost:${STATIC_PORT}`);
      resolveP(server);
    });

    server.on('error', rejectP);
  });
}

// ─── ngrok tunnel ──────────────────────────────────────────────────────────

async function startNgrok() {
  return new Promise((resolveP, rejectP) => {
    log('ngrok', COLORS.cyan, `Opening tunnel to port ${STATIC_PORT}...`);

    // --request-header-add tells ngrok to inject this header on EVERY incoming
    // request before forwarding to your server — the only reliable way to skip
    // the ngrok browser warning page on free accounts.
    const proc = spawn('ngrok', [
      'http', String(STATIC_PORT),
      '--log=stdout',
      '--log-format=json',
      '--request-header-add=ngrok-skip-browser-warning:true',
    ], {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let publicUrl = null;
    const timer = setTimeout(() => {
      if (!publicUrl) rejectP(new Error('ngrok timed out — is it installed? Run: npm install -g ngrok'));
    }, NGROK_TIMEOUT);

    proc.stdout.on('data', (chunk) => {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        try {
          const obj = JSON.parse(line);
          // ngrok emits the URL in different fields depending on version
          const url = obj.url || obj.public_url || (obj.msg === 'started tunnel' && obj.url);
          if (url && url.startsWith('https://')) {
            clearTimeout(timer);
            publicUrl = url;
            log('ngrok', COLORS.cyan, `Tunnel ready → ${COLORS.bold}${url}${COLORS.reset}`);
            resolveP({ url, proc });
          }
        } catch {
          // non-JSON line, ignore
        }
      }
    });

    proc.stderr.on('data', (d) => {
      log('ngrok', COLORS.yellow, d.toString().trim());
    });

    proc.on('error', (err) => {
      clearTimeout(timer);
      rejectP(new Error(`Failed to start ngrok: ${err.message}\nMake sure ngrok is installed: npm install -g ngrok`));
    });

    proc.on('exit', (code) => {
      if (!publicUrl) {
        clearTimeout(timer);
        rejectP(new Error(`ngrok exited early with code ${code}`));
      }
    });
  });
}

// ─── Fallback: try ngrok HTTP API (for already-running ngrok) ──────────────

async function getNgrokUrlFromApi() {
  try {
    const res = await fetch('http://localhost:4040/api/tunnels');
    if (!res.ok) return null;
    const data = await res.json();
    const tunnel = data.tunnels?.find((t) => t.public_url?.startsWith('https://'));
    return tunnel?.public_url || null;
  } catch {
    return null;
  }
}

// ─── Update .env with MINI_APP_URL ─────────────────────────────────────────

function updateEnvFile(miniAppUrl) {
  if (!existsSync(ENV_FILE)) {
    writeFileSync(ENV_FILE, `MINI_APP_URL=${miniAppUrl}\n`);
    log('env', COLORS.green, `Created .env with MINI_APP_URL=${miniAppUrl}`);
    return;
  }

  let content = readFileSync(ENV_FILE, 'utf8');

  if (content.includes('MINI_APP_URL=')) {
    content = content.replace(/^MINI_APP_URL=.*/m, `MINI_APP_URL=${miniAppUrl}`);
    log('env', COLORS.green, `Updated MINI_APP_URL → ${miniAppUrl}`);
  } else {
    content += `\nMINI_APP_URL=${miniAppUrl}\n`;
    log('env', COLORS.green, `Added MINI_APP_URL=${miniAppUrl}`);
  }

  writeFileSync(ENV_FILE, content);
}

// ─── Start the bot (tsx watch) ─────────────────────────────────────────────

function startBot() {
  log('bot', COLORS.green, `Starting ${BOT_ENTRY} with tsx watch...`);

  const proc = spawn('npx', ['tsx', 'watch', BOT_ENTRY], {
    stdio: 'inherit',
    env: { ...process.env },
    shell: true,
  });

  proc.on('error', (err) => {
    log('bot', COLORS.red, `Failed to start: ${err.message}`);
  });

  return proc;
}

// ─── Graceful shutdown ─────────────────────────────────────────────────────

function setupShutdown(processes) {
  const shutdown = () => {
    console.log('\n');
    log('orchestrator', COLORS.yellow, 'Shutting down...');
    for (const proc of processes) {
      try { proc?.kill('SIGTERM'); } catch {}
    }
    process.exit(0);
  };

  process.on('SIGINT',  shutdown);
  process.on('SIGTERM', shutdown);
}

// ─── Main ──────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n${COLORS.bold}${COLORS.orange}⚡ Bitcoin Yield Copilot — Dev Orchestrator${COLORS.reset}\n`);

  const procs = [];

  // 1. Static server
  try {
    await startStaticServer();
  } catch (err) {
    log('static', COLORS.red, `Failed: ${err.message}`);
    process.exit(1);
  }

  // 2. ngrok tunnel
  let miniAppUrl;
  try {
    // First check if ngrok is already running
    const existing = await getNgrokUrlFromApi();
    if (existing) {
      log('ngrok', COLORS.cyan, `Using existing tunnel → ${COLORS.bold}${existing}${COLORS.reset}`);
      miniAppUrl = `${existing}/wallet-connect.html`;
    } else {
      const { url, proc } = await startNgrok();
      procs.push(proc);
      miniAppUrl = `${url}/wallet-connect.html`;
    }
  } catch (err) {
    log('ngrok', COLORS.red, `${err.message}`);
    log('ngrok', COLORS.yellow, 'Continuing without tunnel — set MINI_APP_URL manually in .env');
    miniAppUrl = `http://localhost:${STATIC_PORT}/wallet-connect.html`;
  }

  // 3. Write URL to .env
  updateEnvFile(miniAppUrl);

  // Print summary
  console.log(`
${COLORS.bold}─────────────────────────────────────────${COLORS.reset}
  ${tag('static', COLORS.blue)}  http://localhost:${STATIC_PORT}
  ${tag('mini-app', COLORS.cyan)} ${miniAppUrl}
  ${tag('env', COLORS.green)}    MINI_APP_URL updated in .env
${COLORS.bold}─────────────────────────────────────────${COLORS.reset}
`);

  // 4. Start bot
  const botProc = startBot();
  procs.push(botProc);

  setupShutdown(procs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
