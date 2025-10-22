import { Schema as MongooseSchema, Document } from 'mongoose';

export interface MetricEntity {
  kind: 'job' | 'asset' | 'system';
  id: string;
}

export interface MetricDocument extends Document {
  ts: Date;
  entity: MetricEntity;
  name: string;
  value: number;
  unit?: string;
  metadata?: Record<string, any>;
}

export class Metric {}

export const MetricSchema = new MongooseSchema({
  ts: {
    type: Date,
    required: true,
    index: true
  },
  entity: {
    kind: {
      type: String,
      required: true,
      enum: ['job', 'asset', 'system']
    },
    id: {
      type: String,
      required: true
    },
  },
  name: {
    type: String,
    required: true,
    index: true
  },
  value: {
    type: Number,
    required: true
  },
  unit: {
    type: String
  },
  metadata: {
    type: MongooseSchema.Types.Mixed
  },
}, {
  timestamps: false,
  collection: 'metrics'
});

// Time-series indexes
MetricSchema.index({ ts: 1 });
MetricSchema.index({ 'entity.kind': 1, 'entity.id': 1, ts: -1 });
MetricSchema.index({ name: 1, ts: -1 });

// TTL index: expire after 14 days
MetricSchema.index({ ts: 1 }, { expireAfterSeconds: 14 * 24 * 60 * 60 });

