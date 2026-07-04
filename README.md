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

| Dossier | Rôle |
|---------|------|
| `backend/` | Handlers Lambda (TypeScript, SAM esbuild) |
| `web_suivi/` | Interface client — suivi de commande |
| `web_stock/` | Interface back-office — gestion du stock |
| `web_common/` | Librairie partagée — client WebSocket + hook React |
| `template.yml` | Infrastructure SAM (IaC complet) |
| `.github/workflows/` | CI + CD GitHub Actions |
| `.mise.toml` | Versions d'outils partagées via `mise` |

---

## Déploiement

### Prérequis

- AWS CLI configuré (ou OIDC via GitHub Actions)
- SAM CLI installé
- Node.js 20+

### 1 — Backend (SAM)

```bash
npm ci --prefix backend
sam build --template-file template.yml
sam deploy \
  --stack-name suivi-commande \
  --region eu-west-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM \
  --parameter-overrides EnvironmentName=dev
```

Ou via GitHub Actions → **Actions → CD → Run workflow**.

### 2 — Récupérer les outputs

```bash
aws cloudformation describe-stacks \
  --stack-name suivi-commande \
  --query "Stacks[0].Outputs" \
  --output table
```

Outputs disponibles :

| Clé | Description |
|-----|-------------|
| `PublicApiUrl` | Base URL de l'API publique |
| `AdminApiUrl` | Base URL de l'API admin |
| `WebSocketUrl` | URL WebSocket (`wss://…`) |
| `AdminUserPoolId` | Cognito User Pool ID |
| `AdminUserPoolClientId` | Cognito Client ID |
| `WebSuiviUrl` | URL CloudFront de web_suivi |
| `WebStockUrl` | URL CloudFront de web_stock |
| `WebSuiviBucketName` | Bucket S3 de web_suivi |
| `WebStockBucketName` | Bucket S3 de web_stock |

### 3 — Frontends

Via GitHub Actions → **Actions → Deploy web-suivi (ou web-stock) → Run workflow**.

Le workflow :
1. Récupère automatiquement les outputs du stack SAM
2. Injecte les variables d'environnement dans le build Vite
3. Sync `dist/` vers S3 avec le cache approprié (assets immutables, `index.html` no-cache)
4. Invalide le cache CloudFront

---

## API publique — sans authentification

Base URL : `PublicApiUrl`

### `POST /create/{orderId}`

Crée une commande avec le statut `preparation`.

```bash
curl -X POST https://<api>/dev/create/CMD-001
```

Réponse `201` :
```json
{ "orderId": "CMD-001", "status": "preparation", "createdAt": "…", "updatedAt": "…" }
```

Réponse `409` si la commande existe déjà.

### `GET /track/{orderId}`

Retourne le statut d'une commande.

```bash
curl https://<api>/dev/track/CMD-001
```

Réponse `200` :
```json
{ "orderId": "CMD-001", "status": "expedie", "createdAt": "…", "updatedAt": "…" }
```

Réponse `404` si introuvable.

---

## API admin — Cognito requis

Base URL : `AdminApiUrl`

Toutes les routes requièrent un header `Authorization: Bearer <id_token>`.

### Obtenir un token (dev)

```bash
# Créer un utilisateur de test (une seule fois)
aws cognito-idp admin-create-user \
  --user-pool-id <AdminUserPoolId> \
  --username admin@example.com \
  --temporary-password Temp1234!

aws cognito-idp admin-set-user-password \
  --user-pool-id <AdminUserPoolId> \
  --username admin@example.com \
  --password Admin1234 \
  --permanent

# Récupérer le token
TOKEN=$(aws cognito-idp initiate-auth \
  --auth-flow USER_PASSWORD_AUTH \
  --auth-parameters USERNAME=admin@example.com,PASSWORD=Admin1234 \
  --client-id <AdminUserPoolClientId> \
  --query "AuthenticationResult.IdToken" \
  --output text)
```

### `GET /list/orders`

```bash
curl -H "Authorization: Bearer $TOKEN" https://<api>/dev/list/orders
```

Réponse `200` :
```json
{ "orders": [ { "orderId": "CMD-001", "status": "preparation", … } ] }
```

### `GET /list/products`

Catalogue produits (données en dur, pour les tests).

```bash
curl -H "Authorization: Bearer $TOKEN" https://<api>/dev/list/products
```

Réponse `200` :
```json
{
  "products": [
    { "productId": "PROD-001", "name": "T-shirt Classique", "price": 29.99, "stock": 150, "category": "vetements" },
    …
  ]
}
```

### `PUT /update/{orderId}`

Met à jour le statut d'une commande. Déclenche le flux DDB Streams → EventBridge → SQS → WebSocket push.

```bash
curl -X PUT \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status": "expedie"}' \
  https://<api>/dev/update/CMD-001
```

Valeurs de `status` acceptées : `preparation` | `expedie` | `livre` | `annule`

Réponse `200` avec l'objet mis à jour. Réponse `404` si introuvable.

---

## WebSocket temps réel

L'URL WebSocket est disponible dans l'output `WebSocketUrl`.

Connexion avec abonnement à une commande :
```
wss://<ws-api>/dev?orderId=CMD-001
```

La librairie `web_common` gère la connexion, la reconnexion et les événements automatiquement.
Voir [`web_common/README.md`](web_common/README.md) pour l'intégration.

---

## Variables d'environnement front

Les workflows GitHub Actions injectent automatiquement ces variables au build.
Pour le développement local, créer un fichier `.env` dans chaque app :

**web_suivi** :
```env
VITE_WS_URL=wss://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
VITE_API_URL=https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
```

**web_stock** :
```env
VITE_WS_URL=wss://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
VITE_API_URL=https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
VITE_ADMIN_API_URL=https://xxxxx.execute-api.eu-west-1.amazonaws.com/dev
VITE_COGNITO_USER_POOL_ID=eu-west-1_XXXXXXXXX
VITE_COGNITO_CLIENT_ID=XXXXXXXXXXXXXXXXXXXXXXXXXX
```

---

## Workflows GitHub Actions

| Workflow | Déclencheur | Rôle |
|----------|-------------|------|
| `ci.yml` | PR + push master | Valide le template YAML et la structure du repo |
| `cd.yml` | Manuel | Déploie le backend SAM (Lambdas + DynamoDB + APIs + CloudFront infra) |
| `deploy-web-suivi.yml` | Manuel | Build + S3 sync + invalidation CloudFront pour web_suivi |
| `deploy-web-stock.yml` | Manuel | Build + S3 sync + invalidation CloudFront pour web_stock |

**Ordre de déploiement initial :**
1. `cd.yml` → crée toute l'infrastructure (S3 buckets, CloudFront, APIs, etc.)
2. `deploy-web-suivi.yml` + `deploy-web-stock.yml` → déploient les apps dans les buckets créés

**Secret requis** : `AWS_ROLE_TO_ASSUME` (ARN du rôle IAM OIDC GitHub)
