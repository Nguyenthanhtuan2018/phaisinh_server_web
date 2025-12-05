import { Server as SocketIOServer } from 'socket.io';
import WebSocket from 'ws';
import protobuf from 'protobufjs';
import path from 'path';

let vpsWs: WebSocket | null = null;
let heartbeatTimer: NodeJS.Timeout | null = null;
let ioServer: SocketIOServer | null = null;
let LastSaleType: protobuf.Type | null = null;

// Config web4.vps.com.vn
const WS_URL = 'wss://web4.vps.com.vn/Push/socket.io/?EIO=3&transport=websocket';
const SYMBOL = '41I1FB000'; // VN30F2512
const HEARTBEAT_INTERVAL = 25000;

// Load protobuf schema
async function loadProtobuf() {
  try {
    // Load từ file .proto trong client/src/lib
    const protoPath = path.resolve(__dirname, '../../../client/src/lib/auto_trading.proto');
    const root = await protobuf.load(protoPath);
    LastSaleType = root.lookupType('market_api.LastSale');
    console.log('✅ Protobuf schema loaded from', protoPath);
  } catch (e) {
    console.warn('⚠️ Could not load .proto file, using inline schema');
    // Fallback: define inline
    const root = protobuf.Root.fromJSON({
      nested: {
        market_api: {
          nested: {
            LastSale: {
              fields: {
                marketCd: { type: 'string', id: 1 },
                secCd: { type: 'string', id: 2 },
                changePoint: { type: 'double', id: 3 },
                changePercent: { type: 'double', id: 4 },
                lastPrice: { type: 'double', id: 5 },
                lastQty: { type: 'double', id: 6 },
                lastAmt: { type: 'double', id: 7 },
                totalQty: { type: 'double', id: 8 },
                totalAmt: { type: 'double', id: 9 },
                hightPrice: { type: 'double', id: 10 },
                lowPrice: { type: 'double', id: 11 },
                avgPrice: { type: 'double', id: 12 },
                matTime: { type: 'int32', id: 15 }
              }
            }
          }
        }
      }
    });
    LastSaleType = root.lookupType('market_api.LastSale');
    console.log('✅ Protobuf schema loaded (inline)');
  }
}

// Decode protobuf binary
function decodeProtobuf(buffer: Buffer): any | null {
  if (!LastSaleType) return null;

  try {
    const decoded = LastSaleType.decode(buffer);
    return LastSaleType.toObject(decoded, {
      longs: Number,
      enums: Number,
      defaults: true
    });
  } catch (e) {
    return null;
  }
}

export const setupSocketIO = async (io: SocketIOServer): Promise<void> => {
  ioServer = io;
  console.log('📊 Socket.IO ready for connections');

  // Load protobuf first
  await loadProtobuf();

  // Connect to VPS WebSocket
  connectToVps();

  // Handle client connections
  io.on('connection', (socket) => {
    console.log('👤 Client connected:', socket.id);

    socket.on('subscribe', (symbols: string[]) => {
      console.log('📡 Client subscribed to:', symbols);
      symbols.forEach(symbol => socket.join(symbol));
    });

    socket.on('disconnect', () => {
      console.log('👤 Client disconnected:', socket.id);
    });
  });
};

function connectToVps() {
  if (vpsWs?.readyState === WebSocket.OPEN) return;

  console.log('🔌 Connecting to web4.vps.com.vn...');

  vpsWs = new WebSocket(WS_URL, {
    headers: {
      'Origin': 'https://smartoneweb.vps.com.vn',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
      'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    },
    handshakeTimeout: 10000
  });

  console.log('🔌 WebSocket created, waiting for connection...');

  vpsWs.on('open', () => {
    console.log('✅ Connected to VPS WebSocket (web4.vps.com.vn)');
    startHeartbeat();
  });

  vpsWs.on('message', (data: WebSocket.Data) => {
    console.log('📨 VPS message received, type:', typeof data, Buffer.isBuffer(data) ? `Buffer(${data.length})` : '');
    handleVpsMessage(data);
  });

  vpsWs.on('close', (code, reason) => {
    console.log('❌ VPS WebSocket closed:', code, reason.toString());
    stopHeartbeat();
    setTimeout(connectToVps, 3000);
  });

  vpsWs.on('error', (error) => {
    console.error('❌ VPS WebSocket error:', error.message);
  });

  vpsWs.on('unexpected-response', (req, res) => {
    console.error('❌ Unexpected response:', res.statusCode, res.statusMessage);
  });
}

function handleVpsMessage(data: WebSocket.Data) {
  // Binary data (protobuf)
  if (Buffer.isBuffer(data)) {
    const decoded = decodeProtobuf(data);
    if (decoded) {
      console.log('📦 Decoded:', decoded.secCd, decoded.lastPrice);
      // Forward decoded JSON to clients
      ioServer?.emit('vps-tick', decoded);
    }
    return;
  }

  const msg = data.toString();

  // Engine.IO open packet
  if (msg.startsWith('0')) {
    console.log('📡 Engine.IO handshake received');
    vpsWs?.send('40');
    return;
  }

  // Ping -> Pong
  if (msg === '2') {
    vpsWs?.send('3');
    return;
  }

  if (msg === '3') return;

  // Socket.IO connect ack
  if (msg === '40' || msg.startsWith('40{')) {
    console.log('✅ Socket.IO connected to VPS, subscribing...');
    subscribe();
    return;
  }

  // Binary event indicator
  if (msg.startsWith('451-') || msg.startsWith('45')) {
    return;
  }

  // Socket.IO event: 42[...]
  if (msg.startsWith('42')) {
    try {
      const jsonStr = msg.substring(2);
      const parsed = JSON.parse(jsonStr);
      ioServer?.emit('vps-event', parsed);
    } catch (e) {
      // ignore
    }
    return;
  }

  console.log('📩 Unknown:', msg.substring(0, 50));
}

function subscribe() {
  if (!vpsWs || vpsWs.readyState !== WebSocket.OPEN) return;

  const msg = {
    eventName: 'register',
    channelTopic: 'ticker',
    args: { channel: SYMBOL }
  };
  const message = `4${JSON.stringify(msg)}`;
  vpsWs.send(message);
  console.log('📡 Sent register:', message);
}

function startHeartbeat() {
  stopHeartbeat();
  heartbeatTimer = setInterval(() => {
    if (vpsWs?.readyState === WebSocket.OPEN) {
      vpsWs.send('2');
    }
  }, HEARTBEAT_INTERVAL);
}

function stopHeartbeat() {
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    heartbeatTimer = null;
  }
}

export const getVpsSocket = () => vpsWs;
