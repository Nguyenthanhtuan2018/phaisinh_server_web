// Dump wrapper message to find seq
const crypto = require('crypto');

const GRPC_API_URL = 'https://web6.vps.com.vn/market_api.MarketApi/findSecIntraday';

function buildPayload(symbol, limit = 50, lastSeq) {
  const sessionId = crypto.randomUUID();
  const token = 'z7iP9sGqB0bJ*hQK|vq4vzJIS5}__cZN(A{x-Cf@';
  
  const parts = [];
  parts.push(0x0A, ...encodeString(sessionId));
  parts.push(0x12, ...encodeString(symbol));
  if (lastSeq !== undefined) {
    parts.push(0x18, ...encodeVarint(lastSeq));
  }
  parts.push(0x20, ...encodeVarint(limit));
  parts.push(0x2A, ...encodeString(token));
  
  const messageBuffer = Buffer.from(parts);
  const frame = Buffer.alloc(5 + messageBuffer.length);
  frame[0] = 0;
  frame.writeUInt32BE(messageBuffer.length, 1);
  messageBuffer.copy(frame, 5);
  
  return frame.toString('base64');
}

function encodeString(str) {
  const bytes = Buffer.from(str, 'utf8');
  return [bytes.length, ...bytes];
}

function encodeVarint(val) {
  const result = [];
  while (val > 127) {
    result.push((val & 0x7F) | 0x80);
    val = val >>> 7;
  }
  result.push(val);
  return result;
}

function dumpMessage(buffer, indent = '') {
  let pos = 0;
  while (pos < buffer.length) {
    const startPos = pos;
    const tag = buffer[pos++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;
    
    let value;
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
      
      // Try as string
      const str = data.toString('utf8');
      if (/^[\x20-\x7E]+$/.test(str) && str.length < 50) {
        console.log(`${indent}Field ${fieldNum}: string "${str}"`);
      } else if (fieldNum === 4) {
        console.log(`${indent}Field ${fieldNum}: record[${length}]`);
        // Don't recurse into records
      } else {
        console.log(`${indent}Field ${fieldNum}: message[${length}]`);
        // Try to parse as nested message
        try {
          dumpMessage(data, indent + '  ');
        } catch (e) {
          console.log(`${indent}  (raw: ${data.toString('hex').substring(0, 40)}...)`);
        }
      }
    } else if (wireType === 1) { // 64-bit
      if (pos + 8 > buffer.length) break;
      const double = buffer.readDoubleLE(pos);
      pos += 8;
      console.log(`${indent}Field ${fieldNum}: double ${double}`);
    } else if (wireType === 0) { // Varint
      let v = 0n, s = 0n;
      while (pos < buffer.length) {
        const x = buffer[pos++];
        v |= BigInt(x & 0x7F) << s;
        if ((x & 0x80) === 0) break;
        s += 7n;
      }
      console.log(`${indent}Field ${fieldNum}: varint ${v}`);
    } else if (wireType === 5) { // 32-bit
      if (pos + 4 > buffer.length) break;
      const float = buffer.readFloatLE(pos);
      pos += 4;
      console.log(`${indent}Field ${fieldNum}: float ${float}`);
    } else {
      console.log(`${indent}Field ${fieldNum}: unknown wireType ${wireType}`);
      break;
    }
  }
}

async function test() {
  const payload = buildPayload('VN30F2512', 3); // Only 3 records
  
  const resp = await fetch(GRPC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/grpc-web-text',
      'Accept': 'application/grpc-web-text',
      'X-Grpc-Web': '1',
      'Origin': 'https://smartoneweb.vps.com.vn'
    },
    body: payload
  });
  
  const data = await resp.text();
  const buffer = Buffer.from(data, 'base64');
  
  console.log('Response length:', buffer.length);
  
  let offset = 0;
  while (offset < buffer.length) {
    if (offset + 5 > buffer.length) break;
    
    const compressed = buffer[offset];
    const msgLength = buffer.readUInt32BE(offset + 1);
    offset += 5;
    
    if (msgLength === 0 || offset + msgLength > buffer.length) break;
    
    console.log(`\n=== Frame: compressed=${compressed}, length=${msgLength} ===`);
    
    if (compressed === 0x80) {
      // Trailer frame
      const trailer = buffer.subarray(offset, offset + msgLength).toString('utf8');
      console.log('Trailer:', trailer);
      offset += msgLength;
      continue;
    }
    
    const msgBytes = buffer.subarray(offset, offset + msgLength);
    offset += msgLength;
    
    console.log('Wrapper message:');
    dumpMessage(msgBytes, '  ');
  }
}

test().catch(console.error);
