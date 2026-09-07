import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import * as cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Security HTTP headers — protects against clickjacking, MIME sniffing,
  // some XSS vectors, and forces HTTPS in production via HSTS. We disable
  // CSP at the API layer because the API serves only JSON, not HTML; the
  // Next.js app sets its own CSP for the HTML it serves.
  app.use(helmet({ contentSecurityPolicy: false }));

  app.use(cookieParser());

  app.setGlobalPrefix('api/v1');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`\n🚀 Aksioma API running → http://localhost:${port}/api/v1\n`);
}

bootstrap();
