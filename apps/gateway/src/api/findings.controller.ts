import { Controller, Get, Query, Param, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Finding, Asset } from '../schemas';
import { FindingQuerySchema } from '@pablos/contracts';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { createLogger } from '@pablos/utils';

const logger = createLogger('findings-controller');

@ApiTags('findings')
@Controller('findings')
export class FindingsController {
  constructor(
    @InjectModel(Finding.name) private findingModel: Model<Finding>,
    @InjectModel(Asset.name) private assetModel: Model<Asset>
  ) {}

  @Get()
  @ApiOperation({ summary: 'List findings with filters' })
  async listFindings(@Query() query: any) {
    const parsed = FindingQuerySchema.parse(query);

    const filter: any = {};

    if (parsed.domain) {
      const asset = await this.assetModel.findOne({ fqdn: parsed.domain });
      if (asset) {
        filter.targetRef = asset._id;
      } else {
        return { findings: [], total: 0 };
      }
    }

    if (parsed.severity) {
      filter.severity = parsed.severity;
    }

    if (parsed.provider) {
      filter.provider = parsed.provider;
    }

    if (parsed.category) {
      filter.category = parsed.category;
    }

    if (parsed.since) {
      filter.createdAt = { $gte: parsed.since };
    }

    const [findings, total] = await Promise.all([
      this.findingModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip(parsed.skip)
        .limit(parsed.limit)
        .lean(),
      this.findingModel.countDocuments(filter),
    ]);

    return { findings, total, limit: parsed.limit, skip: parsed.skip };
  }

  @Get('stats')
  @ApiOperation({ summary: 'Get findings statistics' })
  async getStats(@Query('domain') domain?: string) {
    const filter: any = {};

    if (domain) {
      const asset = await this.assetModel.findOne({ fqdn: domain });
      if (asset) {
        filter.targetRef = asset._id;
      }
    }

    const stats = await this.findingModel.aggregate([
      { $match: filter },
      {
        $group: {
          _id: '$severity',
          count: { $sum: 1 },
        },
      },
    ]);

    const result = {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
    };

    stats.forEach((stat) => {
      result[stat._id] = stat.count;
    });

    return result;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get finding details' })
  async getFinding(@Param('id') id: string) {
    const finding = await this.findingModel.findById(id).lean();
    if (!finding) {
      throw new HttpException('Finding not found', HttpStatus.NOT_FOUND);
    }
    return finding;
  }
}

