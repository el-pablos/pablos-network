import { describe, it, expect, beforeEach } from 'vitest';
import { logger, createLogger } from './logger';

describe('Logger Utils', () => {
  beforeEach(() => {
    // Set test environment
    process.env.NODE_ENV = 'test';
  });

  describe('logger', () => {
    it('should be a pino logger instance', () => {
      expect(logger).toBeDefined();
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });

    it('should have correct log level', () => {
      expect(logger.level).toBeDefined();
    });
  });

  describe('createLogger', () => {
    it('should create child logger with service name', () => {
      const childLogger = createLogger('test-service');
      expect(childLogger).toBeDefined();
      expect(typeof childLogger.info).toBe('function');
    });

    it('should create different child loggers', () => {
      const logger1 = createLogger('service1');
      const logger2 = createLogger('service2');
      expect(logger1).not.toBe(logger2);
    });
  });
});

