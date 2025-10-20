import { describe, it, expect } from 'vitest';
import {
  AppError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  RateLimitError,
  VerificationRequiredError,
} from './errors';

describe('Error Classes', () => {
  describe('AppError', () => {
    it('should create error with all properties', () => {
      const error = new AppError('Test error', 'TEST_ERROR', 500, { foo: 'bar' });

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_ERROR');
      expect(error.statusCode).toBe(500);
      expect(error.details).toEqual({ foo: 'bar' });
      expect(error.name).toBe('AppError');
      expect(error.stack).toBeDefined();
    });

    it('should default to 500 status code', () => {
      const error = new AppError('Test error', 'TEST_ERROR');

      expect(error.statusCode).toBe(500);
    });

    it('should be instance of Error', () => {
      const error = new AppError('Test error', 'TEST_ERROR');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });

  describe('ValidationError', () => {
    it('should create validation error', () => {
      const error = new ValidationError('Invalid input', { field: 'email' });

      expect(error.message).toBe('Invalid input');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ field: 'email' });
      expect(error.name).toBe('ValidationError');
    });

    it('should work without details', () => {
      const error = new ValidationError('Invalid input');

      expect(error.message).toBe('Invalid input');
      expect(error.statusCode).toBe(400);
    });
  });

  describe('NotFoundError', () => {
    it('should create not found error with ID', () => {
      const error = new NotFoundError('Asset', '507f1f77bcf86cd799439011');

      expect(error.message).toBe('Asset with id 507f1f77bcf86cd799439011 not found');
      expect(error.code).toBe('NOT_FOUND');
      expect(error.statusCode).toBe(404);
      expect(error.name).toBe('NotFoundError');
    });

    it('should create not found error without ID', () => {
      const error = new NotFoundError('User');

      expect(error.message).toBe('User not found');
      expect(error.statusCode).toBe(404);
    });
  });

  describe('UnauthorizedError', () => {
    it('should create unauthorized error with custom message', () => {
      const error = new UnauthorizedError('Invalid token');

      expect(error.message).toBe('Invalid token');
      expect(error.code).toBe('UNAUTHORIZED');
      expect(error.statusCode).toBe(401);
      expect(error.name).toBe('UnauthorizedError');
    });

    it('should use default message', () => {
      const error = new UnauthorizedError();

      expect(error.message).toBe('Unauthorized');
      expect(error.statusCode).toBe(401);
    });
  });

  describe('ForbiddenError', () => {
    it('should create forbidden error with custom message', () => {
      const error = new ForbiddenError('Access denied');

      expect(error.message).toBe('Access denied');
      expect(error.code).toBe('FORBIDDEN');
      expect(error.statusCode).toBe(403);
      expect(error.name).toBe('ForbiddenError');
    });

    it('should use default message', () => {
      const error = new ForbiddenError();

      expect(error.message).toBe('Forbidden');
      expect(error.statusCode).toBe(403);
    });
  });

  describe('ConflictError', () => {
    it('should create conflict error', () => {
      const error = new ConflictError('Resource already exists', { resource: 'domain' });

      expect(error.message).toBe('Resource already exists');
      expect(error.code).toBe('CONFLICT');
      expect(error.statusCode).toBe(409);
      expect(error.details).toEqual({ resource: 'domain' });
      expect(error.name).toBe('ConflictError');
    });
  });

  describe('RateLimitError', () => {
    it('should create rate limit error with custom message', () => {
      const error = new RateLimitError('Too many requests');

      expect(error.message).toBe('Too many requests');
      expect(error.code).toBe('RATE_LIMIT');
      expect(error.statusCode).toBe(429);
      expect(error.name).toBe('RateLimitError');
    });

    it('should use default message', () => {
      const error = new RateLimitError();

      expect(error.message).toBe('Rate limit exceeded');
      expect(error.statusCode).toBe(429);
    });
  });

  describe('VerificationRequiredError', () => {
    it('should create verification required error', () => {
      const error = new VerificationRequiredError('example.com');

      expect(error.message).toBe('Domain example.com requires verification before active scanning');
      expect(error.code).toBe('VERIFICATION_REQUIRED');
      expect(error.statusCode).toBe(403);
      expect(error.details).toEqual({ domain: 'example.com' });
      expect(error.name).toBe('VerificationRequiredError');
    });

    it('should be instance of AppError', () => {
      const error = new VerificationRequiredError('example.com');

      expect(error).toBeInstanceOf(AppError);
      expect(error).toBeInstanceOf(VerificationRequiredError);
    });
  });

  describe('Error serialization', () => {
    it('should preserve stack trace', () => {
      const error = new NotFoundError('Asset', '123');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('NotFoundError');
    });
  });
});

