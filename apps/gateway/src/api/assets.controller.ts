import { Controller, Get, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset } from '../schemas';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createLogger } from '@pablos/utils';

const logger = createLogger('assets-controller');

@ApiTags('assets')
@Controller('assets')
export class AssetsController {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<Asset>
  ) {}

  @Get(':domain/subs')
  @ApiOperation({ summary: 'Get subdomains of a domain' })
  async getSubdomains(
    @Param('domain') domain: string,
    @Query('all') all?: string
  ) {
    const showAll = all === 'true';

    const filter: any = { parentFqdn: domain };
    if (!showAll) {
      filter.active = true;
    }

    const subdomains = await this.assetModel
      .find(filter)
      .sort({ fqdn: 1 })
      .lean();

    return {
      domain,
      subdomains: subdomains.map((sub) => ({
        fqdn: sub.fqdn,
        active: sub.active,
        ip: sub.ip,
        verifiedAt: sub.verifiedAt,
      })),
      total: subdomains.length,
    };
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
}

