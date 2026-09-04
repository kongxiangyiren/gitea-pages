import { NestFactory } from '@nestjs/core';
import { Logger, ConsoleLogger } from '@nestjs/common';
import compression from 'compression';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { loadConfigSync } from './config/config.loader.js';

async function bootstrap() {
  // 启动时读外部 config.js（不存在则用默认值），失败直接退出——与原版「部署时改 config.js」体验一致
  const resolved = loadConfigSync();
  // 端口优先级：环境变量 PORT（容器/PaaS）> config.js 的 port > 默认 8360
  const envPort = Number(process.env.PORT);
  const port =
    Number.isFinite(envPort) && envPort > 0 ? envPort : resolved.port;

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: new ConsoleLogger({
      colors: process.env.NODE_ENV !== 'production',
    }),
  });
  const logger = new Logger('Bootstrap');

  // 子域名路由完全依赖 Host 头，必须信任反向代理（nginx/IIS 的 X-Forwarded-*）
  app.set('trust proxy', true);
  // 关闭 Express 默认的 X-Powered-By（业务头 X-Powered-By: gitea-pages 由 PagesController 注入）
  app.disable('x-powered-by');
  // gzip（threshold 取 config.gzip.threshold；enable=false 时不挂压缩）
  const { enable, threshold } = resolved.gzip;
  if (enable) {
    app.use(compression({ threshold }));
  }

  await app.listen(port, () => {
    logger.log(`Server listening on port ${port}`);
  });
}
await bootstrap();
