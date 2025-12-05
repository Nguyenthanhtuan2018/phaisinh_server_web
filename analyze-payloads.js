// Analyze 3 payloads to find lastSeq pattern
const payloads = [
  'AAAAAF0KJDhhYjE1YjdhLWRjYWItNGNjNi1iZWMxLWU4YWVjOTgyYmNhYxIJVk4zMEYyNTEyIDIqKHo3aVA5c0dxQjBiSipoUUt8dnE0dnpKSVM1fV9fY1pOKEF7eC1DZkA=',
  'AAAAAGIKJDg0ODg5ZjQ4LWIwZDgtNGZlMy1iZjkwLTg4NzA2MGFkNmJmNBIJVk4zMEYyNTEyGJi0/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAFDKJGikMDQ1NmNhLTVjZmQtNGY1Yi05OWRhLTc4MmZlMjl3YWY1MxlJVk4zMEYyNTEyDlqKHo3aVA5c0dxQjBiSipoUUt8dnE0dnpKSVM1fV9fY1pOKEF7eC1DZkA='
];

function decodePayload(base64, index) {
  const b = Buffer.from(base64, 'base64');
  console.log(`\n=== Payload ${index + 1} ===`);
  console.log('Length:', b.length);
  
  let p = 5; // Skip gRPC frame header
  while (p < b.length) {
    const t = b[p++];
    const fn = t >> 3;
    const wt = t & 7;
    
    if (wt === 2) { // String
      const len = b[p++];
      const str = b.subarray(p, p + len).toString('utf8');
      p += len;
      console.log(`Field ${fn} (string): "${str}"`);
    } else if (wt === 0) { // Varint
      let v = 0, s = 0;
      while (p < b.length) {
        const x = b[p++];
        v |= (x & 0x7F) << s;
        if ((x & 0x80) === 0) break;
        s += 7;
      }
      console.log(`Field ${fn} (varint): ${v}`);
    }
  }
}

payloads.forEach((p, i) => decodePayload(p, i));
