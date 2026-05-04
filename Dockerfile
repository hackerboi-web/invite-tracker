FROM node:20-slim AS base
WORKDIR /app
RUN npm install -g pnpm@10

# Install dependencies
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY lib/db/package.json lib/db/
COPY lib/api-spec/package.json lib/api-spec/
COPY lib/api-zod/package.json lib/api-zod/
COPY lib/api-client-react/package.json lib/api-client-react/
COPY artifacts/api-server/package.json artifacts/api-server/
COPY artifacts/dashboard/package.json artifacts/dashboard/
RUN pnpm install --frozen-lockfile

# Copy all source files
COPY . .

# Build dashboard then API server
RUN pnpm --filter @workspace/dashboard run build
RUN pnpm --filter @workspace/api-server run build

EXPOSE 8080
ENV PORT=8080
ENV NODE_ENV=production

CMD ["node", "--enable-source-maps", "./artifacts/api-server/dist/index.mjs"]
