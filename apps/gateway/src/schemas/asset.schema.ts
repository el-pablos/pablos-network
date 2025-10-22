import { Schema as MongooseSchema, Document } from 'mongoose';
import type { AssetType } from '@pablos/contracts';

export interface AssetDocument extends Document {
  type: AssetType;
  fqdn?: string;
  parentFqdn?: string;
  active: boolean;
  ip: string[];
  owner?: string;
  verifiedAt?: Date;
  consentToken?: string;
  metadata?: Record<string, any>;
}

export class Asset {}

export const AssetSchema = new MongooseSchema({
  type: {
    type: String,
    required: true,
    enum: ['domain', 'subdomain', 'ip']
  },
  fqdn: {
    type: String,
    index: true
  },
  parentFqdn: {
    type: String,
    index: true
  },
  active: {
    type: Boolean,
    default: true,
    index: true
  },
  ip: {
    type: [String],
    default: []
  },
  owner: {
    type: String
  },
  verifiedAt: {
    type: Date
  },
  consentToken: {
    type: String
  },
  metadata: {
    type: MongooseSchema.Types.Mixed
  },
}, {
  timestamps: true,
  collection: 'assets'
});

// Unique index on fqdn
AssetSchema.index({ fqdn: 1 }, { unique: true, sparse: true });

// Compound indexes for queries
AssetSchema.index({ parentFqdn: 1, active: 1 });
AssetSchema.index({ type: 1, active: 1 });

