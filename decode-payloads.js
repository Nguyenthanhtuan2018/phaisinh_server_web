// Decode multiple payloads to find pagination field
const payloads = [
  'AAAAGIKJDdmNzkwYmNjLWI5YTMINGQ2OS1iNzBjLWZiYjl1MGlxMjQ1YxlJVk4zMEYyNTEyGM23/RUgMiooejdpUDlzR3FCMGJ KKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAGIKJDAyZjc3ZDc4LTE5NWMiNGJjYS05NWQwLThhYjFiNTI2YTMxZRlJVk4zMEYyNTEyGII5/RUgMiooejdpUDlzR3FCMGJKKmhRS3x2cTR2ekpJUzV9X19jWk4oQXt4LUNmQA==',
  'AAAAAFDKJGikMDQ1NmNhLTVjZmQtNGY1Yi05OWRhLTc4MmZlMjl3YWY1MxlJVk4zMEYyNTEyDlqKHo3aVA5c0dxQjBiSipoUUt8dnE0dnpKSVM1fV9fY1pOKEF7eC1DZkA='
];

function decodePayload(base64) {
  try {
    const b = Buffer.from(base64.replace(/\s/g, ''), 'base64');
    console.log('Raw hex:', b.toString('hex'));
    let p = 5; // Skip gRPC frame header
    const fields = {};
    
    while (p < b.length) {
      const t = b[p++];
      const fn = t >> 3;
      const wt = t & 7;
      
      if (wt === 2) { // Length-delimited (string)
        const len = b[p++];
        const d = b.subarray(p, p + len);
        p += len;
        fields[`field${fn}`] = d.toString();
      } else if (wt === 0) { // Varint
        let v = 0, s = 0;
        while (p < b.length) {
          const x = b[p++];
          v |= (x & 0x7F) << s;
          if ((x & 0x80) === 0) break;
          s += 7;
        }
        fields[`field${fn}`] = v;
      }
    }
    return fields;
  } catch (e) {
    return { error: e.message };
  }
}

payloads.forEach((p, i) => {
  console.log(`\n=== Payload ${i + 1} ===`);
  console.log(decodePayload(p));
});
