import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

class MetricEntity {
  @Prop({ required: true, enum: ['job', 'asset', 'system'] })
  kind: 'job' | 'asset' | 'system';

  @Prop({ required: true })
  id: string;
}

@Schema({ timestamps: false, collection: 'metrics' })
export class Metric extends Document {
  @Prop({ required: true, index: true })
  ts: Date;

  @Prop({ required: true, type: MetricEntity })
  entity: MetricEntity;

  @Prop({ required: true, index: true })
  name: string;

  @Prop({ required: true })
  value: number;

  @Prop()
  unit?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const MetricSchema = SchemaFactory.createForClass(Metric);

// Time-series indexes
MetricSchema.index({ ts: 1 });
MetricSchema.index({ 'entity.kind': 1, 'entity.id': 1, ts: -1 });
MetricSchema.index({ name: 1, ts: -1 });

// TTL index: expire after 14 days
MetricSchema.index({ ts: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

