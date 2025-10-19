import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateJSONWithGemini } from '../gemini';
import { createLogger } from '@pablos/utils';

const logger = createLogger('ai-score');

const ScoreRequestSchema = z.object({
  finding: z.object({
    title: z.string(),
    description: z.string().optional(),
    category: z.string(),
    metadata: z.any().optional(),
  }),
  context: z.object({
    assetType: z.string().optional(),
    exposure: z.string().optional(),
    businessCriticality: z.string().optional(),
  }).optional(),
});

export async function scoreRoute(app: FastifyInstance) {
  app.post('/score', async (request, reply) => {
    try {
      const body = ScoreRequestSchema.parse(request.body);

      const systemInstruction = `You are a security risk scorer for Pablos Network.
Calculate CVSS base score and determine severity based on the finding and context.

Return ONLY valid JSON:
{
  "cvss": 7.5,
  "severity": "high",
  "explanation": "This vulnerability allows...",
  "recommendations": ["Patch immediately", "Monitor for exploitation"]
}`;

      const prompt = `Finding:
Title: ${body.finding.title}
Description: ${body.finding.description || 'N/A'}
Category: ${body.finding.category}
Metadata: ${JSON.stringify(body.finding.metadata || {})}

Context:
${JSON.stringify(body.context || {})}

Calculate risk score:`;

      const score = await generateJSONWithGemini(prompt, systemInstruction);

      logger.info({ title: body.finding.title, cvss: score.cvss }, 'Risk scored');

      return score;
    } catch (error) {
      logger.error({ error }, 'Scoring failed');
      reply.status(500).send({ error: 'Failed to score finding' });
    }
  });
}

