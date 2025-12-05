// Test single API call and check seq extraction
const crypto = require('crypto');

const GRPC_API_URL = 'https://web6.vps.com.vn/market_api.MarketApi/findSecIntraday';

function buildPayload(symbol, limit = 50, lastSeq) {
  const sessionId = crypto.randomUUID();
  const token = 'z7iP9sGqB0bJ*hQK|vq4vzJIS5}__cZN(A{x-Cf@';
  
  const parts = [];
  
  // Field 1: sessionId
  const sessionIdBytes = Buffer.from(sessionId, 'utf8');
  parts.push(0x0A, sessionIdBytes.length, ...sessionIdBytes);
  
  // Field 2: symbol
  const symbolBytes = Buffer.from(symbol, 'utf8');
  parts.push(0x12, symbolBytes.length, ...symbolBytes);
  
  // Field 3: lastSeq (if provided)
  if (lastSeq !== undefined) {
    parts.push(0x18);
    let v = lastSeq;
    while (v > 127) {
      parts.push((v & 0x7F) | 0x80);
      v = v >>> 7;
    }
    parts.push(v);
  }
  
  // Field 4: limit
  parts.push(0x20);
  let val = limit;
  while (val > 127) {
    parts.push((val & 0x7F) | 0x80);
    val = val >>> 7;
  }
  parts.push(val);
  
  // Field 5: token
  const tokenBytes = Buffer.from(token, 'utf8');
  parts.push(0x2A, tokenBytes.length, ...tokenBytes);
  
  const messageBuffer = Buffer.from(parts);
  const frame = Buffer.alloc(5 + messageBuffer.length);
  frame[0] = 0;
  frame.writeUInt32BE(messageBuffer.length, 1);
  messageBuffer.copy(frame, 5);
  
  return frame.toString('base64');
}

function decodeResponse(base64Data) {
  const buffer = Buffer.from(base64Data, 'base64');
  const results = [];
  const seqs = [];
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
    
    // Parse wrapper
    let pos = 0;
    while (pos < msgBytes.length) {
      const tag = msgBytes[pos++];
      const fieldNum = tag >> 3;
      const wireType = tag & 0x07;
      
      if (wireType === 2) {
        let length = 0, shift = 0;
        while (pos < msgBytes.length) {
          const b = msgBytes[pos++];
          length |= (b & 0x7F) << shift;
          if ((b & 0x80) === 0) break;
          shift += 7;
        }
        
        if (pos + length > msgBytes.length) break;
        const data = msgBytes.subarray(pos, pos + length);
        pos += length;
        
        if (fieldNum === 4) {
          const record = parseRecord(data);
          if (record) {
            results.push(record);
            if (record.seq) seqs.push(record.seq);
          }
        }
      } else if (wireType === 0) {
        while (pos < msgBytes.length && (msgBytes[pos++] & 0x80) !== 0) {}
      } else if (wireType === 1) {
        pos += 8;
      } else if (wireType === 5) {
        pos += 4;
      } else {
        break;
      }
    }
  }
  
  return { results, seqs };
}

function parseRecord(buffer) {
  let timeStr = '', price = 0, volume = 0, seq = null;
  let pos = 0;
  const allVarints = [];
  
  while (pos < buffer.length) {
    const tag = buffer[pos++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;
    
    if (wireType === 2) {
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
    } else if (wireType === 1) {
      if (pos + 8 > buffer.length) break;
      const val = buffer.readDoubleLE(pos);
      pos += 8;
      if (fieldNum === 2) price = val;
      else if (fieldNum === 3) volume = val;
    } else if (wireType === 0) {
      let v = 0, s = 0;
      while (pos < buffer.length) {
        const x = buffer[pos++];
        v |= (x & 0x7F) << s;
        if ((x & 0x80) === 0) break;
        s += 7;
      }
      allVarints.push({ field: fieldNum, value: v });
    }
  }
  
  // Find seq - look for large number in varints
  for (const vi of allVarints) {
    if (vi.value > 1000000) {
      seq = vi.value;
      break;
    }
  }
  
  if (timeStr && price > 0) {
    return { time: timeStr, price, volume, seq, varints: allVarints };
  }
  return null;
}

async function test() {
  console.log('=== Test API Call ===\n');
  
  // First call without lastSeq
  const payload1 = buildPayload('VN30F2512', 50);
  console.log('Request 1: no lastSeq');
  
  const resp1 = await fetch(GRPC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web-text',
      'Accept': 'application/grpc-web-text',
      'X-Grpc-Web': '1',
      'Origin': 'https://smartoneweb.vps.com.vn'
    },
    body: payload1
  });
  
  const data1 = await resp1.text();
  const { results: r1, seqs: s1 } = decodeResponse(data1);
  
  console.log(`Got ${r1.length} records`);
  console.log('Seqs:', s1.slice(0, 5), '...');
  console.log('Min seq:', Math.min(...s1));
  console.log('Max seq:', Math.max(...s1));
  
  if (r1.length > 0) {
    console.log('\nFirst record:', JSON.stringify(r1[0], null, 2));
    console.log('Last record:', JSON.stringify(r1[r1.length-1], null, 2));
  }
  
  // Second call with lastSeq = minSeq from first call
  const minSeq1 = Math.min(...s1);
  console.log('\n--- Request 2: lastSeq =', minSeq1, '---');
  
  const payload2 = buildPayload('VN30F2512', 50, minSeq1);
  const resp2 = await fetch(GRPC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web-text',
      'Accept': 'application/grpc-web-text',
      'X-Grpc-Web': '1',
      'Origin': 'https://smartoneweb.vps.com.vn'
    },
    body: payload2
  });
  
  const data2 = await resp2.text();
  const { results: r2, seqs: s2 } = decodeResponse(data2);
  
  console.log(`Got ${r2.length} records`);
  if (s2.length > 0) {
    console.log('Seqs:', s2.slice(0, 5), '...');
    console.log('Min seq:', Math.min(...s2));
    console.log('Max seq:', Math.max(...s2));
  }
}

test().catch(console.error);
