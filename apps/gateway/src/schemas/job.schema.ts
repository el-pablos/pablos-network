import { Schema as MongooseSchema, Document, Types } from 'mongoose';
import type { JobStatus, Provider } from '@pablos/contracts';

export interface JobDocument extends Document {
  jobId: string;
  type: Provider;
  targetRef: Types.ObjectId;
  targetFqdn?: string;
  status: JobStatus;
  progress: number;
  message?: string;
  error?: string;
  startedAt?: Date;
  finishedAt?: Date;
  metadata?: Record<string, any>;
}

export class Job {}

export const JobSchema = new MongooseSchema({
  jobId: {
    type: String,
    required: true
  },
  type: {
    type: String,
    required: true,
    enum: ['zoomEye', 'binaryEdge', 'dirsearch', 'zap', 'dns', 'reverseip', 'domainwatch', 'policy', 'seo', 'media']
  },
  targetRef: {
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'Asset'
  },
  targetFqdn: {
    type: String
  },
  status: {
    type: String,
    required: true,
    enum: ['pending', 'running', 'done', 'failed', 'cancelled'],
    default: 'pending',
    index: true
  },
  progress: {
    type: Number,
    default: 0,
    min: 0,
    max: 100
  },
  message: {
    type: String
  },
  error: {
    type: String
  },
  startedAt: {
    type: Date
  },
  finishedAt: {
    type: Date
  },
  metadata: {
    type: MongooseSchema.Types.Mixed
  },
}, {
  timestamps: true,
  collection: 'jobs'
});

// Indexes for efficient queries
JobSchema.index({ jobId: 1 }, { unique: true });
JobSchema.index({ status: 1, updatedAt: -1 });
JobSchema.index({ targetRef: 1, type: 1 });
JobSchema.index({ type: 1, status: 1 });

