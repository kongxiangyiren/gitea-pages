import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from './config/config.module.js';
import { CacheModule } from './cache/cache.module.js';
import { PagesModule } from './pages/pages.module.js';
import { HealthModule } from './health/health.module.js';
import { RequestIdMiddleware } from './common/middleware/request-id.middleware.js';

// HealthModule 须在 PagesModule 之前导入：通配路由后注册，保证 /healthz 优先匹配
@Module({
  imports: [ConfigModule, CacheModule, HealthModule, PagesModule],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
