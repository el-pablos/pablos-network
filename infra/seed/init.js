// MongoDB initialization script
// This runs when MongoDB container starts for the first time

db = db.getSiblingDB('pablos-network');

// Create collections with validators
db.createCollection('assets', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['type', 'active'],
      properties: {
        type: {
          enum: ['domain', 'subdomain', 'ip']
        },
        fqdn: { bsonType: 'string' },
        parentFqdn: { bsonType: 'string' },
        active: { bsonType: 'bool' },
        ip: { bsonType: 'array' },
        verifiedAt: { bsonType: 'date' }
      }
    }
  }
});

db.createCollection('jobs', {
  validator: {
    $jsonSchema: {
      bsonType: 'object',
      required: ['jobId', 'type', 'targetRef', 'status'],
      properties: {
        jobId: { bsonType: 'string' },
        type: { bsonType: 'string' },
        status: {
          enum: ['pending', 'running', 'done', 'failed', 'cancelled']
        },
        progress: { bsonType: 'number', minimum: 0, maximum: 100 }
      }
    }
  }
});

db.createCollection('findings');
db.createCollection('metrics');
db.createCollection('audit_logs');

// Create indexes
db.assets.createIndex({ fqdn: 1 }, { unique: true, sparse: true });
db.assets.createIndex({ parentFqdn: 1, active: 1 });
db.assets.createIndex({ type: 1, active: 1 });

db.jobs.createIndex({ jobId: 1 }, { unique: true });
db.jobs.createIndex({ status: 1, updatedAt: -1 });
db.jobs.createIndex({ targetRef: 1, type: 1 });

db.findings.createIndex({ targetRef: 1, provider: 1, fingerprint: 1 }, { unique: true });
db.findings.createIndex({ severity: 1, createdAt: -1 });
db.findings.createIndex({ category: 1, severity: 1 });

db.metrics.createIndex({ ts: 1 });
db.metrics.createIndex({ 'entity.kind': 1, 'entity.id': 1, ts: -1 });
db.metrics.createIndex({ ts: 1 }, { expireAfterSeconds: 1209600 }); // 14 days TTL

db.audit_logs.createIndex({ timestamp: -1 });
db.audit_logs.createIndex({ userId: 1, timestamp: -1 });
db.audit_logs.createIndex({ action: 1, timestamp: -1 });

print('✅ Pablos Network database initialized');

