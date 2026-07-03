# Backend

Dossier réservé au backend serverless.

## Convention

- `src/handlers/`: points d'entrée Lambda
- `src/services/`: logique métier
- `src/repositories/`: accès aux données
- `src/models/`: modèles de domaine
- `src/events/`: objets ou contrats d'événements
- `src/shared/`: utilitaires communs
- `tests/`: tests automatisés

## Point de depart

- `src/handlers/getOrders.ts`: Lambda HTTP de test pour valider le deploiement via `GET /orders`
