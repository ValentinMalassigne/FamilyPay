import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthModule } from './health/health.module.js';
import { UsersModule } from './users/users.module.js';
import { AuthModule } from './auth/auth.module.js';
import { TransactionsModule } from './transactions/transactions.module.js';
import { PubSubModule } from './pubsub/pubsub.module.js';

/*
 * AppModule : module racine de l'application NestJS.
 * NestJS est construit autour d'un système de modules : chaque module regroupe
 * des contrôleurs, providers et autres modules liés à une fonctionnalité.
 * Le module racine assemble les modules de toute l'app.
 */
@Module({
  imports: [
    /*
     * ConfigModule : charge les variables d'environnement (fichier .env + env système)
     * et les expose via ConfigService.
     * isGlobal: true → ConfigService est injectable partout sans réimporter ConfigModule
     * dans chaque module. C'est l'usage standard pour une config d'application.
     */
    ConfigModule.forRoot({ isGlobal: true }),

    /*
     * GraphQLModule : configure le serveur GraphQL Apollo en mode "code-first".
     *
     * En code-first, on définit les types GraphQL via des classes TypeScript décorées
     * (@ObjectType, @Field, @InputType...) et NestJS génère le schéma SDL automatiquement
     * à partir de ces classes. C'est l'approche recommandée par NestJS car elle évite de
     * dupliquer les modèles entre TypeScript et GraphQL (voir PROJECT_CONTEXT.md §3).
     *
     * - driver: ApolloDriver → utilise Apollo Server comme runtime GraphQL.
     *   NestJS supporte plusieurs drivers (Apollo, Mercurius...), on a choisi Apollo
     *   pour sa documentation et sa communauté large (voir PROJECT_CONTEXT.md §3).
     * - autoSchemaFile: true → le schéma est généré en mémoire, pas écrit dans un fichier.
     *   Le schéma reste consultable via le playground / l'introspection GraphQL.
     * - playground: true → active l'interface web GraphQL Playground sur /graphql,
     *   utile pour tester queries/mutations en dev.
     *
     * ApolloDriverConfig est le type qui décrit les options acceptées par le driver Apollo.
     */
    /*
     * GraphQLModule : configure le serveur GraphQL Apollo avec support des subscriptions.
     *
     * En plus de la configuration de base (code-first, autoSchemaFile), on active
     * les subscriptions via WebSocket. Apollo Server gère automatiquement le protocole
     * GraphQL over WebSocket (GQL_WS) pour les subscriptions.
     *
     * - subscriptions: { 'graphql-ws': true } : active le support des subscriptions
     *   via le protocole graphql-ws (standard pour GraphQL over WebSocket).
     *   Cela permet aux clients de s'abonner à des événements en temps réel.
     */
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      playground: true,
      subscriptions: {
        'graphql-ws': true,
      },
    }),

    /*
     * TypeOrmModule : configure la connexion à PostgreSQL via TypeORM.
     *
     * forRootAsync (au lieu de forRoot) : permet une configuration asynchrone en injectant
     * ConfigService pour lire les variables d'environnement. C'est nécessaire car la lecture
     * de la config peut être asynchrone et ça évite d'accéder directement à process.env.
     *
     * - imports: [ConfigModule] → importe ConfigModule pour que ConfigService soit disponible
     *   dans ce useFactory.
     * - inject: [ConfigService] → NestJS injecte ConfigService en paramètre du useFactory.
     * - useFactory : fonction qui retourne la configuration TypeORM.
     *   - type: 'postgres' → pilote PostgreSQL (le driver 'pg' installé).
     *   - url : URL de connexion complète lue depuis DATABASE_URL (ex: postgresql://user:pass@host:5432/db).
     *     Utiliser une URL permet de remplacer PostgreSQL par une instance managée (ex: RDS)
     *     sans changer le code — seule la variable change (voir PROJECT_CONTEXT.md §9).
     *   - autoLoadEntities: true → les entités déclarées via TypeOrmModule.forFeature([MonEntity])
     *     dans les modules sont automatiquement enregistrées dans la connexion.
     *     On n'a pas besoin de lister tous les fichiers d'entités à la main.
     *   - synchronize : true en dev → TypeORM crée/met à jour les tables à partir des entités.
     *     À DÉSACTIVER en production (risque de perte de données) → utiliser des migrations.
     */
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres' as const,
        url: configService.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: configService.get<string>('NODE_ENV') !== 'production',
      }),
    }),

    // PubSubModule : module global pour les subscriptions GraphQL (Pub/Sub in-memory).
    PubSubModule,

    // HealthModule : endpoint GET /health pour le health-check (load balancer / orchestrateur cloud).
    HealthModule,

    // UsersModule : entités User/Family/ChildAccount + resolvers (me, createChildAccount, createParentAccount).
    UsersModule,

    // AuthModule : login + signup, JWT, guards (GqlAuthGuard, RolesGuard).
    AuthModule,

    // TransactionsModule : transactions, historique, recharge, dépenses + subscriptions.
    TransactionsModule,
  ],
})
export class AppModule {}
