import { Global, Module } from '@nestjs/common';
import { Keyv } from 'keyv';
import { createKeyv } from '@keyv/redis';
import { KeyvFile } from 'keyv-file';
import { join, resolve } from 'node:path';
import { promises as dns } from 'node:dns';
import { PAGE_CACHE, CNAME_RESOLVER } from './cache.constants.js';
import { ConfigService } from '../config/config.service.js';
import { PagesCacheService } from './pages-cache.service.js';
import { RUNTIME_PATH } from '../paths.js';
import type { PagesConfig } from '../config/config.types.js';

/**
 * 全局缓存模块：基于 Keyv，与原 ThinkJS 版配置格式一致（cache.type）。
 * - type: 'file'（默认）→ 落盘 ./runtime/cache，重启不丢（keyv-file）
 * - type: 'redis'      → Redis store，多实例部署共享（@keyv/redis）
 * - type: 'memory'     → 纯内存
 * 键名与 TTL（10 分钟）与原版保持一致，见 PagesCacheService。
 */
@Global()
@Module({
  providers: [
    {
      provide: PAGE_CACHE,
      useFactory: async (configService: ConfigService) => {
        const cacheConfig = configService.get('cache');
        const type = cacheConfig?.type ?? 'file';

        // 注意：Keyv v5 显式传 store: undefined 会破坏默认内存 store，必须走独立分支
        if (type === 'redis') {
          const redis = cacheConfig?.redis;
          if (!redis) {
            throw new Error("cache.type 为 'redis' 时必须配置 cache.redis");
          }
          return await createVerifiedRedisStore(buildRedisUri(redis));
        }
        if (type === 'memory') {
          return new Keyv({ namespace: 'gitea-pages' });
        }
        // file（默认）
        const filename = resolve(
          cacheConfig?.file?.dir ?? join(RUNTIME_PATH, 'cache', 'data.json'),
        );
        return new Keyv({
          store: new KeyvFile({
            filename,
            expiredCheckDelay:
              cacheConfig?.file?.gcInterval ?? 24 * 60 * 60 * 1000,
          }),
          namespace: 'gitea-pages',
        });
      },
      inject: [ConfigService],
    },
    PagesCacheService,
    {
      // CNAME DNS 解析（替代原版阻塞的 dns-sync，改为 node:dns 异步实现；测试可替换）
      provide: CNAME_RESOLVER,
      useValue: async (host: string) => {
        try {
          return await dns.resolveCname(host);
        } catch {
          return [];
        }
      },
    },
  ],
  exports: [PAGE_CACHE, PagesCacheService, CNAME_RESOLVER],
})
export class CacheModule {}

/**
 * 创建 Redis store 并立即探活。
 * createKeyv 默认惰性连接 + 无限重连（首条命令才真正连，失败静默重试）——
 * 缓存故障会被掩盖为"永远 miss"。这里：
 * 1. 传 connectionTimeout 让 getClient() 的 connect() 在 5s 内结束
 * 2. throwOnConnectError 让连接失败抛错而非仅 emit error
 * 3. 启动时主动 getClient()+ping()，失败直接抛错让进程退出（fail-fast）
 */
async function createVerifiedRedisStore(uri: string): Promise<Keyv> {
  const store = createKeyv(uri, {
    namespace: 'gitea-pages',
    connectionTimeout: REDIS_CONNECT_TIMEOUT_MS,
    throwOnConnectError: true,
  });
  // createKeyv 返回 Keyv，其 store 是 KeyvRedis 实例（含 getClient/disconnect(force)）
  const redisStore = store.store as unknown as {
    getClient(): Promise<{ ping(): Promise<unknown> }>;
    disconnect(force?: boolean): Promise<void>;
  };
  try {
    const client = await redisStore.getClient();
    await client.ping();
  } catch (error) {
    await redisStore.disconnect(true).catch(() => {});
    throw new Error(
      `Redis 连接失败（${uri}）: ${(error as Error).message}。请检查 config.js 的 cache.redis 配置或 Redis 服务状态。`,
    );
  }
  return store;
}

/** Redis 连接探活超时（毫秒） */
const REDIS_CONNECT_TIMEOUT_MS = 5000;

/**
 * 把 config.cache.redis 配置归一化为 ioredis 连接 URI。
 * 支持两种写法：
 * - 字符串：原样透传（'redis://host:port/db'）
 * - 对象（与原 ThinkJS 版一致）：{ host, port, username?, password?, db? }
 */
function buildRedisUri(
  redis: NonNullable<PagesConfig['cache']>['redis'],
): string {
  if (typeof redis === 'string') {
    return redis;
  }
  if (!redis) {
    throw new Error('config.cache.redis 配置为空');
  }
  const { host = '127.0.0.1', port = 6379, username, password, db = 0 } = redis;
  const auth =
    (username ?? password) ? `${username ?? ''}:${password ?? ''}@` : '';
  return `redis://${auth}${host}:${port}/${db}`;
}
