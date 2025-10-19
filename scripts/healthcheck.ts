#!/usr/bin/env tsx

/**
 * Pablos Network - Healthcheck Script
 * 
 * Verifies all required dependencies before starting services:
 * - MongoDB Atlas connectivity
 * - Redis Cloud connectivity
 * - dirsearch binary availability
 * - OWASP ZAP availability
 */

import { connect } from 'mongoose';
import IORedis from 'ioredis';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

interface HealthCheckResult {
  name: string;
  status: 'ok' | 'warning' | 'error';
  message: string;
  required: boolean;
}

const results: HealthCheckResult[] = [];

function log(emoji: string, message: string) {
  console.log(`${emoji} ${message}`);
}

function addResult(result: HealthCheckResult) {
  results.push(result);
  const emoji = result.status === 'ok' ? '✅' : result.status === 'warning' ? '⚠️' : '❌';
  log(emoji, `${result.name}: ${result.message}`);
}

async function checkMongoDB(): Promise<void> {
  const uri = process.env.MONGODB_URI;
  
  if (!uri) {
    addResult({
      name: 'MongoDB',
      status: 'error',
      message: 'MONGODB_URI environment variable not set',
      required: true,
    });
    return;
  }

  try {
    await connect(uri, { 
      serverSelectionTimeoutMS: 5000,
      dbName: 'pablos-network',
    });
    
    addResult({
      name: 'MongoDB',
      status: 'ok',
      message: 'Connected successfully',
      required: true,
    });
    
    // Disconnect
    const mongoose = await import('mongoose');
    await mongoose.disconnect();
  } catch (error: any) {
    addResult({
      name: 'MongoDB',
      status: 'error',
      message: `Connection failed: ${error.message}`,
      required: true,
    });
  }
}

async function checkRedis(): Promise<void> {
  const host = process.env.REDIS_HOST;
  const port = process.env.REDIS_PORT;
  const username = process.env.REDIS_USERNAME;
  const password = process.env.REDIS_PASSWORD;

  if (!host || !port || !password) {
    addResult({
      name: 'Redis',
      status: 'error',
      message: 'Redis environment variables not set (REDIS_HOST, REDIS_PORT, REDIS_PASSWORD)',
      required: true,
    });
    return;
  }

  const redis = new IORedis({
    host,
    port: Number(port),
    username,
    password,
    tls: {}, // Redis Cloud requires TLS
    connectTimeout: 5000,
    lazyConnect: true,
  });

  try {
    await redis.connect();
    await redis.ping();
    
    addResult({
      name: 'Redis',
      status: 'ok',
      message: 'Connected successfully',
      required: true,
    });
    
    await redis.quit();
  } catch (error: any) {
    addResult({
      name: 'Redis',
      status: 'error',
      message: `Connection failed: ${error.message}`,
      required: true,
    });
  }
}

function checkDirsearch(): void {
  const dirsearchBin = process.env.DIRSEARCH_BIN || 'dirsearch';

  try {
    execSync(`${dirsearchBin} --version`, { stdio: 'ignore' });
    
    addResult({
      name: 'dirsearch',
      status: 'ok',
      message: `Found at: ${dirsearchBin}`,
      required: false,
    });
  } catch (error) {
    addResult({
      name: 'dirsearch',
      status: 'warning',
      message: 'Not found. Install with: pip install dirsearch OR set DIRSEARCH_BIN env var',
      required: false,
    });
  }
}

function checkZAP(): void {
  const zapPath = process.env.ZAP_PATH;
  const zapBaseline = process.env.ZAP_BASELINE;

  if (!zapPath || !zapBaseline) {
    addResult({
      name: 'OWASP ZAP',
      status: 'warning',
      message: 'ZAP_PATH or ZAP_BASELINE environment variables not set',
      required: false,
    });
    return;
  }

  if (!fs.existsSync(zapBaseline)) {
    addResult({
      name: 'OWASP ZAP',
      status: 'warning',
      message: `ZAP baseline script not found at: ${zapBaseline}`,
      required: false,
    });
    return;
  }

  try {
    // Check if python3 is available
    execSync('python3 --version', { stdio: 'ignore' });
    
    addResult({
      name: 'OWASP ZAP',
      status: 'ok',
      message: `Found at: ${zapBaseline}`,
      required: false,
    });
  } catch (error) {
    addResult({
      name: 'OWASP ZAP',
      status: 'warning',
      message: 'python3 not found. Required to run ZAP baseline script',
      required: false,
    });
  }
}

function checkGeminiAPI(): void {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    addResult({
      name: 'Gemini API',
      status: 'error',
      message: 'GEMINI_API_KEY environment variable not set',
      required: true,
    });
    return;
  }

  if (apiKey.length < 20) {
    addResult({
      name: 'Gemini API',
      status: 'warning',
      message: 'GEMINI_API_KEY looks invalid (too short)',
      required: true,
    });
    return;
  }

  addResult({
    name: 'Gemini API',
    status: 'ok',
    message: 'API key configured',
    required: true,
  });
}

async function main() {
  console.log('');
  console.log('🏥 Pablos Network - Health Check');
  console.log('=================================');
  console.log('');

  // Run all checks
  await checkMongoDB();
  await checkRedis();
  checkGeminiAPI();
  checkDirsearch();
  checkZAP();

  console.log('');
  console.log('=================================');
  console.log('');

  // Summary
  const errors = results.filter(r => r.status === 'error' && r.required);
  const warnings = results.filter(r => r.status === 'warning');
  const ok = results.filter(r => r.status === 'ok');

  console.log(`✅ Passed: ${ok.length}`);
  console.log(`⚠️  Warnings: ${warnings.length}`);
  console.log(`❌ Errors: ${errors.length}`);
  console.log('');

  if (errors.length > 0) {
    console.log('❌ Health check FAILED');
    console.log('');
    console.log('Required services are not available. Please fix the errors above.');
    console.log('');
    process.exit(1);
  }

  if (warnings.length > 0) {
    console.log('⚠️  Health check PASSED with warnings');
    console.log('');
    console.log('Some optional features may not work:');
    warnings.forEach(w => {
      console.log(`  - ${w.name}: ${w.message}`);
    });
    console.log('');
  } else {
    console.log('✅ Health check PASSED');
    console.log('');
    console.log('All systems operational!');
    console.log('');
  }

  process.exit(0);
}

main().catch((error) => {
  console.error('');
  console.error('❌ Health check crashed:', error);
  console.error('');
  process.exit(1);
});

