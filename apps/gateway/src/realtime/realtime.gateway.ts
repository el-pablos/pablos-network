import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { createLogger } from '@pablos/utils';
import { StreamsService } from '../streams/streams.service';
import { QueueService } from '../queue/queue.service';

const logger = createLogger('realtime-gateway');

@WebSocketGateway({
  namespace: '/ws',
  cors: {
    origin: '*',
  },
})
export class RealtimeGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly streamsService: StreamsService,
    private readonly queueService: QueueService
  ) {}

  afterInit(server: Server) {
    logger.info('WebSocket Gateway initialized');

    // Listen to change streams and broadcast
    this.streamsService.on('job:change', (change) => {
      if (change.fullDocument) {
        this.server.emit('job:update', change.fullDocument);
      }
    });

    this.streamsService.on('finding:change', (change) => {
      if (change.operationType === 'insert' && change.fullDocument) {
        this.server.emit('finding:new', change.fullDocument);
      }
    });
  }

  handleConnection(client: Socket) {
    logger.info({ clientId: client.id }, 'Client connected');
  }

  handleDisconnect(client: Socket) {
    logger.info({ clientId: client.id }, 'Client disconnected');
  }

  @SubscribeMessage('job:cancel')
  async handleJobCancel(client: Socket, payload: { jobId: string; provider: string }) {
    try {
      await this.queueService.cancelJob(payload.provider as any, payload.jobId);
      client.emit('job:cancelled', { jobId: payload.jobId });
      logger.info({ jobId: payload.jobId }, 'Job cancelled by client');
    } catch (error) {
      logger.error({ error, jobId: payload.jobId }, 'Failed to cancel job');
      client.emit('error', { message: 'Failed to cancel job' });
    }
  }

  @SubscribeMessage('subscribe:job')
  handleSubscribeJob(client: Socket, payload: { jobId: string }) {
    client.join(`job:${payload.jobId}`);
    logger.debug({ clientId: client.id, jobId: payload.jobId }, 'Client subscribed to job');
  }

  @SubscribeMessage('unsubscribe:job')
  handleUnsubscribeJob(client: Socket, payload: { jobId: string }) {
    client.leave(`job:${payload.jobId}`);
    logger.debug({ clientId: client.id, jobId: payload.jobId }, 'Client unsubscribed from job');
  }

  // Emit log line to specific job subscribers
  emitJobLog(jobId: string, log: string) {
    this.server.to(`job:${jobId}`).emit('job:log', { jobId, log, timestamp: new Date() });
  }

  // Broadcast job update
  broadcastJobUpdate(job: any) {
    this.server.emit('job:update', job);
  }

  // Broadcast new finding
  broadcastFinding(finding: any) {
    this.server.emit('finding:new', finding);
  }
}

