import { model, Schema } from 'mongoose';

// Reuse schemas from gateway
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
  targetRef: { type: Schema.Types.ObjectId, required: true },
  targetFqdn: String,
  provider: { type: String, required: true },
  category: { type: String, required: true },
  title: { type: String, required: true },
  description: String,
  severity: { type: String, required: true },
  cvss: Number,
  evidenceFileId: Schema.Types.ObjectId,
  fingerprint: { type: String, required: true },
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

FindingSchema.index({ targetRef: 1, provider: 1, fingerprint: 1 }, { unique: true });

const JobSchema = new Schema({
  jobId: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  targetRef: { type: Schema.Types.ObjectId, required: true },
  targetFqdn: String,
  status: { type: String, required: true },
  progress: { type: Number, default: 0 },
  message: String,
  error: String,
  startedAt: Date,
  finishedAt: Date,
  metadata: Schema.Types.Mixed,
}, { timestamps: true });

const MetricSchema = new Schema({
  ts: { type: Date, required: true },
  entity: {
    kind: { type: String, required: true },
    id: { type: String, required: true },
  },
  name: { type: String, required: true },
  value: { type: Number, required: true },
  unit: String,
  metadata: Schema.Types.Mixed,
});

export const Asset = model('Asset', AssetSchema);
export const Finding = model('Finding', FindingSchema);
export const Job = model('Job', JobSchema);
export const Metric = model('Metric', MetricSchema);

