// Generate payload with custom limit
const sessionId = '8ab15b7a-dcab-4cc6-bec1-e8aec982bcac';
const symbol = 'VN30F2512';
const token = 'z7iP9sGqB0bJ*hQK|vq4vzJIS5}__cZN(A{x-CfA';
// No limit - get all data
const parts = [];

// Field 1: sessionId (tag=0x0A)
const sessionIdBytes = Buffer.from(sessionId, 'utf8');
parts.push(0x0A, sessionIdBytes.length, ...sessionIdBytes);

// Field 2: secCd/symbol (tag=0x12)
const symbolBytes = Buffer.from(symbol, 'utf8');
parts.push(0x12, symbolBytes.length, ...symbolBytes);

// Skip field 4 (limit) to get all data

// Field 5: token (tag=0x2A)
const tokenBytes = Buffer.from(token, 'utf8');
parts.push(0x2A, tokenBytes.length, ...tokenBytes);

const messageBuffer = Buffer.from(parts);

// gRPC-Web frame
const frame = Buffer.alloc(5 + messageBuffer.length);
frame[0] = 0;
frame.writeUInt32BE(messageBuffer.length, 1);
messageBuffer.copy(frame, 5);

console.log('Payload:', frame.toString('base64'));
console.log('Hex:', frame.toString('hex'));
