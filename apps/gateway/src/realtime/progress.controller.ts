import { Controller, Get, Res, Query } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { FastifyReply } from 'fastify';
import { Metric } from '../schemas';
import { createLogger } from '@pablos/utils';

const logger = createLogger('progress-controller');

@Controller('progress')
export class ProgressController {
  constructor(
    @InjectModel(Metric.name) private metricModel: Model<Metric>
  ) {}

  @Get('stream')
  async streamProgress(
    @Query('jobId') jobId: string,
    @Res() reply: FastifyReply
  ) {
    logger.info({ jobId }, 'SSE client connected');

    // Set SSE headers
    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    // Send initial connection event
    reply.raw.write(`data: ${JSON.stringify({ type: 'connected' })}\n\n`);

    // Poll metrics every 2 seconds
    const interval = setInterval(async () => {
      try {
        if (!jobId) {
          return;
        }

        const metrics = await this.metricModel
          .find({
            'entity.kind': 'job',
            'entity.id': jobId,
            name: 'progress',
          })
          .sort({ ts: -1 })
          .limit(1)
          .lean();

        if (metrics.length > 0) {
          const data = {
            type: 'progress',
            jobId,
            value: metrics[0].value,
            timestamp: metrics[0].ts,
          };
          reply.raw.write(`data: ${JSON.stringify(data)}\n\n`);
        }
      } catch (error) {
        logger.error({ error, jobId }, 'Error streaming progress');
      }
    }, 2000);

    // Cleanup on client disconnect
    reply.raw.on('close', () => {
      clearInterval(interval);
      logger.info({ jobId }, 'SSE client disconnected');
    });
  }
}

