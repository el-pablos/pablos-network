import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import type { AssetType } from '@pablos/contracts';

@Schema({ timestamps: true, collection: 'assets' })
export class Asset extends Document {
  @Prop({ required: true, enum: ['domain', 'subdomain', 'ip'] })
  type: AssetType;

  @Prop({ index: true })
  fqdn?: string;

  @Prop({ index: true })
  parentFqdn?: string;

  @Prop({ default: true, index: true })
  active: boolean;

  @Prop({ type: [String], default: [] })
  ip: string[];

  @Prop()
  owner?: string;

  @Prop()
  verifiedAt?: Date;

  @Prop()
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

