import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import {
  LoginData,
  BetData,
  WebSocketMessage,
  ClientSession,
  ParentBetRequest,
  BetAttempt,
} from './types';

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const injectorStaticPath = fs.existsSync(path.join(__dirname, '../public/injector'))
  ? path.join(__dirname, '../public/injector')
  : path.join(__dirname, '../../injector');

app.use('/injector', express.static(injectorStaticPath));
app.use(express.static(injectorStaticPath));

// Connected sessions in-memory store
const sessions = new Map<string, ClientSession>();
const recentBets = new Map<string, ParentBetRequest>();

// User database / config (can be backed by Postgres/Redis)
const USER_ROLES: Record<string, { isSender: boolean; pass: string; allowedSenders?: string[] }> = {
  admin: { isSender: true, pass: 'admin123' },
  sender1: { isSender: true, pass: 'pass123' },
  // 15 to 30 receiver follower accounts:
  receiver1: { isSender: false, pass: 'pass123', allowedSenders: ['admin', 'sender1'] },
  receiver2: { isSender: false, pass: 'pass123', allowedSenders: ['admin', 'sender1'] },
  receiver3: { isSender: false, pass: 'pass123', allowedSenders: ['admin', 'sender1'] },
};

// Seed 30 receivers
for (let i = 4; i <= 30; i++) {
  USER_ROLES[`receiver${i}`] = {
    isSender: false,
    pass: 'pass123',
    allowedSenders: ['admin', 'sender1'],
  };
}

// -----------------------------------------------------------------------------
// REST Endpoints
// -----------------------------------------------------------------------------

// Match exact APK endpoint: /websites/:username/:password
app.get('/websites/:username/:password', (req, res) => {
  const { username, password } = req.params;
  const forwardedFrom = req.headers['x-forwarded-from'];

  console.log(`[API] /websites requested by user: ${username}, forwarded-from: ${forwardedFrom}`);

  const user = USER_ROLES[username];
  if (!user || user.pass !== password) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Returns website configuration for the APK
  const websiteConfigs = [
    {
      name: 'betin247',
      fromUrl: 'scripts-',
      fromURL: 'scripts-',
      toUrl: '/injector/betin247-patch.js',
      toURL: '/injector/betin247-patch.js',
      afterPageLoadUrl: '',
      is_url_to_url: true,
      is_after_page_load: false,
      defaultWebsites: [
        'https://betin247.com',
        'https://diamond247.com',
        'https://allpanel.com',
      ],
    },
  ];

  res.json(websiteConfigs);
});

// Check-version endpoint matching APK
app.get('/check-version', (req, res) => {
  const { fileName, clientVersion } = req.query;
  res.json({
    updateRequired: false,
    currentVersion: '1.0.0',
    fileName,
  });
});

// Health & Metrics
app.get('/health', (req, res) => {
  const activeReceivers = Array.from(sessions.values()).filter(
    (s) => s.isLoggedIn && !s.isSender
  ).length;
  const activeSenders = Array.from(sessions.values()).filter(
    (s) => s.isLoggedIn && s.isSender
  ).length;

  res.json({
    status: 'ok',
    uptime: process.uptime(),
    activeSenders,
    activeReceivers,
    totalConnections: sessions.size,
  });
});

// Dashboard Route
app.get(['/', '/dashboard'], (req, res) => {
  const htmlPath = fs.existsSync(path.join(__dirname, '../public/index.html'))
    ? path.join(__dirname, '../public/index.html')
    : path.join(__dirname, '../../server/public/index.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.json({ message: 'BI247 Engine Running' });
  }
});

// Bet Audit Log
app.get('/api/bets', (req, res) => {
  res.json(Array.from(recentBets.values()).slice(-50));
});

// Simulate 25 Receivers for testing
app.post('/api/simulate-receivers', (req, res) => {
  let created = 0;
  for (let i = 1; i <= 25; i++) {
    const uname = `receiver${i}`;
    const id = `sim_${uname}`;
    if (!sessions.has(id)) {
      sessions.set(id, {
        id,
        username: uname,
        website: 'betin247',
        isSender: false,
        isLoggedIn: true,
        lastPing: Date.now(),
        currentPingMs: 12,
        stakes: { backStake: 500, fancyStake: 500 },
        allowedSenders: ['admin', 'sender1'],
        ws: {
          readyState: WebSocket.OPEN,
          send: (data: string) => {
            try {
              const parsed = JSON.parse(data);
              if (parsed.type === 'bet') {
                const parent = recentBets.get(parsed.parentBetId);
                if (parent) {
                  parent.attempts[uname] = {
                    receiverUsername: uname,
                    status: 'ACCEPTED',
                    message: 'Simulated Execution in 28ms',
                    latencyMs: 28,
                    timestamp: Date.now(),
                  };
                }
              }
            } catch (e) {}
          },
        },
      });
      created++;
    }
  }
  broadcastReceiverCount();
  res.json({ success: true, connected: 25, new: created });
});

// -----------------------------------------------------------------------------
// WebSocket Protocol Implementation
// -----------------------------------------------------------------------------

wss.on('connection', (ws: WebSocket, req) => {
  const sessionId = Math.random().toString(36).substring(2, 12);
  const clientIp = req.socket.remoteAddress;

  const session: ClientSession = {
    id: sessionId,
    username: '',
    website: 'betin247',
    isSender: false,
    isLoggedIn: false,
    lastPing: Date.now(),
    currentPingMs: 0,
    stakes: { backStake: 0, fancyStake: 0 },
    allowedSenders: [],
    ws,
  };

  sessions.set(sessionId, session);
  console.log(`[WS] New connection [${sessionId}] from ${clientIp}`);

  ws.on('message', (raw) => {
    try {
      const msg: WebSocketMessage = JSON.parse(raw.toString());
      handleMessage(session, msg);
    } catch (err: any) {
      console.error(`[WS] Error parsing message from [${sessionId}]:`, err.message);
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Disconnected [${sessionId}] (User: ${session.username || 'anonymous'})`);
    sessions.delete(sessionId);
    broadcastReceiverCount();
  });

  ws.on('error', (err) => {
    console.error(`[WS] Socket error on [${sessionId}]:`, err);
  });
});

function handleMessage(session: ClientSession, msg: WebSocketMessage) {
  switch (msg.type) {
    case 'login': {
      const { username, password, website, fromDesktop } = msg.data || {};
      const user = USER_ROLES[username];

      if (!user || (password && user.pass !== password)) {
        session.ws.send(
          JSON.stringify({
            type: 'login',
            error: 'Invalid username or password',
          })
        );
        return;
      }

      session.username = username;
      session.website = website || 'betin247';
      session.isSender = user.isSender;
      session.isLoggedIn = true;
      session.allowedSenders = user.allowedSenders || [];

      // Response matching the client injector contract
      session.ws.send(
        JSON.stringify({
          type: 'login',
          data: {
            isSender: session.isSender,
            senders: session.isSender ? [] : ['admin', 'sender1'],
            username: session.username,
          },
          protection: true,
        })
      );

      console.log(
        `[WS] Login success: ${username} (${session.isSender ? 'SENDER' : 'RECEIVER'})`
      );
      broadcastReceiverCount();
      break;
    }

    case 'ping': {
      session.lastPing = Date.now();
      if (msg.data) {
        if (msg.data.odds) session.stakes.backStake = Number(msg.data.odds) || 0;
        if (msg.data.fancy) session.stakes.fancyStake = Number(msg.data.fancy) || 0;
      }
      session.ws.send(JSON.stringify({ type: 'pong' }));
      break;
    }

    case 'recieverCount': {
      const count = getActiveReceiverCount(session.username);
      session.ws.send(
        JSON.stringify({
          type: 'recieverCount',
          data: { recieverCount: count },
        })
      );
      break;
    }

    case 'sessionGeo': {
      if (msg.data) {
        session.geoInfo = msg.data;
        console.log(`[WS] Session Geo [${session.username}]:`, msg.data);
      }
      break;
    }

    case 'bet': {
      // ONLY authorized Senders can trigger bets
      if (!session.isSender || !session.isLoggedIn) {
        session.ws.send(
          JSON.stringify({
            type: 'betResult',
            error: 'Unauthorized: only Sender can place multi-ID bets',
          })
        );
        return;
      }

      executeMultiAccountBet(session, msg.data as BetData);
      break;
    }

    case 'betResult': {
      // Report from a receiver worker regarding execution status
      const { parentBetId, status, message, latencyMs } = msg.data || {};
      if (parentBetId && recentBets.has(parentBetId)) {
        const parent = recentBets.get(parentBetId)!;
        parent.attempts[session.username] = {
          receiverUsername: session.username,
          status: status || 'ACCEPTED',
          message: message || '',
          latencyMs: latencyMs || 0,
          timestamp: Date.now(),
        };
      }
      break;
    }

    case 'changePassword': {
      const { pass, type } = msg.data || {};
      if (USER_ROLES[session.username]) {
        USER_ROLES[session.username].pass = pass;
        session.ws.send(
          JSON.stringify({
            type: 'changePassword',
            data: { success: true },
          })
        );
      }
      break;
    }
  }
}

function getActiveReceiverCount(senderUsername: string): number {
  let count = 0;
  for (const s of sessions.values()) {
    if (s.isLoggedIn && !s.isSender) {
      if (s.allowedSenders.length === 0 || s.allowedSenders.includes(senderUsername)) {
        count++;
      }
    }
  }
  return count;
}

function broadcastReceiverCount() {
  for (const s of sessions.values()) {
    if (s.isLoggedIn && s.isSender && s.ws.readyState === WebSocket.OPEN) {
      const count = getActiveReceiverCount(s.username);
      s.ws.send(
        JSON.stringify({
          type: 'recieverCount',
          data: { recieverCount: count },
        })
      );
    }
  }
}

// -----------------------------------------------------------------------------
// Core Engine: Sub-Millisecond Multi-Account Bet Dispatcher
// -----------------------------------------------------------------------------
function executeMultiAccountBet(sender: ClientSession, betData: BetData) {
  const betId = `bet_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startTime = Date.now();

  console.log(
    `\n[BET SENDER] >>> ONE-CLICK BET TRIGGERED by ${sender.username} <<<`
  );
  console.log(
    `[BET DETAILS] Market: ${betData.marketName || 'MATCH'}, Runner: ${betData.betTitle || betData.selectionName}, Side: ${betData.side}, Rate: ${betData.rate}, Stake: ${betData.stake}`
  );

  const parentRequest: ParentBetRequest = {
    id: betId,
    senderUsername: sender.username,
    website: sender.website,
    betData,
    createdAt: startTime,
    totalReceiversTargeted: 0,
    attempts: {},
  };

  const wirePayload = JSON.stringify({
    type: 'bet',
    sender: sender.username,
    parentBetId: betId,
    data: betData,
  });

  let targetedCount = 0;

  // Ultra-fast parallel fan-out to all connected receiver WebSocket channels (15-30 IDs)
  for (const r of sessions.values()) {
    if (r.isLoggedIn && !r.isSender && r.ws.readyState === WebSocket.OPEN) {
      const isAllowed =
        r.allowedSenders.length === 0 || r.allowedSenders.includes(sender.username);

      if (isAllowed) {
        targetedCount++;
        parentRequest.attempts[r.username] = {
          receiverUsername: r.username,
          status: 'PENDING',
          message: 'Dispatched to receiver',
          latencyMs: 0,
          timestamp: Date.now(),
        };

        // Non-blocking parallel transmit
        r.ws.send(wirePayload);
      }
    }
  }

  parentRequest.totalReceiversTargeted = targetedCount;
  recentBets.set(betId, parentRequest);

  const dispatchTimeMs = Date.now() - startTime;
  console.log(
    `[BET DISPATCH] Sent to ${targetedCount} receiver accounts in ${dispatchTimeMs} ms!`
  );

  // Acknowledge sender
  sender.ws.send(
    JSON.stringify({
      type: 'betResult',
      data: {
        parentBetId: betId,
        receiversTargeted: targetedCount,
        dispatchLatencyMs: dispatchTimeMs,
        status: 'DISPATCHED',
      },
    })
  );
}

// Start server
server.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(` BETIN247 SENDER-RECEIVER ENGINE & WEBSOCKET HUB `);
  console.log(` Running on port ${PORT}`);
  console.log(` REST: http://localhost:${PORT}`);
  console.log(` WS:   ws://localhost:${PORT}`);
  console.log(`=======================================================`);
});
