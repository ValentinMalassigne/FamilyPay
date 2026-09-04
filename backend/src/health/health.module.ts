import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { HealthResolver } from './health.resolver.js';

/*
 * HealthModule : module NestJS regroupant le endpoint de health-check.
 *
 * @Module() : décorateur qui déclare un module NestJS. Un module organise un ensemble
 * de contrôleurs et/ou providers liés à une fonctionnalité. Ici on expose le
 * HealthController (route REST GET /health) et le HealthResolver (query GraphQL `health`).
 *
 * controllers: [HealthController] → enregistre le contrôleur REST dans le module.
 * providers: [HealthResolver] → enregistre le resolver GraphQL comme un provider.
 * NestJS découvre les handlers @Query/@Mutation dans les providers du module pour
 * générer le schéma GraphQL.
 */
@Module({
  controllers: [HealthController],
  providers: [HealthResolver],
})
export class HealthModule {}
