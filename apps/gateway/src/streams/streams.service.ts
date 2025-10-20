import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { createLogger } from '@pablos/utils';
import { EventEmitter } from 'events';

// Type for MongoDB Change Stream
type ChangeStream = any;

const logger = createLogger('streams');

export interface ChangeEvent {
  operationType: 'insert' | 'update' | 'replace' | 'delete';
  documentKey: { _id: any };
  fullDocument?: any;
  updateDescription?: any;
}

@Injectable()
export class StreamsService extends EventEmitter implements OnModuleInit, OnModuleDestroy {
  private jobsStream?: ChangeStream;
  private findingsStream?: ChangeStream;

  constructor(
    @InjectConnection() private readonly connection: Connection
  ) {
    super();
  }

  async onModuleInit() {
    logger.info('Initializing MongoDB Change Streams...');

    try {
      // Watch jobs collection
      this.jobsStream = this.connection.collection('jobs').watch([], {
        fullDocument: 'updateLookup',
      });

      this.jobsStream.on('change', (change: ChangeEvent) => {
        logger.debug({ operationType: change.operationType }, 'Jobs change detected');
        this.emit('job:change', change);
      });

      this.jobsStream.on('error', (error: Error) => {
        logger.error({ error }, 'Jobs stream error');
      });

      // Watch findings collection
      this.findingsStream = this.connection.collection('findings').watch([], {
        fullDocument: 'updateLookup',
      });

      this.findingsStream.on('change', (change: ChangeEvent) => {
        logger.debug({ operationType: change.operationType }, 'Findings change detected');
        this.emit('finding:change', change);
      });

      this.findingsStream.on('error', (error: Error) => {
        logger.error({ error }, 'Findings stream error');
      });

      logger.info('Change Streams initialized successfully');
    } catch (error) {
      logger.error({ error }, 'Failed to initialize Change Streams');
      // Change streams require replica set, log warning but don't crash
      logger.warn('Change Streams not available - ensure MongoDB is running as replica set');
    }
  }

  async onModuleDestroy() {
    logger.info('Closing Change Streams...');
    
    if (this.jobsStream) {
      await this.jobsStream.close();
    }
    
    if (this.findingsStream) {
      await this.findingsStream.close();
    }

    logger.info('Change Streams closed');
  }
}

