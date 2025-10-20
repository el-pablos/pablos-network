import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false, collection: 'audit_logs' })
export class AuditLog extends Document {
  @Prop({ type: String })
  userId?: string;

  @Prop({ required: true, type: String, index: true })
  action!: string;

  @Prop({ type: String })
  target?: string;

  @Prop({ type: Types.ObjectId })
  targetRef?: Types.ObjectId;

  @Prop({ type: String })
  jobId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop({ type: String })
  ipAddress?: string;

  @Prop({ type: String })
  userAgent?: string;

  @Prop({ required: true, type: Date, index: true })
  timestamp!: Date;

  @Prop({ type: Boolean, default: true })
  success!: boolean;

  @Prop({ type: String })
  error?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for audit queries
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ targetRef: 1, timestamp: -1 });

