# Waves Analysis Server

Backend API cho ứng dụng phân tích sóng Elliott.

## Tech Stack

- Node.js + TypeScript
- Express.js
- Socket.IO
- MongoDB (Mongoose)
- Protobuf.js

## Cài đặt

```bash
npm install
```

## Development

```bash
npm run dev
```

Server chạy tại http://localhost:3000

## Build Production

```bash
npm run build
npm start
```

## Deploy

### Option 1: VPS (Ubuntu)

```bash
# 1. Clone repo
git clone your-repo.git
cd waves-server

# 2. Install dependencies
npm ci --production

# 3. Build
npm run build

# 4. Setup PM2
npm install -g pm2
pm2 start dist/index.js --name waves-server
pm2 save
pm2 startup
```

### Option 2: Docker

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

```bash
docker build -t waves-server .
docker run -d -p 3000:3000 --env-file .env waves-server
```

### Option 3: Docker Compose

```yaml
version: '3.8'
services:
  server:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/waves
    depends_on:
      - mongo

  mongo:
    image: mongo:6
    volumes:
      - mongo_data:/data/db

volumes:
  mongo_data:
```

## Cấu hình

File `.env`:

```env
NODE_ENV=development
PORT=3000
MONGODB_URI=mongodb://localhost:27017/waves-analysis
JWT_SECRET=your-secret-key

# VPS Data Feed
VPS_SOCKET_URL=https://bgdatafeed.vps.com.vn
VPS_SYMBOL=VN30F2512
```

## API Endpoints

### Intraday Data

```
GET /api/intraday/:symbol
```

Lấy full day tick data từ VPS.

**Response:**
```json
[
  { "time": 1733382000, "open": 1976.5, "high": 1976.5, "low": 1976.5, "close": 1976.5 },
  ...
]
```

## Cấu trúc

```
src/
├── index.ts          # Entry point
├── routes/
│   ├── intraday.ts   # VPS intraday API
│   └── waves.ts      # Waves analysis API
├── socket/
│   └── index.ts      # Socket.IO + VPS WebSocket
└── models/           # MongoDB models
```

## Tài liệu chi tiết

- [Intraday API](src/routes/INTRADAY_API.md) - Chi tiết về VPS gRPC-Web API

## Lưu ý Production

1. **Environment**: Set `NODE_ENV=production`
2. **MongoDB**: Dùng MongoDB Atlas hoặc self-hosted với replica set
3. **HTTPS**: Dùng reverse proxy (Nginx) với SSL
4. **Monitoring**: Setup PM2 monitoring hoặc Docker health checks
