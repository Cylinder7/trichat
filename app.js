/* ================================================================
   TriChat Bridge — dashboard logic
   Live updates via WebSocket, with automatic polling fallback.
   ================================================================ */

const COLORS = {
  roblox: '#ff5a64',
  discord: '#8291ff',
  minecraft: '#5adc78',
  dashboard: '#00dcff',
};
const LABELS = {
  roblox: 'Roblox',
  discord: 'Discord',
  minecraft: 'Minecraft',
  dashboard: 'Dashboard',
};

const SECRET = window.BRIDGE_SECRET || '';

const feed = document.getElementById('feed');
const empty = document.getElementById('empty');
const composer = document.getElementById('composer');
const nameInput = document.getElementById('name');
const msgInput = document.getElementById('msg');
const toast = document.createElement('div');
toast.className = 'toast';
document.body.appendChild(toast);

let lastId = 0;
let stick = true;

function showToast(text) {
  toast.textContent = text;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3500);
}

function fmtTime(ts) {
  const d = new Date(ts);
  let h = d.getHours();
  const m = String(d.getMinutes()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m} ${ampm}`;
}

function addMessage(m) {
  if (!m || typeof m.id !== 'number' || m.id <= lastId) return;
  lastId = m.id;

  if (empty) empty.remove();

  const color = COLORS[m.platform] || '#9aa7ba';
  const label = LABELS[m.platform] || m.platform;

  const row = document.createElement('div');
  row.className = 'msg';

  const tag = document.createElement('span');
  tag.className = 'tag';
  tag.textContent = label;
  tag.style.color = color;
  tag.style.borderColor = color;
  tag.style.background = color + '1c';

  const who = document.createElement('span');
  who.className = 'who';
  who.textContent = m.username;
  who.style.color = color;

  const what = document.createElement('span');
  what.className = 'what';
  what.textContent = m.message;

  const when = document.createElement('span');
  when.className = 'when';
  when.textContent = fmtTime(m.ts || Date.now());

  row.append(tag, who, what, when);
  feed.appendChild(row);

  while (feed.children.length > 200) feed.firstChild.remove();

  if (stick) feed.scrollTop = feed.scrollHeight;
}

feed.addEventListener('scroll', () => {
  stick = feed.scrollHeight - feed.scrollTop - feed.clientHeight < 48;
});

/* ---------------- status lights + stats ---------------- */

function setChip(platform, connected, detail) {
  const chip = document.getElementById('chip-' + platform);
  if (!chip) return;
  chip.classList.toggle('on', !!connected);
  chip.classList.toggle('err', !connected && /fail|error|kicked/i.test(detail || ''));
  chip.title = detail || (connected ? 'connected' : 'offline');
}

function applyStatus(snap) {
  if (!snap) return;
  for (const p of ['roblox', 'discord', 'minecraft']) {
    const s = (snap && snap[p]) || {};
    setChip(p, s.connected, s.detail);
  }
  const stats = (snap && snap.stats) || {};
  const t = (sel, v) => {
    const el = document.querySelector(sel);
    if (el) el.textContent = v;
  };
  t('#stat-total', String(stats.total ?? 0));
  t('#stat-roblox', String((stats.counts || {}).roblox ?? 0));
  t('#stat-discord', String((stats.counts || {}).discord ?? 0));
  t('#stat-minecraft', String((stats.counts || {}).minecraft ?? 0));
  const up = stats.uptimeSec ?? 0;
  t(
    '#stat-uptime',
    up < 60 ? `${up}s` : up < 3600 ? `${Math.floor(up / 60)}m ${up % 60}s` : `${Math.floor(up / 3600)}h ${Math.floor((up % 3600) / 60)}m`
  );
  const demo = document.getElementById('demo-badge');
  if (demo) demo.hidden = !stats.demo;
}

/* ---------------- send from the dashboard ---------------- */

composer.addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = nameInput.value.trim() || 'DashboardUser';
  const message = msgInput.value.trim();
  if (!message) return;
  msgInput.value = '';
  try {
    const r = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: SECRET, platform: 'dashboard', username, message }),
      signal: AbortSignal.timeout(5000),
    });
    const d = await r.json();
    if (!d.ok) showToast('Send failed: ' + (d.error || r.status));
  } catch {
    showToast('Could not reach the hub — is server.js still running?');
  }
});

/* ---------------- live updates ---------------- */

let pollTimer = null;
let pollingInFlight = false;

function startPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(async () => {
    if (pollingInFlight) return; // never stack requests
    pollingInFlight = true;
    try {
      const [mR, sR] = await Promise.all([
        fetch('/api/messages?since=' + lastId, { signal: AbortSignal.timeout(4000) }),
        fetch('/api/status', { signal: AbortSignal.timeout(4000) }),
      ]);
      const mD = await mR.json();
      const sD = await sR.json();
      (mD.messages || []).forEach(addMessage);
      applyStatus(sD);
    } catch {
      /* hub offline; keep trying */
    } finally {
      pollingInFlight = false;
    }
  }, 1500);
}

async function initialLoad() {
  try {
    const [mR, sR] = await Promise.all([
      fetch('/api/messages?since=0', { signal: AbortSignal.timeout(4000) }),
      fetch('/api/status', { signal: AbortSignal.timeout(4000) }),
    ]);
    const mD = await mR.json();
    const sD = await sR.json();
    (mD.messages || []).forEach(addMessage);
    applyStatus(sD);
  } catch {
    /* ignore */
  }
}

function connectWs() {
  try {
    const proto = location.protocol === 'https:' ? 'wss://' : 'ws://';
    const ws = new WebSocket(proto + location.host);

    ws.onmessage = (e) => {
      const p = JSON.parse(e.data);
      if (p.type === 'hello') {
        (p.messages || []).forEach(addMessage);
        applyStatus(p.status);
      } else if (p.type === 'message') {
        addMessage(p.message);
      } else if (p.type === 'status') {
        applyStatus(p.status);
      }
    };

    ws.onclose = startPolling;
    ws.onerror = startPolling;
  } catch {
    startPolling();
  }
}

// Remember the name between visits
nameInput.value = localStorage.getItem('trichat-name') || '';
nameInput.addEventListener('change', () => localStorage.setItem('trichat-name', nameInput.value.trim()));

initialLoad().then(connectWs);
