import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { AssetType } from '@pablos/contracts';

@Schema({ timestamps: true, collection: 'assets' })
export class Asset extends Document {
  @Prop({ required: true, type: String, enum: ['domain', 'subdomain', 'ip'] })
  type!: AssetType;

  @Prop({ type: String, index: true })
  fqdn?: string;

  @Prop({ type: String, index: true })
  parentFqdn?: string;

  @Prop({ type: Boolean, default: true, index: true })
  active!: boolean;

  @Prop({ type: [String], default: [] })
  ip!: string[];

  @Prop({ type: String })
  owner?: string;

  @Prop({ type: Date })
  verifiedAt?: Date;

  @Prop({ type: String })
  consentToken?: string;

  @Prop({ type: Object })
  metadata?: Record<string, any>;
}

export const AssetSchema = SchemaFactory.createForClass(Asset);

// Unique index on fqdn
AssetSchema.index({ fqdn: 1 }, { unique: true, sparse: true });

// Compound indexes for queries
AssetSchema.index({ parentFqdn: 1, active: 1 });
AssetSchema.index({ type: 1, active: 1 });

