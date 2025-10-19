import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { Queue, QueueOptions } from 'bullmq';
import { redis } from '@pablos/utils';
import { createLogger } from '@pablos/utils';
import type { Provider } from '@pablos/contracts';

const logger = createLogger('queue');

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private queues: Map<Provider, Queue> = new Map();

  private readonly queueConfig: QueueOptions = {
    connection: redis,
    defaultJobOptions: {
      attempts: 3,
      backoff: {
        type: 'exponential',
        delay: 2000,
      },
      removeOnComplete: {
        count: 100,
        age: 24 * 3600, // 24 hours
      },
      removeOnFail: {
        count: 500,
        age: 7 * 24 * 3600, // 7 days
      },
    },
  };

  async onModuleInit() {
    logger.info('Initializing BullMQ queues...');
    
    const providers: Provider[] = [
      'dns',
      'zoomEye',
      'binaryEdge',
      'dirsearch',
      'zap',
      'reverseip',
      'domainwatch',
      'policy',
      'seo',
      'media',
    ];

    for (const provider of providers) {
      const queue = new Queue(provider, this.queueConfig);
      this.queues.set(provider, queue);
      logger.info({ provider }, 'Queue initialized');
    }
  }

  async onModuleDestroy() {
    logger.info('Closing BullMQ queues...');
    for (const [provider, queue] of this.queues.entries()) {
      await queue.close();
      logger.info({ provider }, 'Queue closed');
    }
  }

  getQueue(provider: Provider): Queue {
    const queue = this.queues.get(provider);
    if (!queue) {
      throw new Error(`Queue for provider ${provider} not found`);
    }
    return queue;
  }

  async addJob(
    provider: Provider,
    jobId: string,
    data: any,
    options?: any
  ): Promise<void> {
    const queue = this.getQueue(provider);
    
    await queue.add(jobId, data, {
      jobId,
      ...options,
    });

    logger.info({ provider, jobId }, 'Job added to queue');
  }

  async cancelJob(provider: Provider, jobId: string): Promise<void> {
    const queue = this.getQueue(provider);
    const job = await queue.getJob(jobId);
    
    if (job) {
      await job.remove();
      logger.info({ provider, jobId }, 'Job cancelled');
    }
  }

  async getJobStatus(provider: Provider, jobId: string): Promise<any> {
    const queue = this.getQueue(provider);
    const job = await queue.getJob(jobId);
    
    if (!job) {
      return null;
    }

    return {
      id: job.id,
      name: job.name,
      data: job.data,
      progress: await job.progress(),
      state: await job.getState(),
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason,
      finishedOn: job.finishedOn,
      processedOn: job.processedOn,
    };
  }
}

