# VPS Intraday API Documentation

## Tổng quan

API lấy dữ liệu giao dịch intraday từ VPS SmartOne thông qua gRPC-Web protocol.

## Endpoint

```
GET /api/intraday/:symbol
```

Ví dụ: `/api/intraday/VN30F2512`

## Cách hoạt động

### 1. gRPC-Web Request

**URL:** `https://web6.vps.com.vn/market_api.MarketApi/findSecIntraday`

**Headers:**
```
Content-Type: application/grpc-web-text
Accept: application/grpc-web-text
X-Grpc-Web: 1
Origin: https://smartoneweb.vps.com.vn
```

**Payload Structure (Protobuf):**
```
Field 1 (string): sessionId - UUID ngẫu nhiên
Field 2 (string): symbol - Mã chứng khoán (VN30F2512)
Field 3 (varint): lastSeq - Dùng cho pagination (optional)
Field 4 (varint): limit - Số records mỗi request (50-100)
Field 5 (string): token - Auth token cố định
```

### 2. Pagination Logic

- Request đầu tiên: không có `lastSeq` → lấy data mới nhất
- Response trả về `lastSeq` ở **wrapper message field 5**
- Request tiếp theo: dùng `lastSeq` từ response trước
- Lặp cho đến khi `lastSeq` không thay đổi hoặc không có data

**Ví dụ sequence:**
```
Request 1: lastSeq = null      → Response lastSeq = 46095496
Request 2: lastSeq = 46095496  → Response lastSeq = 46095309
Request 3: lastSeq = 46095309  → Response lastSeq = 46095086
...
```

### 3. Response Structure

**gRPC-Web Frame:**
```
Byte 0: compressed flag (0 = uncompressed, 0x80 = trailer)
Bytes 1-4: message length (big-endian)
Bytes 5+: protobuf message
```

**Wrapper Message:**
```
Field 4 (repeated): Intraday records
Field 5 (varint): lastSeq cho pagination
```

**Intraday Record:**
```
Field 1 (string): time - "HH:MM:SS" (Vietnam timezone)
Field 2 (double): price
Field 3 (double): volume
Field 4 (varint): side (4 = buy/sell)
Field 5 (bytes): nested data (ignored)
```

### 4. Timezone Handling

- API trả về time string ở Vietnam timezone (UTC+7)
- Server convert sang UTC: `utcHour = vietnamHour - 7`
- Client cộng lại offset để hiển thị: `displayTime = utcTime + 7*3600`

## Code Files

| File | Mô tả |
|------|-------|
| `server/src/routes/intraday.ts` | Main API route, pagination logic |
| `client/src/composables/useRefreshApi.ts` | Client fetch function |
| `client/src/stores/chart.ts` | Data aggregation (1s/1m/5m) |

## Cấu hình

```typescript
// server/src/routes/intraday.ts
const maxIterations = 1000;  // Max requests per fetch
const batchSize = 100;       // Records per request
const delay = 15;            // ms between requests
```

## Data Aggregation

Client tự động aggregate tick data thành OHLC candles:

- **1s**: Mỗi giây 1 nến
- **1m**: Mỗi phút 1 nến (bucket = floor(time/60)*60)
- **5m**: Mỗi 5 phút 1 nến (bucket = floor(time/300)*300)

## Debug Scripts

```bash
# Decode payload để xem structure
node server/decode-5-payloads.js

# Dump raw record bytes
node server/dump-raw.js

# Dump wrapper message
node server/dump-wrapper.js

# Test API call
node server/test-api-call.js
```

## Lưu ý

1. Token có thể thay đổi - cần update nếu API fail
2. Rate limiting: delay 15ms giữa các requests
3. Full day data: ~50,000 ticks → ~300 iterations
4. Thời gian giao dịch: 9:00-11:30 và 13:00-14:45
