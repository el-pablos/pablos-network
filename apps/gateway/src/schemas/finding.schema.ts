import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import type { Provider, Category, Severity } from '@pablos/contracts';

@Schema({ timestamps: true, collection: 'findings' })
export class Finding extends Document {
  @Prop({ required: true, type: Types.ObjectId, ref: 'Asset', index: true })
  targetRef: Types.ObjectId;

  @Prop()
  targetFqdn?: string;

  @Prop({ required: true, enum: ['zoomEye', 'binaryEdge', 'dirsearch', 'zap', 'dns', 'reverseip', 'domainwatch', 'policy', 'seo', 'media'] })
  provider: Provider;

  @Prop({ required: true, enum: ['DNS', 'WEB', 'NET', 'OSINT', 'POLICY', 'SEO', 'MEDIA'], index: true })
  category: Category;

  @Prop({ required: true })
  title: string;

  @Prop()
  description?: string;

  @Prop({ required: true, enum: ['info', 'low', 'medium', 'high', 'critical'], index: true })
  severity: Severity;

  @Prop({ min: 0, max: 10 })
  cvss?: number;

  @Prop({ type: Types.ObjectId })
  evidenceFileId?: Types.ObjectId;

  @Prop({ required: true })
  fingerprint: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const FindingSchema = SchemaFactory.createForClass(Finding);

// Unique compound index for idempotency
FindingSchema.index(
  { targetRef: 1, provider: 1, fingerprint: 1 },
  { unique: true }
);

// Query indexes
FindingSchema.index({ severity: 1, createdAt: -1 });
FindingSchema.index({ category: 1, severity: 1 });
FindingSchema.index({ targetFqdn: 1, severity: 1 });

