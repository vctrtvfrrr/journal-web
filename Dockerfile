FROM oven/bun:1.4.5 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build

FROM oven/bun:1.4.5-slim
WORKDIR /app
ENV NODE_ENV=production PORT=4000
COPY --from=build /app/dist/public ./dist/public
COPY server.ts ./
USER bun
EXPOSE 4000
CMD ["bun", "server.ts"]
