import { model, Schema } from 'mongoose';

const AssetSchema = new Schema({
  type: { type: String, required: true },
  fqdn: String,
  parentFqdn: String,
  active: { type: Boolean, default: true },
  ip: [String],
  owner: String,
  verifiedAt: Date,
  consentToken: String,
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

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

export const Asset = model('Asset', AssetSchema);
export const Finding = model('Finding', FindingSchema);
export const Job = model('Job', JobSchema);

