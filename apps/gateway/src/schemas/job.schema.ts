import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { JobStatus, Provider } from '@pablos/contracts';

@Schema({ timestamps: true, collection: 'jobs' })
export class Job extends Document {
  @Prop({ required: true })
  jobId: string;

  @Prop({ required: true, enum: ['zoomEye', 'binaryEdge', 'dirsearch', 'zap', 'dns', 'reverseip', 'domainwatch', 'policy', 'seo', 'media'] })
  type: Provider;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Asset' })
  targetRef: Types.ObjectId;

  @Prop()
  targetFqdn?: string;

  @Prop({ required: true, enum: ['pending', 'running', 'done', 'failed', 'cancelled'], default: 'pending', index: true })
  status: JobStatus;

  @Prop({ default: 0, min: 0, max: 100 })
  progress: number;

  @Prop()
  message?: string;

  @Prop()
  error?: string;

  @Prop()
  startedAt?: Date;

  @Prop()
  finishedAt?: Date;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const JobSchema = SchemaFactory.createForClass(Job);

// Indexes for efficient queries
JobSchema.index({ jobId: 1 }, { unique: true });
JobSchema.index({ status: 1, updatedAt: -1 });
JobSchema.index({ targetRef: 1, type: 1 });
JobSchema.index({ type: 1, status: 1 });

