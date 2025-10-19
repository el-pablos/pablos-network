import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { QueueModule } from './queue/queue.module';
import { StreamsModule } from './streams/streams.module';
import { RealtimeModule } from './realtime/realtime.module';
import { ScopeController } from './api/scope.controller';
import { ScanController } from './api/scan.controller';
import { FindingsController } from './api/findings.controller';
import { AssetsController } from './api/assets.controller';
import {
  Asset,
  AssetSchema,
  Job,
  JobSchema,
  Finding,
  FindingSchema,
  Metric,
  MetricSchema,
  AuditLog,
  AuditLogSchema,
} from './schemas';

@Module({
  imports: [
    MongooseModule.forRoot(process.env.MONGODB_URI!, {
      dbName: 'pablos-network',
    }),
    MongooseModule.forFeature([
      { name: Asset.name, schema: AssetSchema },
      { name: Job.name, schema: JobSchema },
      { name: Finding.name, schema: FindingSchema },
      { name: Metric.name, schema: MetricSchema },
      { name: AuditLog.name, schema: AuditLogSchema },
    ]),
    QueueModule,
    StreamsModule,
    RealtimeModule,
  ],
  controllers: [
    ScopeController,
    ScanController,
    FindingsController,
    AssetsController,
  ],
})
export class AppModule {}

