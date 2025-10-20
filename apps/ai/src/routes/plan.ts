import { FastifyInstance } from 'fastify';
import { PlanRequestSchema, PlanSchema } from '@pablos/contracts';
import { generateJSONWithGemini } from '../gemini';
import { createLogger } from '@pablos/utils';
import { ZodError } from 'zod';

const logger = createLogger('ai-plan');

export async function planRoute(app: FastifyInstance) {
  app.post('/plan', async (request, reply) => {
    try {
      const body = PlanRequestSchema.parse(request.body);

      const systemInstruction = `You are a security scan planner for Pablos Network.
Generate a DAG (Directed Acyclic Graph) of scan steps based on the user's command.

Available providers: dns, zoomEye, binaryEdge, dirsearch, zap, reverseip, domainwatch, policy, seo, media

Rules:
- dns should run first for domain enumeration
- OSINT (zoomEye, binaryEdge) can run in parallel after dns
- dirsearch and zap require domain verification
- reverseip can run after dns
- policy can run after findings are collected
- Respect the mode: safe (minimal), normal (moderate), aggressive (comprehensive)

Return ONLY valid JSON matching this schema:
{
  "steps": [
    {
      "id": "step-1",
      "provider": "dns",
      "dependsOn": [],
      "params": {},
      "estimatedDuration": 60,
      "priority": 1
    }
  ],
  "totalEstimatedDuration": 300,
  "constraints": {
    "mode": "safe",
    "maxConcurrency": 3
  }
}`;

      const prompt = `Command: ${body.command}
Target: ${body.target}
Mode: ${body.mode}
Include: ${body.include?.join(', ') || 'auto'}
Exclude: ${body.exclude?.join(', ') || 'none'}

Generate the scan plan:`;

      const plan = await generateJSONWithGemini(prompt, systemInstruction);
      const validated = PlanSchema.parse(plan);

      logger.info({ target: body.target, steps: validated.steps.length }, 'Plan generated');

      return validated;
    } catch (error) {
      if (error instanceof ZodError) {
        logger.warn({ error: error.errors }, 'Validation failed');
        return reply.status(400).send({
          error: 'Validation failed',
          details: error.errors
        });
      }
      logger.error({ error }, 'Plan generation failed');
      reply.status(500).send({ error: 'Failed to generate plan' });
    }
  });
}

