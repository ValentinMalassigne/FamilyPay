import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // app.enableCors() : autorise les requêtes cross-origin (CORS).
  // Le frontend Next.js (port 3001) et l'app Flutter appellent l'API depuis
  // une origine différente de celle du backend (port 3000). Sans CORS, le
  // navigateur bloquerait ces requêtes. enableCors() sans argument autorise
  // toutes les origins — suffisant pour le dev, à restreindre en production.
  app.enableCors();

  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
