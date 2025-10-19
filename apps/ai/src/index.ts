import Fastify from 'fastify';
import { createLogger } from '@pablos/utils';
import { planRoute } from './routes/plan';
import { normalizeRoute } from './routes/normalize';
import { scoreRoute } from './routes/score';
import { reportRoute } from './routes/report';

const logger = createLogger('ai-service');

const app = Fastify({ logger: false });

// Register routes
app.register(planRoute);
app.register(normalizeRoute);
app.register(scoreRoute);
app.register(reportRoute);

// Health check
app.get('/health', async () => {
  return { status: 'ok', service: 'ai' };
});

const port = Number(process.env.AI_SERVICE_PORT) || 4001;

app.listen({ port, host: '0.0.0.0' }, (err, address) => {
  if (err) {
    logger.error({ err }, 'Failed to start AI service');
    process.exit(1);
  }
  logger.info({ address }, 'AI service started');
});

