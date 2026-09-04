import { Global, Module } from '@nestjs/common';
import { loadConfig } from './config.loader.js';
import { ConfigService } from './config.service.js';

/**
 * 全局配置模块：启动时读取 cwd 下外部 config.js（不存在则用默认值），
 * 以 ConfigService 提供类型化只读访问。
 */
@Global()
@Module({
  providers: [
    {
      provide: ConfigService,
      useFactory: () => new ConfigService(loadConfig()),
    },
  ],
  exports: [ConfigService],
})
export class ConfigModule {}
