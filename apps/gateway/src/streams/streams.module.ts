import { Module, Global } from '@nestjs/common';
import { StreamsService } from './streams.service';

@Global()
@Module({
  providers: [StreamsService],
  exports: [StreamsService],
})
export class StreamsModule {}

