import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

@Schema({ timestamps: false, collection: 'audit_logs' })
export class AuditLog extends Document {
  @Prop()
  userId?: string;

  @Prop({ required: true, index: true })
  action: string;

  @Prop()
  target?: string;

  @Prop({ type: Types.ObjectId })
  targetRef?: Types.ObjectId;

  @Prop()
  jobId?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;

  @Prop()
  ipAddress?: string;

  @Prop()
  userAgent?: string;

  @Prop({ required: true, index: true })
  timestamp: Date;

  @Prop({ default: true })
  success: boolean;

  @Prop()
  error?: string;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// Indexes for audit queries
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ targetRef: 1, timestamp: -1 });

