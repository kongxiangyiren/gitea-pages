import { Module } from '@nestjs/common';
import { PagesController } from './pages.controller.js';
import { GiteaModule } from '../gitea/gitea.module.js';

@Module({
  imports: [GiteaModule],
  controllers: [PagesController],
})
export class PagesModule {}
