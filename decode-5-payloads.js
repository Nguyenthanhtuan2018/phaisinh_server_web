// Decode 5 payloads to find lastSeq pattern
const payloads = [
  'AAAAAF0KJGJkMDQ1NmNhLTVjZmQtNGY1Yi05OWRhLTc4MmZlMjI3YWY1MxIJVk4zMEYyNTEyIDIqKHo3aVA5c0dxQjBiSipoUUt8dnE0dnpKSVM1fV9fY1pOKEF7eC1DZkA=',
  'AAAAAGIKJDAyZjc3ZDc4LTE5NWMtNGJjYS05NWQwLThhYjFiNTI2YTMxZRIJVk4zMEYyNTEyGIi5/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDdmNzkwYmNjLWI5YTMtNGQ2OS1iNzBjLWZiYjI1MGIxMjQ1YxIJVk4zMEYyNTEyGM23/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDQxZDlhZGI5LTA2YzMtNDM2NS1hOGNmLTQwMTU3YmRlZDY0YxIJVk4zMEYyNTEyGO61/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDg0ODg5ZjQ4LWIwZDgtNGZlMy1iZjkwLTg4NzA2MGFkNmJmNBIJVk4zMEYyNTEyGJi0/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA=='
];

function decodeVarint(buffer, pos) {
  let value = 0, shift = 0;
  while (pos < buffer.length) {
    const byte = buffer[pos++];
    value |= (byte & 0x7F) << shift;
    if ((byte & 0x80) === 0) break;
    shift += 7;
  }
  return { value, pos };
}

function parsePayload(base64) {
  const buffer = Buffer.from(base64, 'base64');
  
  // Skip gRPC frame header (5 bytes)
  let pos = 5;
  const result = { sessionId: '', symbol: '', lastSeq: null, limit: null, token: '' };
  
  while (pos < buffer.length) {
    const tag = buffer[pos++];
    const fieldNum = tag >> 3;
    const wireType = tag & 0x07;
    
    if (wireType === 2) { // Length-delimited
      const length = buffer[pos++];
      const data = buffer.subarray(pos, pos + length).toString('utf8');
      pos += length;
      
      if (fieldNum === 1) result.sessionId = data;
      else if (fieldNum === 2) result.symbol = data;
      else if (fieldNum === 5) result.token = data;
    } else if (wireType === 0) { // Varint
      const { value, pos: newPos } = decodeVarint(buffer, pos);
      pos = newPos;
      
      if (fieldNum === 3) result.lastSeq = value;
      else if (fieldNum === 4) result.limit = value;
    }
  }
  
  return result;
}

console.log('=== Analyzing 5 Payloads ===\n');

const results = [];
payloads.forEach((p, i) => {
  const parsed = parsePayload(p);
  results.push(parsed);
  console.log(`Payload ${i + 1}:`);
  console.log(`  sessionId: ${parsed.sessionId}`);
  console.log(`  symbol: ${parsed.symbol}`);
  console.log(`  lastSeq: ${parsed.lastSeq}`);
  console.log(`  limit: ${parsed.limit}`);
  console.log('');
});

console.log('=== lastSeq Pattern ===');
const seqs = results.map(r => r.lastSeq);
console.log('lastSeq values:', seqs);

for (let i = 1; i < seqs.length; i++) {
  if (seqs[i] !== null && seqs[i-1] !== null) {
    console.log(`Diff ${i}: ${seqs[i]} - ${seqs[i-1]} = ${seqs[i] - seqs[i-1]}`);
  } else if (seqs[i] !== null) {
    console.log(`Payload ${i+1} has lastSeq: ${seqs[i]}`);
  }
}
