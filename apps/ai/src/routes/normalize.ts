import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { CreateFindingSchema } from '@pablos/contracts';
import { generateJSONWithGemini } from '../gemini';
import { createLogger } from '@pablos/utils';

const logger = createLogger('ai-normalize');

const NormalizeRequestSchema = z.object({
  provider: z.string(),
  rawData: z.any(),
  targetRef: z.string(),
  targetFqdn: z.string().optional(),
});

export async function normalizeRoute(app: FastifyInstance) {
  app.post('/normalize', async (request, reply) => {
    try {
      const body = NormalizeRequestSchema.parse(request.body);

      const systemInstruction = `You are a security finding normalizer for Pablos Network.
Convert raw scan results into standardized Finding objects.

Each finding must have:
- title: Clear, concise title
- description: Detailed explanation
- severity: info, low, medium, high, or critical
- category: DNS, WEB, NET, OSINT, POLICY, SEO, or MEDIA
- fingerprint: Unique identifier (hash of key attributes)

Return ONLY valid JSON array of findings:
[
  {
    "title": "Open Port 443",
    "description": "HTTPS port is open",
    "severity": "info",
    "category": "NET",
    "fingerprint": "port-443-open",
    "metadata": { "port": 443, "service": "https" }
  }
]`;

      const prompt = `Provider: ${body.provider}
Target: ${body.targetFqdn || body.targetRef}

Raw data:
${JSON.stringify(body.rawData, null, 2)}

Normalize to findings:`;

      const findings = await generateJSONWithGemini<any[]>(prompt, systemInstruction);

      // Validate and enrich each finding
      const validated = findings.map((f) =>
        CreateFindingSchema.parse({
          ...f,
          targetRef: body.targetRef,
          targetFqdn: body.targetFqdn,
          provider: body.provider,
        })
      );

      logger.info({ provider: body.provider, count: validated.length }, 'Findings normalized');

      return { findings: validated };
    } catch (error) {
      logger.error({ error }, 'Normalization failed');
      reply.status(500).send({ error: 'Failed to normalize findings' });
    }
  });
}

