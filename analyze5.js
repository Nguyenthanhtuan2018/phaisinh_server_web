// Analyze 5 payloads to find lastSeq pattern
const payloads = [
  'AAAAAF0KJGJkMDQ1NmNhLTVjZmQtNGY1Yi05OWRhLTc4MmZlMjI3YWY1MxIJVk4zMEYyNTEyIDIqKHo3aVA5c0dxQjBiSipoUUt8dnE0dnpKSVM1fV9fY1pOKEF7eC1DZkA=',
  'AAAAAGIKJDAyZjc3ZDc4LTE5NWMtNGJjYS05NWQwLThhYjFiNTI2YTMxZRIJVk4zMEYyNTEyGIi5/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDdmNzkwYmNjLWI5YTMtNGQ2OS1iNzBjLWZiYjI1MGIxMjQ1YxIJVk4zMEYyNTEyGM23/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDQxZDlhZGI5LTA2YzMtNDM2NS1hOGNmLTQwMTU3YmRlZDY0YxIJVk4zMEYyNTEyGO61/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDg0ODg5ZjQ4LWIwZDgtNGZlMy1iZjkwLTg4NzA2MGFkNmJmNBIJVk4zMEYyNTEyGJi0/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA=='
];

function decodePayload(base64, index) {
  const b = Buffer.from(base64, 'base64');
  console.log(`\n=== Payload ${index + 1} (len=${b.length}) ===`);
  
  let p = 5;
  const fields = {};
  while (p < b.length) {
    const t = b[p++];
    const fn = t >> 3;
    const wt = t & 7;
    
    if (wt === 2) {
      const len = b[p++];
      const str = b.subarray(p, p + len).toString('utf8');
      p += len;
      fields[`f${fn}`] = str;
    } else if (wt === 0) {
      let v = 0, s = 0;
      while (p < b.length) {
        const x = b[p++];
        v |= (x & 0x7F) << s;
        if ((x & 0x80) === 0) break;
        s += 7;
      }
      fields[`f${fn}`] = v;
    }
  }
  
  console.log('sessionId:', fields.f1);
  console.log('symbol:', fields.f2);
  console.log('lastSeq (f3):', fields.f3 || 'NOT SET');
  console.log('limit (f4):', fields.f4);
  return fields.f3;
}

const seqs = payloads.map((p, i) => decodePayload(p, i));
console.log('\n=== Summary ===');
console.log('lastSeq values:', seqs);
console.log('Differences:', seqs.slice(1).map((s, i) => seqs[i] ? s - seqs[i] : 'N/A'));
