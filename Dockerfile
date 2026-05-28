FROM node:24.16.0-slim

WORKDIR /app
ENV NODE_ENV=production

RUN apt-get update \
  && apt-get install -y --no-install-recommends pandoc ca-certificates \
  && rm -rf /var/lib/apt/lists/*

COPY package.json ./package.json
COPY src ./src

USER node

EXPOSE 3010
HEALTHCHECK --interval=1m --timeout=5s CMD node -e "fetch('http://127.0.0.1:' + (process.env.PORT || 3010) + '/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

CMD ["node", "src/main.mjs"]
