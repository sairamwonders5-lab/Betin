FROM node:20-alpine

WORKDIR /app

# Copy dependency definitions and install
COPY server/package*.json ./
RUN npm install

# Copy TypeScript config and server source
COPY server/tsconfig.json ./
COPY server/src/ ./src/
COPY server/public/ ./public/
COPY injector/ ./public/injector/

# Compile TypeScript
RUN npm run build

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["node", "dist/server.js"]
