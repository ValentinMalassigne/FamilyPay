import { Module, Global } from '@nestjs/common';
import { PubSub } from 'graphql-subscriptions';

/*
 * PubSubModule : module global fournissant une instance PubSub pour les subscriptions GraphQL.
 *
 * @Global() : ce module est global → son provider (PUB_SUB) est injectable dans
 * TOUS les modules de l'application sans avoir à importer PubSubModule partout.
 *
 * Pourquoi PubSub ?
 * GraphQL Subscriptions nécessitent un mécanisme de pub/sub (publish/subscribe) pour
 * notifier les clients abonnés quand un événement se produit (ex: mise à jour du solde).
 * `graphql-subscriptions` fournit une implémentation in-memory simple (PubSub) qui
 * suffit pour un MVP local. Pour un déploiement cloud, on remplacerait par Redis.
 *
 * @Inject('PUB_SUB') : dans les services/resolvers, on injecte le token 'PUB_SUB'
 * pour accéder à l'instance PubSub.
 */
@Global()
@Module({
  providers: [
    {
      provide: 'PUB_SUB',
      useValue: new PubSub(),
    },
  ],
  exports: ['PUB_SUB'],
})
export class PubSubModule {}
