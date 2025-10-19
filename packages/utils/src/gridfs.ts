import { MongoClient, GridFSBucket, ObjectId } from 'mongodb';
import { Readable } from 'stream';
import { createLogger } from './logger';
import type { EvidenceMetadata } from '@pablos/contracts';

const logger = createLogger('gridfs');

let gridFSBucket: GridFSBucket | null = null;
let mongoClient: MongoClient | null = null;

export async function initGridFS(client?: MongoClient): Promise<GridFSBucket> {
  if (gridFSBucket) {
    return gridFSBucket;
  }

  if (!client) {
    const uri = process.env.MONGODB_URI;
    if (!uri) {
      throw new Error('MONGODB_URI not configured');
    }
    mongoClient = new MongoClient(uri);
    await mongoClient.connect();
    client = mongoClient;
  }

  const db = client.db();
  gridFSBucket = new GridFSBucket(db, {
    bucketName: 'evidence',
  });

  logger.info('GridFS initialized with bucket: evidence');
  return gridFSBucket;
}

export async function saveEvidence(
  stream: Readable | Buffer | string,
  metadata: EvidenceMetadata
): Promise<ObjectId> {
  const bucket = await initGridFS();

  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(metadata.filename, {
      metadata: {
        ...metadata,
        uploadedAt: new Date(),
      },
    });

    uploadStream.on('finish', () => {
      logger.info({ fileId: uploadStream.id, filename: metadata.filename }, 'Evidence saved to GridFS');
      resolve(uploadStream.id as ObjectId);
    });

    uploadStream.on('error', (err) => {
      logger.error({ err, filename: metadata.filename }, 'Failed to save evidence');
      reject(err);
    });

    if (Buffer.isBuffer(stream)) {
      const readable = Readable.from(stream);
      readable.pipe(uploadStream);
    } else if (typeof stream === 'string') {
      const readable = Readable.from(Buffer.from(stream, 'utf-8'));
      readable.pipe(uploadStream);
    } else {
      stream.pipe(uploadStream);
    }
  });
}

export async function getEvidence(fileId: string | ObjectId): Promise<Readable> {
  const bucket = await initGridFS();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

  logger.debug({ fileId: objectId.toString() }, 'Retrieving evidence from GridFS');
  return bucket.openDownloadStream(objectId);
}

export async function deleteEvidence(fileId: string | ObjectId): Promise<void> {
  const bucket = await initGridFS();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

  await bucket.delete(objectId);
  logger.info({ fileId: objectId.toString() }, 'Evidence deleted from GridFS');
}

export async function getEvidenceMetadata(fileId: string | ObjectId): Promise<any> {
  const bucket = await initGridFS();
  const objectId = typeof fileId === 'string' ? new ObjectId(fileId) : fileId;

  const files = await bucket.find({ _id: objectId }).toArray();
  if (files.length === 0) {
    throw new Error(`Evidence file not found: ${objectId.toString()}`);
  }

  return files[0];
}

export async function closeGridFS(): Promise<void> {
  if (mongoClient) {
    await mongoClient.close();
    mongoClient = null;
    gridFSBucket = null;
    logger.info('GridFS connection closed');
  }
}

