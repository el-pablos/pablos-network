import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { generateWithGemini } from '../gemini';
import { createLogger } from '@pablos/utils';

const logger = createLogger('ai-report');

const ReportRequestSchema = z.object({
  domain: z.string(),
  findings: z.array(z.any()),
  assets: z.array(z.any()).optional(),
  metadata: z.any().optional(),
});

export async function reportRoute(app: FastifyInstance) {
  app.post('/report', async (request, reply) => {
    try {
      const body = ReportRequestSchema.parse(request.body);

      const systemInstruction = `You are a security report generator for Pablos Network.
Generate a comprehensive markdown report with:
1. Executive Summary
2. Scope & Methodology
3. Key Findings (grouped by severity)
4. Technical Details
5. Recommendations
6. Conclusion

Use professional security language. Be clear and actionable.`;

      const findingsSummary = body.findings.map((f) => ({
        title: f.title,
        severity: f.severity,
        category: f.category,
      }));

      const prompt = `Domain: ${body.domain}
Total Findings: ${body.findings.length}
Assets Scanned: ${body.assets?.length || 0}

Findings Summary:
${JSON.stringify(findingsSummary, null, 2)}

Full Findings:
${JSON.stringify(body.findings, null, 2)}

Generate comprehensive security report in markdown:`;

      const report = await generateWithGemini(prompt, systemInstruction);

      logger.info({ domain: body.domain, findingsCount: body.findings.length }, 'Report generated');

      return { 
        report,
        metadata: {
          domain: body.domain,
          generatedAt: new Date().toISOString(),
          findingsCount: body.findings.length,
        }
      };
    } catch (error) {
      logger.error({ error }, 'Report generation failed');
      reply.status(500).send({ error: 'Failed to generate report' });
    }
  });
}

