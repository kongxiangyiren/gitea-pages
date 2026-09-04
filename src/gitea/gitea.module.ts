import { Module } from '@nestjs/common';
import { GiteaService } from './gitea.service.js';

@Module({
  providers: [GiteaService],
  exports: [GiteaService],
})
export class GiteaModule {}
