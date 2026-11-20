# Đảo Đèn Lồng v1.0.0: web game + local leaderboard server.
#   docker build -t dao-den-long .
#   docker run --rm -p 8080:8080 -v ddl-data:/data dao-den-long      ->  http://localhost:8080
FROM node:22-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY server.js ./
COPY src ./src
COPY web ./web
ENV PORT=8080 DDL_DATA_DIR=/data
VOLUME /data
EXPOSE 8080
CMD ["node", "server.js"]
