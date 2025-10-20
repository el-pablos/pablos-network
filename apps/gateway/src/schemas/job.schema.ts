import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { JobStatus, Provider } from '@pablos/contracts';

@Schema({ timestamps: true, collection: 'jobs' })
export class Job extends Document {
  @Prop({ required: true, type: String })
  jobId!: string;

  @Prop({ required: true, type: String, enum: ['zoomEye', 'binaryEdge', 'dirsearch', 'zap', 'dns', 'reverseip', 'domainwatch', 'policy', 'seo', 'media'] })
  type!: Provider;

  @Prop({ required: true, type: Types.ObjectId, ref: 'Asset' })
  targetRef!: Types.ObjectId;

  @Prop({ type: String })
  targetFqdn?: string;

  @Prop({ required: true, type: String, enum: ['pending', 'running', 'done', 'failed', 'cancelled'], default: 'pending', index: true })
  status!: JobStatus;

  @Prop({ type: Number, default: 0, min: 0, max: 100 })
  progress!: number;

  @Prop({ type: String })
  message?: string;

  @Prop({ type: String })
  error?: string;

  @Prop({ type: Date })
  startedAt?: Date;

  @Prop({ type: Date })
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

