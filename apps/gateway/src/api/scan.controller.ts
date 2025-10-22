import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Asset, AssetDocument, Job, JobDocument, AuditLog, AuditLogDocument } from '../schemas';
import { QueueService } from '../queue/queue.service';
import { VerificationRequiredError, createLogger } from '@pablos/utils';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { v4 as uuidv4 } from 'uuid';
import type { Provider } from '@pablos/contracts';

const logger = createLogger('scan-controller');

@ApiTags('scan')
@Controller('scan')
export class ScanController {
  constructor(
    @InjectModel(Asset.name) private assetModel: Model<AssetDocument>,
    @InjectModel(Job.name) private jobModel: Model<JobDocument>,
    @InjectModel(AuditLog.name) private auditModel: Model<AuditLogDocument>,
    private queueService: QueueService
  ) {}

  private async requireVerification(domain: string, scanType: string): Promise<AssetDocument> {
    const asset = await this.assetModel.findOne({ fqdn: domain });
    
    if (!asset) {
      throw new HttpException('Asset not found. Add to scope first.', HttpStatus.NOT_FOUND);
    }

    // Active scans require verification
    const activeScanTypes = ['dirsearch', 'zap'];
    if (activeScanTypes.includes(scanType) && !asset.verifiedAt) {
      throw new VerificationRequiredError(domain);
    }

    return asset;
  }

  @Post('passive')
  @ApiOperation({ summary: 'Run passive OSINT scan' })
  async scanPassive(@Body() body: { domain: string }) {
    const asset = await this.assetModel.findOne({ fqdn: body.domain });
    if (!asset || !asset._id) {
      throw new HttpException('Asset not found', HttpStatus.NOT_FOUND);
    }

    const jobs = [];

    // Queue OSINT providers
    for (const provider of ['zoomEye', 'binaryEdge'] as Provider[]) {
      const jobId = uuidv4();
      const job = new this.jobModel({
        jobId,
        type: provider,
        targetRef: asset._id,
        targetFqdn: asset.fqdn,
        status: 'pending',
      });
      await job.save();

      await this.queueService.addJob(provider, jobId, {
        assetId: asset._id.toString(),
        domain: asset.fqdn,
      });

      jobs.push({ jobId, provider });
    }

    // Audit log
    await this.auditModel.create({
      action: 'scan:passive',
      target: body.domain,
      targetRef: asset._id,
      timestamp: new Date(),
      success: true,
    });

    logger.info({ domain: body.domain, jobs: jobs.length }, 'Passive scan initiated');

    return { jobs };
  }

  @Post('web')
  @ApiOperation({ summary: 'Run web discovery scan' })
  async scanWeb(@Body() body: { domain: string; mode?: string; include?: string[] }) {
    const mode = body.mode || 'safe';
    const include = body.include || ['dirsearch'];

    const asset = await this.requireVerification(body.domain, 'dirsearch');

    if (!asset._id) {
      throw new HttpException('Invalid asset', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const jobs = [];

    if (include.includes('dirsearch')) {
      const jobId = uuidv4();
      const job = new this.jobModel({
        jobId,
        type: 'dirsearch',
        targetRef: asset._id,
        targetFqdn: asset.fqdn,
        status: 'pending',
        metadata: { mode },
      });
      await job.save();

      await this.queueService.addJob('dirsearch', jobId, {
        assetId: asset._id.toString(),
        domain: asset.fqdn,
        mode,
      });

      jobs.push({ jobId, provider: 'dirsearch' });
    }

    // Audit log
    await this.auditModel.create({
      action: 'scan:web',
      target: body.domain,
      targetRef: asset._id,
      metadata: { mode, include },
      timestamp: new Date(),
      success: true,
    });

    logger.info({ domain: body.domain, mode, jobs: jobs.length }, 'Web scan initiated');

    return { jobs };
  }

  @Post('dast')
  @ApiOperation({ summary: 'Run DAST scan (OWASP ZAP)' })
  async scanDast(@Body() body: { domain: string; mode?: string }) {
    const mode = body.mode || 'safe';

    const asset = await this.requireVerification(body.domain, 'zap');

    if (!asset._id) {
      throw new HttpException('Invalid asset', HttpStatus.INTERNAL_SERVER_ERROR);
    }

    const jobId = uuidv4();
    const job = new this.jobModel({
      jobId,
      type: 'zap',
      targetRef: asset._id,
      targetFqdn: asset.fqdn,
      status: 'pending',
      metadata: { mode },
    });
    await job.save();

    await this.queueService.addJob('zap', jobId, {
      assetId: asset._id.toString(),
      domain: asset.fqdn,
      mode,
    });

    // Audit log
    await this.auditModel.create({
      action: 'scan:dast',
      target: body.domain,
      targetRef: asset._id,
      metadata: { mode },
      timestamp: new Date(),
      success: true,
    });

    logger.info({ domain: body.domain, mode, jobId }, 'DAST scan initiated');

    return { jobId, provider: 'zap' };
  }
}

