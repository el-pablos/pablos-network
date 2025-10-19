import { Module } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { ProgressController } from './progress.controller';

@Module({
  providers: [RealtimeGateway],
  controllers: [ProgressController],
  exports: [RealtimeGateway],
})
export class RealtimeModule {}

