/**
 * TriChat Bridge — central hub
 * =============================
 * Links Roblox chat, Discord chat and Minecraft chat together.
 *
 *   Roblox  ─┐
 *   Discord  ├─→  THIS HUB  ─→  everyone sees everything
 *   Minecraft┘
 *
 * Run:
 *   node server.js          normal mode (starts Discord + Minecraft bots if .env is filled in)
 *   node server.js --demo   demo mode (fake chat messages, good for testing the dashboard)
 *
 * The hub:
 *   - Keeps the last 300 messages in memory
 *   - POST /api/messages   → platforms drop new chat messages here (needs BRIDGE_SECRET)
 *   - GET  /api/messages   → Roblox polls this every second for new messages
 *   - GET  /api/status     → which platforms are connected
 *   - WebSocket push       → the dashboard updates live
 *   - Serves the dashboard from /public
 */

require('dotenv').config();

const path = require('path');
const fs = require('fs');
const http = require('http');
const express = require('express');
const { EventEmitter } = require('events');
const { WebSocketServer, WebSocket } = require('ws');

const DEMO = process.argv.includes('--demo');
const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.BRIDGE_SECRET || 'change-me';

const PLATFORMS = ['roblox', 'discord', 'minecraft', 'dashboard'];
const LABELS = {
  roblox: 'Roblox',
  discord: 'Discord',
  minecraft: 'Minecraft',
  dashboard: 'Dashboard',
};
const MAX_HISTORY = 300;

/* ------------------------------------------------------------------ */
/* Message store                                                       */
/* ------------------------------------------------------------------ */

let nextId = 1;
const history = [];
const counts = { roblox: 0, discord: 0, minecraft: 0, dashboard: 0 };
const startedAt = Date.now();

/* ------------------------------------------------------------------ */
/* Platform status (shown on the dashboard)                            */
/* ------------------------------------------------------------------ */

const status = {
  roblox: { connected: false, detail: 'Waiting for your Roblox game to connect' },
  discord: { connected: false, detail: 'Disabled — add DISCORD_TOKEN to .env (README, Step 2)' },
  minecraft: { connected: false, detail: 'Disabled — add MC_HOST + MC_USERNAME to .env (README, Step 3)' },
};

// A Roblox game polls us every second — that doubles as its heartbeat.
let robloxLastSeen = 0;

const bus = new EventEmitter();

function formatForChat(msg) {
  return `[${LABELS[msg.platform] || msg.platform}] ${msg.username}: ${msg.message}`;
}

function addMessage(platform, username, message) {
  platform = String(platform || '').toLowerCase().trim();
  if (!PLATFORMS.includes(platform)) return null;

  username = String(username || 'unknown').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 32) || 'unknown';
  message = String(message || '').replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, '').trim().slice(0, 500);
  if (!message) return null;

  const msg = { id: nextId++, platform, username, message, ts: Date.now() };
  history.push(msg);
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  counts[platform] += 1;
  if (platform === 'roblox') robloxLastSeen = Date.now();

  broadcastWs({ type: 'message', message: msg });
  bus.emit('message', msg);
  console.log(`[chat] ${LABELS[platform]} | ${msg.username}: ${msg.message}`);
  return msg;
}

function statusSnapshot() {
  return {
    roblox: {
      connected: Date.now() - robloxLastSeen < 6000,
      detail: Date.now() - robloxLastSeen < 6000 ? 'A Roblox game is polling the hub' : status.roblox.detail,
    },
    discord: { connected: status.discord.connected, detail: status.discord.detail },
    minecraft: { connected: status.minecraft.connected, detail: status.minecraft.detail },
    stats: {
      total: counts.roblox + counts.discord + counts.minecraft + counts.dashboard,
      counts,
      uptimeSec: Math.floor((Date.now() - startedAt) / 1000),
      demo: DEMO,
    },
  };
}

/* ------------------------------------------------------------------ */
/* HTTP server + REST API                                              */
/* ------------------------------------------------------------------ */

const app = express();
app.use(express.json({ limit: '64kb' }));

// Serve the dashboard. We read index.html ourselves so we can inject the
// BRIDGE_SECRET into the page (that is how the dashboard is allowed to post).
const publicDir = path.join(__dirname, 'public');
app.use(express.static(publicDir, { index: false }));
const indexHtml = fs.readFileSync(path.join(publicDir, 'index.html'), 'utf8');

app.get('/', (_req, res) => {
  res.send(indexHtml.replace('__BRIDGE_SECRET__', SECRET));
});

// Platforms (Roblox script / dashboard) post new chat messages here.
app.post('/api/messages', (req, res) => {
  const { secret, platform, username, message } = req.body || {};
  if (secret !== SECRET) {
    return res.status(403).json({ ok: false, error: 'Bad secret — make BRIDGE_SECRET in .env and in the Roblox script match' });
  }
  const msg = addMessage(platform, username, message);
  if (!msg) return res.status(400).json({ ok: false, error: 'Invalid platform or empty message' });
  res.json({ ok: true, id: msg.id });
});

// Roblox polls this for messages from the other platforms.
app.get('/api/messages', (req, res) => {
  const since = Number(req.query.since || 0) || 0;
  const exclude = String(req.query.exclude || '').toLowerCase();
  if (exclude === 'roblox') robloxLastSeen = Date.now(); // heartbeat!
  const out = history.filter((m) => m.id > since && m.platform !== exclude).slice(-100);
  res.json({ ok: true, messages: out, latest: nextId - 1 });
});

app.get('/api/status', (_req, res) => res.json({ ok: true, ...statusSnapshot() }));
app.get('/api/health', (_req, res) =>
  res.json({ ok: true, uptimeSec: Math.floor((Date.now() - startedAt) / 1000) })
);

const server = http.createServer(app);

/* ------------------------------------------------------------------ */
/* WebSocket — live push to the dashboard                              */
/* ------------------------------------------------------------------ */

const wss = new WebSocketServer({ server });

function broadcastWs(payload) {
  const data = JSON.stringify(payload);
  for (const ws of wss.clients) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(data);
      } catch {
        /* client went away, ignore */
      }
    }
  }
}

wss.on('connection', (ws) => {
  ws.send(
    JSON.stringify({ type: 'hello', messages: history.slice(-50), status: statusSnapshot() })
  );
});

// Refresh status lights on the dashboard every 3 seconds.
setInterval(() => broadcastWs({ type: 'status', status: statusSnapshot() }), 3000);

/* ------------------------------------------------------------------ */
/* Bots                                                                */
/* ------------------------------------------------------------------ */

function startBots() {
  const api = { addMessage, formatForChat };

  if (process.env.DISCORD_TOKEN && process.env.DISCORD_CHANNEL_ID) {
    try {
      require('./bots/discord').start(api, status, bus);
      console.log('[bots] Discord bot starting…');
    } catch (e) {
      console.error('[bots] Discord bot failed to load:', e.message);
    }
  } else {
    console.log('[bots] Discord: disabled (set DISCORD_TOKEN + DISCORD_CHANNEL_ID in .env — README Step 2)');
  }

  if (process.env.MC_HOST && process.env.MC_USERNAME) {
    try {
      require('./bots/minecraft').start(api, status, bus);
      console.log('[bots] Minecraft bot starting…');
    } catch (e) {
      console.error('[bots] Minecraft bot failed to load:', e.message);
    }
  } else {
    console.log('[bots] Minecraft: disabled (set MC_HOST + MC_USERNAME in .env — README Step 3)');
  }
}

/* ------------------------------------------------------------------ */
/* Demo mode — fake chat so you can see the bridge working             */
/* ------------------------------------------------------------------ */

function startDemo() {
  console.log('*** DEMO MODE — posting fake chat messages so you can see the bridge in action ***');
  status.discord.connected = true;
  status.discord.detail = 'Demo mode — pretending to be connected';
  status.minecraft.connected = true;
  status.minecraft.detail = 'Demo mode — pretending to be connected';

  const pool = {
    roblox: [
      ['Builderman', 'welcome to the bridge!'],
      ['NoobSlayer_99', 'anyone wanna do an obby?'],
      ['EpicGamer_Xx', 'just got a limited item :D'],
      ['PixelPal', 'hi discord people!'],
    ],
    discord: [
      ['AlexP', 'yo what is up everyone'],
      ['pixie_dust', 'someone is building in minecraft rn?'],
      ['GhostWraith', 'roblox side sounds quiet lol'],
      ['kate!!', 'this bridge is so cool'],
    ],
    minecraft: [
      ['Steve', 'anyone got spare diamonds?'],
      ['DiamondDigger', 'found a cave with 12 diamonds!'],
      ['EndermanFan', 'do not look at the endermen...'],
      ['CreeperHunter', 'awww man'],
    ],
  };
  const platforms = Object.keys(pool);

  (function tick() {
    const platform = platforms[Math.floor(Math.random() * platforms.length)];
    const pairs = pool[platform];
    const [username, message] = pairs[Math.floor(Math.random() * pairs.length)];
    addMessage(platform, username, message);
    setTimeout(tick, 2200 + Math.random() * 1800);
  })();

  // keep the Roblox heartbeat happy in demo mode
  setInterval(() => {
    robloxLastSeen = Date.now();
  }, 2000);
}

/* ------------------------------------------------------------------ */
/* Go!                                                                 */
/* ------------------------------------------------------------------ */

server.listen(PORT, () => {
  console.log('');
  console.log('  ⚡ TriChat Bridge hub is running!');
  console.log(`  Dashboard : http://localhost:${PORT}`);
  console.log(`  API       : http://localhost:${PORT}/api/status`);
  console.log('');
  if (DEMO) startDemo();
  else startBots();
});
