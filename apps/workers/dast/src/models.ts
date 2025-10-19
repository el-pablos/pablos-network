import { model, Schema } from 'mongoose';

const FindingSchema = new Schema({
  targetRef: Schema.Types.ObjectId,
  targetFqdn: String,
  provider: String,
  category: String,
  title: String,
  description: String,
  severity: String,
  fingerprint: String,
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

FindingSchema.index({ targetRef: 1, provider: 1, fingerprint: 1 }, { unique: true });

const JobSchema = new Schema({
  jobId: String,
  type: String,
  targetRef: Schema.Types.ObjectId,
  targetFqdn: String,
  status: String,
  progress: Number,
  message: String,
  error: String,
  startedAt: Date,
  finishedAt: Date,
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

export const Finding = model('Finding', FindingSchema);
export const Job = model('Job', JobSchema);

