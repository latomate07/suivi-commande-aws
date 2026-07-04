# Suivi Commande AWS

Application serverless de suivi de commandes en temps réel, déployée sur AWS avec SAM.

## Architecture

```
web_suivi (S3 + CloudFront)          web_stock (S3 + CloudFront)
        │                                      │
        │ GET /track/{orderId}                 │ GET  /list/orders
        │ POST /create/{orderId}               │ GET  /list/products
        ▼                                      │ PUT  /update/{orderId}
  API publique (REST)              API admin (REST + Cognito)
        │                                      │
        └──────────────┬───────────────────────┘
                       ▼
              Lambda handlers
                       │
              DynamoDB (OrdersTable)
                       │  DDB Streams
                       ▼
              Lambda (OrderEventFormatter)
                       │
              EventBridge (custom bus)
                       │
              SQS (OrderEventsQueue)
                       │
              Lambda (PushNotifier)
                       │
        API Gateway WebSocket ◄──── web_suivi / web_stock
        (WebSocketConnectionsTable)
```

## Structure

- `web_suivi/`: interface web pour le suivi des commandes
- `web_stock/`: interface web pour la gestion du stock
- `backend/`: logique métier, handlers et intégrations AWS
- `infra/`: notes et fichiers liés à l'infrastructure
- `template.yml`: squelette d'infrastructure AWS serverless

test
