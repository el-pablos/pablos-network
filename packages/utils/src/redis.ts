import IORedis from 'ioredis';
import { createLogger } from './logger';

const logger = createLogger('redis');

let redisInstance: IORedis | null = null;

export function createRedisClient(): IORedis {
  if (redisInstance) {
    return redisInstance;
  }

  const host = process.env.REDIS_HOST;
  const port = Number(process.env.REDIS_PORT);
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;

  if (!host || !port || !password) {
    throw new Error('Redis configuration missing. Check REDIS_HOST, REDIS_PORT, REDIS_USERNAME, REDIS_PASSWORD in .env');
  }

  logger.info({ host, port, username }, 'Connecting to Redis Cloud...');

  redisInstance = new IORedis({
    host,
    port,
    username,
    password,
    // Note: TLS disabled for now - Redis Cloud port 17540 may not require TLS
    // tls: {
    //   rejectUnauthorized: false,
    // },
    retryStrategy(times) {
      const delay = Math.min(times * 50, 2000);
      logger.warn({ times, delay }, 'Redis connection retry');
      return delay;
    },
    maxRetriesPerRequest: 3,
  });

  redisInstance.on('connect', () => {
    logger.info('Redis connected');
  });

  redisInstance.on('error', (err) => {
    logger.error({ err }, 'Redis error');
  });

  redisInstance.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redisInstance;
}

export const redis = createRedisClient();

