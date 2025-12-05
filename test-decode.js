// Test decode gRPC response
const base64Data = `AAAABz8iIwoIMTQ6Mjk6NTkRAAAAAADgnkAZAAAAAAAAFEAgBCoDEgEyIiMKCDE0OjI5OjU5ETMzMzMz3Z5AGQAAAAAAAPA/IAQqAxIBMSIjCggxNDoyOTo1OREzMzMzM92eQBkAAAAAAAAAQCAEKgMSATEiIwoIMTQ6Mjk6NTkRAAAAAADenkAZAAAAAAAAEAgBCoDEgExIiMKCDE0OjI5OjU4EQAAAAAA4J5AGQAAAAAAABBAIAQqAxIBMiIjCggxNDoyOTo1OBGamZmZmd+eQBkAAAAAAAADwPyAEKgMSATI`;

const buffer = Buffer.from(base64Data, 'base64');
console.log('Buffer length:', buffer.length);
console.log('First 100 bytes hex:', buffer.subarray(0, 100).toString('hex'));

// Parse gRPC frame
let offset = 0;
const compressed = buffer[offset];
const msgLength = buffer.readUInt32BE(offset + 1);
console.log('Compressed:', compressed, 'MsgLength:', msgLength);
offset += 5;

const msgBytes = buffer.subarray(offset, offset + msgLength);
console.log('Message bytes:', msgBytes.toString('hex'));

// Parse protobuf
let pos = 0;
while (pos < msgBytes.length) {
  const tag = msgBytes[pos++];
  const fieldNum = tag >> 3;
  const wireType = tag & 0x07;
  console.log(`\nField ${fieldNum}, WireType ${wireType} at pos ${pos-1}`);
  
  if (wireType === 2) { // Length-delimited
    const length = msgBytes[pos++];
    const data = msgBytes.subarray(pos, pos + length);
    console.log('  Length:', length);
    console.log('  Data (string):', data.toString('utf8'));
    console.log('  Data (hex):', data.toString('hex'));
    pos += length;
  } else if (wireType === 1) { // 64-bit double
    const val = msgBytes.readDoubleLE(pos);
    console.log('  Double:', val);
    pos += 8;
  } else if (wireType === 0) { // Varint
    let value = 0, shift = 0;
    while (pos < msgBytes.length) {
      const b = msgBytes[pos++];
      value |= (b & 0x7F) << shift;
      if ((b & 0x80) === 0) break;
      shift += 7;
    }
    console.log('  Varint:', value);
  }
  
  if (pos > 50) break; // Limit output
}
