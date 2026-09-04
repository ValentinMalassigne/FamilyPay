import { Controller, Get } from '@nestjs/common';

/*
 * HealthController : endpoint de health-check exposé sur GET /health.
 *
 * @Controller('health') : décorateur NestJS qui déclare cette classe comme un contrôleur
 * REST. Le préfixe 'health' signifie que toutes les routes de cette classe sont sous /health.
 *
 * Utilité (voir PROJECT_CONTEXT.md §9) : un load balancer ou orchestrateur cloud (Docker,
 * Kubernetes, ECS...) appelle /health pour savoir si le service est prêt à recevoir du
 * trafic. Réponse 200 = OK.
 *
 * Ce contrôleur est volontairement hors du module GraphQL : c'est un simple endpoint REST,
 * pas une query GraphQL.
 */
@Controller('health')
export class HealthController {
  /*
   * @Get() : décorateur qui mappe une requête HTTP GET sur cette méthode.
   * Sans argument, il correspond au chemin du contrôleur (/health).
   * Retourne un objet simple { status: 'ok' } → NestJS le sérialise en JSON.
   */
  @Get()
  check() {
    return { status: 'ok' };
  }
}
