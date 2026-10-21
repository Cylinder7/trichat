/**
 * TriChat Bridge — Minecraft bot
 * ==============================
 * Started automatically by server.js when MC_HOST and MC_USERNAME are set
 * in .env (see README Step 3).
 *
 *  - Chat on your Minecraft server → sent to the hub
 *  - Messages from Roblox / Discord → said out loud by the bot in Minecraft
 *
 * The bot is a normal player account joining your server, so:
 *  - Offline-mode (cracked) server → any username works, no password.
 *  - Online-mode server → use a real (or spare) Microsoft account:
 *    set MC_USERNAME and MC_PASSWORD in .env.
 */

function start(api, status, bus) {
  let mineflayer;
  try {
    mineflayer = require('mineflayer');
  } catch (e) {
    status.minecraft.connected = false;
    status.minecraft.detail = 'mineflayer not installed — run: npm install';
    console.error('[minecraft] mineflayer is not installed. Run `npm install` in this folder.');
    return;
  }

  const host = process.env.MC_HOST;
  const port = Number(process.env.MC_PORT || 25565);
  const username = process.env.MC_USERNAME;
  const password = process.env.MC_PASSWORD || undefined;
  const version = process.env.MC_VERSION || undefined; // undefined = auto-detect

  let bot = null;
  let inGame = false;
  let stopping = false;
  let reconnectTimer = null;

  const stripColor = (s) => String(s).replace(/§./g, '');

  function connect() {
    if (stopping) return;
    console.log(`[minecraft] Connecting to ${host}:${port} as ${username}…`);
    status.minecraft.detail = `Connecting to ${host}:${port}…`;

    bot = mineflayer.createBot({
      host,
      port,
      username,
      auth: password ? 'microsoft' : 'offline',
      ...(password ? { password } : {}),
      ...(version ? { version } : {}),
    });

    bot.once('login', () => {
      inGame = true;
      status.minecraft.connected = true;
      status.minecraft.detail = `Connected to ${host}:${port} as ${username}`;
      console.log(`[minecraft] Logged in as ${username}!`);
    });

    // Minecraft → hub. The 'chat' event covers normal player chat.
    bot.on('chat', (who, message) => {
      if (!bot || who === bot.username) return; // don't relay ourselves
      const clean = stripColor(message).trim();
      if (clean) api.addMessage('minecraft', who, clean);
    });

    bot.on('kicked', (reason) => {
      status.minecraft.connected = false;
      status.minecraft.detail = `Kicked: ${String(reason).slice(0, 90)}`;
      console.warn('[minecraft] Kicked:', reason);
    });

    bot.on('error', (err) => {
      console.error('[minecraft] error:', err.message);
    });

    bot.on('end', () => {
      inGame = false;
      status.minecraft.connected = false;
      if (stopping) return;
      status.minecraft.detail = 'Disconnected — retrying in 10 seconds';
      console.warn('[minecraft] Disconnected — retrying in 10 seconds…');
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, 10000);
    });
  }

  // hub → Minecraft
  bus.on('message', (msg) => {
    if (msg.platform === 'minecraft') return; // don't echo Minecraft into Minecraft
    if (!inGame || !bot) return;
    const text = stripColor(api.formatForChat(msg)).slice(0, 256); // MC limit is 256
    try {
      bot.chat(text);
    } catch (e) {
      console.error('[minecraft] chat failed:', e.message);
    }
  });

  connect();

  return {
    stop() {
      stopping = true;
      clearTimeout(reconnectTimer);
      try {
        if (bot) bot.quit();
      } catch {
        /* already gone */
      }
    },
  };
}

module.exports = { start };
