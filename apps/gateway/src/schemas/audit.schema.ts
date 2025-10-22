import { Schema as MongooseSchema, Document, Types } from 'mongoose';

export interface AuditLogDocument extends Document {
  userId?: string;
  action: string;
  target?: string;
  targetRef?: Types.ObjectId;
  jobId?: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
  success: boolean;
  error?: string;
}

export class AuditLog {}

export const AuditLogSchema = new MongooseSchema({
  userId: {
    type: String
  },
  action: {
    type: String,
    required: true,
    index: true
  },
  target: {
    type: String
  },
  targetRef: {
    type: MongooseSchema.Types.ObjectId
  },
  jobId: {
    type: String
  },
  metadata: {
    type: MongooseSchema.Types.Mixed
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    required: true,
    index: true
  },
  success: {
    type: Boolean,
    default: true
  },
  error: {
    type: String
  },
}, {
  timestamps: false,
  collection: 'audit_logs'
});

// Indexes for audit queries
AuditLogSchema.index({ timestamp: -1 });
AuditLogSchema.index({ userId: 1, timestamp: -1 });
AuditLogSchema.index({ action: 1, timestamp: -1 });
AuditLogSchema.index({ targetRef: 1, timestamp: -1 });

