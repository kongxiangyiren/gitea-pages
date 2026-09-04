import { Controller, Get } from '@nestjs/common';
import { ConfigService } from '../config/config.service.js';

/** 探活端点：用于容器/反向代理健康检查 */
@Controller('healthz')
export class HealthController {
  constructor(private readonly config: ConfigService) {}

  @Get()
  check(): { status: 'ok'; giteaUrl: string } {
    return { status: 'ok', giteaUrl: this.config.get('giteaUrl') };
  }
}
