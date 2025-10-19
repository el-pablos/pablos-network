import { Controller, Post, Body, Get, Param, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset, AuditLog } from '../schemas';
import { CreateAssetSchema, VerifyAssetSchema } from '@pablos/contracts';
import { generateConsentToken, createLogger } from '@pablos/utils';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

const logger = createLogger('scope-controller');

@ApiTags('scope')
@Controller('scope')
export class ScopeController {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<Asset>,
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLog>
  ) {}

  @Post()
  @ApiOperation({ summary: 'Add domain to scope' })
  async addToScope(@Body() body: any) {
    const parsed = CreateAssetSchema.parse(body);

    // Check if asset already exists
    const existing = await this.assetModel.findOne({ fqdn: parsed.fqdn });
    if (existing) {
      throw new HttpException('Asset already exists', HttpStatus.CONFLICT);
    }

    // Generate consent token
    const consentToken = generateConsentToken();

    const asset = new this.assetModel({
      type: parsed.type,
      fqdn: parsed.fqdn,
      parentFqdn: parsed.parentFqdn,
      ip: parsed.ip || [],
      owner: parsed.owner,
      consentToken,
      active: true,
    });

    await asset.save();

    // Audit log
    await this.auditModel.create({
      action: 'scope:add',
      target: parsed.fqdn,
      targetRef: asset._id,
      timestamp: new Date(),
      success: true,
    });

    logger.info({ fqdn: parsed.fqdn, assetId: asset._id }, 'Asset added to scope');

    // Return verification instructions
    const verificationInstructions = parsed.verify === 'dns'
      ? {
          method: 'dns',
          instructions: `Add TXT record: ${consentToken}`,
          record: `_pablos-verify.${parsed.fqdn} TXT ${consentToken}`,
        }
      : {
          method: 'http',
          instructions: `Place file at: https://${parsed.fqdn}/.well-known/pablos-proof.txt`,
          content: consentToken,
        };

    return {
      asset: {
        id: asset._id,
        fqdn: asset.fqdn,
        type: asset.type,
        verified: false,
      },
      verification: verificationInstructions,
    };
  }

  @Post('verify')
  @ApiOperation({ summary: 'Verify domain ownership' })
  async verifyOwnership(@Body() body: any) {
    const parsed = VerifyAssetSchema.parse(body);

    const asset = await this.assetModel.findOne({ fqdn: parsed.domain });
    if (!asset) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }

    if (asset.verifiedAt) {
      return { verified: true, message: 'Already verified' };
    }

    // Verify token
    if (asset.consentToken !== parsed.token) {
      throw new HttpException('Invalid verification token', HttpStatus.FORBIDDEN);
    }

    // TODO: Implement actual DNS/HTTP verification check here
    // For now, just trust the token match

    asset.verifiedAt = new Date();
    await asset.save();

    // Audit log
    await this.auditModel.create({
      action: 'scope:verify',
      target: parsed.domain,
      targetRef: asset._id,
      timestamp: new Date(),
      success: true,
    });

    logger.info({ fqdn: parsed.domain }, 'Asset verified');

    return { verified: true, verifiedAt: asset.verifiedAt };
  }

  @Get(':domain')
  @ApiOperation({ summary: 'Get asset details' })
  async getAsset(@Param('domain') domain: string) {
    const asset = await this.assetModel.findOne({ fqdn: domain }).lean();
    if (!asset) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }
    return asset;
  }

  @Get()
  @ApiOperation({ summary: 'List all assets' })
  async listAssets() {
    const assets = await this.assetModel.find().sort({ createdAt: -1 }).lean();
    return assets;
  }
}

