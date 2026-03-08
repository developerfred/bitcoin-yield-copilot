FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Instala TUDO (incluindo devDeps para poder buildar)
RUN npm ci

# Builda o projeto
RUN npm run build

# Remove devDeps depois do build
RUN npm prune --production

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

USER nodejs

EXPOSE 3000

CMD ["node", "dist/index.js"]