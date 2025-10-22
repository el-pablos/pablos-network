import { Schema as MongooseSchema, Document, Types } from 'mongoose';
import type { Provider, Category, Severity } from '@pablos/contracts';

export interface FindingDocument extends Document {
  targetRef: Types.ObjectId;
  targetFqdn?: string;
  provider: Provider;
  category: Category;
  title: string;
  description?: string;
  severity: Severity;
  cvss?: number;
  evidenceFileId?: Types.ObjectId;
  fingerprint: string;
  metadata?: Record<string, any>;
}

export class Finding {}

export const FindingSchema = new MongooseSchema({
  targetRef: {
    type: MongooseSchema.Types.ObjectId,
    required: true,
    ref: 'Asset',
    index: true
  },
  targetFqdn: {
    type: String
  },
  provider: {
    type: String,
    required: true,
    enum: ['zoomEye', 'binaryEdge', 'dirsearch', 'zap', 'dns', 'reverseip', 'domainwatch', 'policy', 'seo', 'media']
  },
  category: {
    type: String,
    required: true,
    enum: ['DNS', 'WEB', 'NET', 'OSINT', 'POLICY', 'SEO', 'MEDIA'],
    index: true
  },
  title: {
    type: String,
    required: true
  },
  description: {
    type: String
  },
  severity: {
    type: String,
    required: true,
    enum: ['info', 'low', 'medium', 'high', 'critical'],
    index: true
  },
  cvss: {
    type: Number,
    min: 0,
    max: 10
  },
  evidenceFileId: {
    type: MongooseSchema.Types.ObjectId
  },
  fingerprint: {
    type: String,
    required: true
  },
  metadata: {
    type: MongooseSchema.Types.Mixed
  },
}, {
  timestamps: true,
  collection: 'findings'
});

// Unique compound index for idempotency
FindingSchema.index(
  { targetRef: 1, provider: 1, fingerprint: 1 },
  { unique: true }
);

// Query indexes
FindingSchema.index({ severity: 1, createdAt: -1 });
FindingSchema.index({ category: 1, severity: 1 });
FindingSchema.index({ targetFqdn: 1, severity: 1 });

