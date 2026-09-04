# 两阶段构建：tsdown 打包单文件（依赖全量内联）→ 极简运行镜像
FROM node:22-alpine AS build-stage
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json tsdown.config.ts ./
COPY src ./src
RUN npx tsdown

# 运行镜像：dist/main.mjs 已内联全部依赖，无需 node_modules / pnpm
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
# 运行期产物（file 缓存 runtime/cache）目录，挂载卷属主为 node(1000)
RUN mkdir -p runtime && chown node:node runtime
COPY --from=build-stage --chown=node:node /app/dist/main.mjs ./dist/main.mjs
# 默认外部配置（部署时通过卷挂载覆盖）
COPY --chown=node:node config.js ./config.js
USER node
EXPOSE 8360
CMD ["node", "dist/main.mjs"]
