import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';

/*
 * HealthModule : module NestJS regroupant le endpoint de health-check.
 *
 * @Module() : décorateur qui déclare un module NestJS. Un module organise un ensemble
 * de contrôleurs et/ou providers liés à une fonctionnalité. Ici on expose juste
 * HealthController pour la route GET /health.
 *
 * controllers: [HealthController] → enregistre le contrôleur dans le module.
 * NestJS l'injectera dans l'arborescence des routes quand HealthModule est importé
 * dans AppModule.
 */
@Module({
  controllers: [HealthController],
})
export class HealthModule {}
