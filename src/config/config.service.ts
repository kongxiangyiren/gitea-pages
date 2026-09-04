import { Injectable } from '@nestjs/common';
import type { ResolvedConfig } from './config.types.js';

/** 类型化配置读取服务（配置在启动时一次性加载，运行期只读） */
@Injectable()
export class ConfigService {
  private readonly config: ResolvedConfig;

  constructor(config: ResolvedConfig) {
    this.config = config;
  }

  get<T extends keyof ResolvedConfig>(key: T): ResolvedConfig[T] {
    return this.config[key];
  }

  getAll(): Readonly<ResolvedConfig> {
    return this.config;
  }
}
