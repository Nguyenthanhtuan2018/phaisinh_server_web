import { Router } from 'express';
import crypto from 'crypto';

const router = Router();

const GRPC_API_URL = 'https://web6.vps.com.vn/market_api.MarketApi/findSecIntraday';

// Build gRPC-Web request payload with optional lastSeq for pagination
function buildPayloadWithSeq(symbol: string, limit: number = 50, lastSeq?: number): string {
  // Use random UUID for sessionId (like browser does)
  const sessionId = crypto.randomUUID();
  const token = 'z7iP9sGqB0bJ*hQK|vq4vzJIS5}__cZN(A{x-Cf@';
  
  const parts: number[] = [];
  
  // Field 1: sessionId (tag=0x0A)
  const sessionIdBytes = Buffer.from(sessionId, 'utf8');
  parts.push(0x0A, sessionIdBytes.length, ...sessionIdBytes);
  
  // Field 2: secCd/symbol (tag=0x12)
  const symbolBytes = Buffer.from(symbol, 'utf8');
  parts.push(0x12, symbolBytes.length, ...symbolBytes);
  
  // Field 3: lastSeq (tag=0x18) - for pagination
  if (lastSeq !== undefined) {
    parts.push(0x18);
    let v = lastSeq;
    while (v > 127) {
      parts.push((v & 0x7F) | 0x80);
      v = v >>> 7;
    }
    parts.push(v);
  }
  
  // Field 4: limit (tag=0x20)
  parts.push(0x20);
  let val = limit;
  while (val > 127) {
    parts.push((val & 0x7F) | 0x80);
    val = val >>> 7;
  }
  parts.push(val);
  
  // Field 5: token (tag=0x2A)
  const tokenBytes = Buffer.from(token, 'utf8');
  parts.push(0x2A, tokenBytes.length, ...tokenBytes);
  
  const messageBuffer = Buffer.from(parts);
  
  // gRPC-Web frame
  const frame = Buffer.alloc(5 + messageBuffer.length);
  frame[0] = 0;
  frame.writeUInt32BE(messageBuffer.length, 1);
  messageBuffer.copy(frame, 5);
  
  return frame.toString('base64');
}

router.get('/:symbol', async (req, res) => {
  try {
    const { symbol } = req.params;
    console.log('[Intraday] Fetching full day data for:', symbol);

    const allCandles: any[] = [];
    let nextSeq: number | undefined = undefined;
    let iterations = 0;
    const maxIterations = 1000; // Enough for full day
    const batchSize = 100;
    
    while (iterations < maxIterations) {
      iterations++;
      
      const payload = buildPayloadWithSeq(symbol, batchSize, nextSeq);
      
      const response = await fetch(GRPC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/grpc-web-text',
          'Accept': 'application/grpc-web-text',
          'X-Grpc-Web': '1',
          'Origin': 'https://smartoneweb.vps.com.vn'
        },
        body: payload
      });

      if (!response.ok) {
        console.log(`[Intraday] Iteration ${iterations} failed: HTTP ${response.status}`);
        break;
      }

      const base64Data = await response.text();
      const { candles, lastSeq } = decodeGrpcResponseWithSeq(base64Data);
      
      if (candles.length === 0) {
        console.log(`[Intraday] No more data at iteration ${iterations}`);
        break;
      }
      
      allCandles.push(...candles);
      
      if (iterations <= 5 || iterations % 20 === 0) {
        console.log(`[Intraday] Iter ${iterations}: got ${candles.length}, lastSeq=${lastSeq}, total=${allCandles.length}`);
      }
      
      // Stop if lastSeq is same as what we requested (no more data)
      if (lastSeq === undefined) {
        console.log('[Intraday] Reached end (lastSeq undefined)');
        break;
      }
      
      if (lastSeq === nextSeq) {
        console.log('[Intraday] Reached end (lastSeq same as request:', lastSeq, ')');
        break;
      }
      
      nextSeq = lastSeq;
      
      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 15));
    }
    
    // Sort by time and deduplicate
    allCandles.sort((a, b) => a.time - b.time);
    
    // Deduplicate by time
    const uniqueCandles: any[] = [];
    let lastTime = 0;
    for (const c of allCandles) {
      if (c.time !== lastTime) {
        uniqueCandles.push(c);
        lastTime = c.time;
      }
    }
    
    console.log(`[Intraday] Total: ${allCandles.length}, unique: ${uniqueCandles.length}`);
    res.json(uniqueCandles);
  } catch (error: any) {
    console.error('[Intraday] Error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

export default router;


function decodeGrpcResponseWithSeq(base64Data: string): { candles: any[], lastSeq?: number } {
  try {
    const buffer = Buffer.from(base64Data, 'base64');
    const results: any[] = [];
    let lastSeq: number | undefined = undefined;
    let offset = 0;
    
    while (offset < buffer.length) {
      if (offset + 5 > buffer.length) break;
      
      const compressed = buffer[offset];
      const msgLength = buffer.readUInt32BE(offset + 1);
      offset += 5;
      
      if (msgLength === 0 || offset + msgLength > buffer.length) break;
      if (compressed === 0x80) { offset += msgLength; continue; }
      
      const msgBytes = buffer.subarray(offset, offset + msgLength);
      offset += msgLength;
      
      const { records, seq } = parseWrapperMessage(msgBytes);
      results.push(...records);
      
      // Field 5 in wrapper is the lastSeq for pagination
      if (seq !== undefined) lastSeq = seq;
    }
    
    return { candles: results, lastSeq };
  } catch (e) {
    console.error('Decode error:', e);
    return { candles: [] };
  }
}

// Parse wrapper message containing repeated intraday records (field 4) and lastSeq (field 5)
function parseWrapperMessage(buffer: Buffer): { records: any[], seq?: number } {
  const records: any[] = [];
  let seq: number | undefined = undefined;
  let pos = 0;
  
  try {
    while (pos < buffer.length) {
      const tag = buffer[pos++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;
      
      if (wireType === 2) { // Length-delimited
        let length = 0, shift = 0;
        while (pos < buffer.length) {
          const b = buffer[pos++];
          length |= (b & 0x7F) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
        }
        
        if (pos + length > buffer.length) break;
        const data = buffer.subarray(pos, pos + length);
        pos += length;
        
        // Field 4 contains the intraday records
        if (fieldNum === 4) {
          const record = parseIntradayRecord(data);
          if (record) records.push(record);
        }
      } else if (wireType === 0) { // Varint
        let v = 0, s = 0;
        while (pos < buffer.length) {
          const x = buffer[pos++];
          v |= (x & 0x7F) << s;
          if ((x & 0x80) === 0) break;
          s += 7;
        }
        // Field 5 is lastSeq for pagination
        if (fieldNum === 5) seq = v;
      } else if (wireType === 1) { // 64-bit - skip
        pos += 8;
      } else if (wireType === 5) { // 32-bit - skip
        pos += 4;
      } else {
        break;
      }
    }
  } catch (e) {
    console.error('Parse wrapper error:', e);
  }
  
  return { records, seq };
}

// Parse a single intraday record
function parseIntradayRecord(buffer: Buffer): any | null {
  try {
    let timeStr = '';
    let price = 0;
    let volume = 0;
    let pos = 0;
    
    while (pos < buffer.length) {
      const tag = buffer[pos++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;
      
      if (wireType === 2) { // Length-delimited (string)
        let length = 0, shift = 0;
        while (pos < buffer.length) {
          const b = buffer[pos++];
          length |= (b & 0x7F) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
        }
        if (pos + length > buffer.length) break;
        const str = buffer.subarray(pos, pos + length).toString('utf8');
        pos += length;
        
        if (fieldNum === 1) timeStr = str;
      } else if (wireType === 1) { // 64-bit (double)
        if (pos + 8 > buffer.length) break;
        const val = buffer.readDoubleLE(pos);
        pos += 8;
        
        if (fieldNum === 2) price = val;
        else if (fieldNum === 3) volume = val;
      } else if (wireType === 0) { // Varint - skip
        while (pos < buffer.length && (buffer[pos++] & 0x80) !== 0) {}
      }
    }
    
    if (timeStr && price > 0) {
      const now = new Date();
      const [h, m, s] = timeStr.split(':').map(Number);
      if (!isNaN(h) && !isNaN(m) && !isNaN(s)) {
        const year = now.getFullYear();
        const month = now.getMonth();
        const day = now.getDate();
        // timeStr is Vietnam time (UTC+7), convert to UTC by subtracting 7 hours
        const utcHour = h - 7;
        const date = new Date(Date.UTC(year, month, day, utcHour, m, s));
        const unixTime = Math.floor(date.getTime() / 1000);
        
        return {
          time: unixTime,
          open: price,
          high: price,
          low: price,
          close: price,
          volume: volume || 0
        };
      }
    }
    
    return null;
  } catch (e) {
    return null;
  }
}
