FROM node:20-alpine

WORKDIR /workspace

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml nx.json tsconfig.json tsconfig.base.json jest.config.ts jest.preset.js eslint.config.mjs ./
COPY libs ./libs
COPY apps/demo-api ./apps/demo-api

RUN pnpm install --frozen-lockfile

EXPOSE 3000

CMD ["pnpm", "nx", "serve", "@nest-util/demo-api", "--host=0.0.0.0"]
