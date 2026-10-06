import { refreshCookieName } from '../common/auth-cookie.js';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import type { ApiConfig } from '@crm/config/server';
import { requestContext } from '../common/request-context.js';
import { HttpErrorFilter } from '../common/http-error.filter.js';
import type { StructuredLogger } from '../modules/runtime/index.js';
export function configureHttp(
  app: INestApplication,
  config: ApiConfig,
  logger: StructuredLogger,
): void {
  app.use(requestContext(logger));
  app.use(helmet());
  app.enableCors({
    origin: config.CORS_ORIGINS,
    credentials: true,
    exposedHeaders: ['X-Request-Id', 'X-Correlation-Id'],
  });
  app.useGlobalFilters(new HttpErrorFilter(logger));
  app.setGlobalPrefix('api/v1', { exclude: ['health', 'health/live', 'health/ready'] });
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('CRM — Foundation API')
      .setDescription(
        'Session-backed bearer authentication; tenant permissions and scopes. Cookie auth flows require an allowed Origin. No administrative endpoint is public.',
      )
      .addCookieAuth(
        refreshCookieName(config),
        {
          type: 'apiKey',
          in: 'cookie',
          description:
            'Refresh only; HttpOnly. Login/refresh/logout require allowed Origin and JSON.',
        },
        'refresh',
      )
      .addBearerAuth()
      .setVersion('1.0.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, document, {
    jsonDocumentUrl: 'docs/openapi.json',
    swaggerOptions: { persistAuthorization: false },
  });
}
