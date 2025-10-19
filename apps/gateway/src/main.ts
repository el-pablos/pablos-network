import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { createLogger } from '@pablos/utils';

const logger = createLogger('gateway');

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: false })
  );

  // Enable CORS
  app.enableCors({
    origin: '*',
    credentials: true,
  });

  // Swagger/OpenAPI
  const config = new DocumentBuilder()
    .setTitle('Pablos Network API')
    .setDescription('OSINT + AppSec orchestrator API')
    .setVersion('1.0')
    .addTag('scope', 'Asset scope management')
    .addTag('scan', 'Scan operations')
    .addTag('findings', 'Security findings')
    .addTag('assets', 'Asset information')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.GATEWAY_PORT || 4000;
  await app.listen(port, '0.0.0.0');

  logger.info({ port }, 'Gateway started');
  logger.info(`OpenAPI docs available at http://localhost:${port}/docs`);
}

bootstrap().catch((error) => {
  logger.error({ error }, 'Failed to start gateway');
  process.exit(1);
});

