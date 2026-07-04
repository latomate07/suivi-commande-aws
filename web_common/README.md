# @suivi-commande/web-common

Librairie front partagée pour la connexion WebSocket temps réel au service de suivi de commande.

## Installation

Dans `web_suivi/package.json` ou `web_stock/package.json` :

```json
{
  "dependencies": {
    "@suivi-commande/web-common": "file:../web_common"
  }
}
```

Puis build la librairie une première fois :

```bash
cd web_common
npm install
npm run build
```

Et dans l'app front :

```bash
cd web_suivi   # ou web_stock
npm install
```

## Variable d'environnement requise

L'URL WebSocket est produite par le stack SAM (output `WebSocketUrl`).  
Récupère-la après déploiement :

```bash
aws cloudformation describe-stacks \
  --stack-name suivi-commande \
  --query "Stacks[0].Outputs[?OutputKey=='WebSocketUrl'].OutputValue" \
  --output text
```

Configure-la dans ton framework :

| Framework | Variable | Fichier |
|-----------|----------|---------|
| Vite      | `VITE_WS_URL` | `.env` |
| CRA       | `REACT_APP_WS_URL` | `.env` |
| Next.js   | `NEXT_PUBLIC_WS_URL` | `.env.local` |

## Hook React — `useOrderTracking`

```tsx
import { useOrderTracking } from '@suivi-commande/web-common';

function OrderStatus({ orderId }: { orderId: string }) {
  const wsUrl = import.meta.env.VITE_WS_URL; // ou process.env.REACT_APP_WS_URL

  const { connectionState, status, lastEvent } = useOrderTracking(orderId, wsUrl);

  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return <p>Connexion en cours…</p>;
  }

  return (
    <div>
      <p>Statut : {status ?? 'inconnu'}</p>
      <p>Connexion : {connectionState}</p>
    </div>
  );
}
```

### Valeurs retournées

| Champ | Type | Description |
|-------|------|-------------|
| `connectionState` | `'connecting' \| 'open' \| 'reconnecting' \| 'closed'` | État de la connexion WebSocket |
| `status` | `OrderStatus \| null` | Dernier statut reçu |
| `lastEvent` | `OrderEvent \| null` | Dernier événement complet |

### Options

```tsx
useOrderTracking(orderId, wsUrl, {
  maxRetries: 10,        // tentatives de reconnexion (défaut : 10)
  maxDelay: 30_000,      // délai max entre tentatives en ms (défaut : 30 000)
  heartbeatInterval: 540_000, // fréquence du ping en ms (défaut : 9 min)
});
```

## Client bas niveau — `OrderWebSocketClient`

```ts
import { OrderWebSocketClient } from '@suivi-commande/web-common';

const client = new OrderWebSocketClient({ wsUrl: 'wss://...' });

const unsubMsg = client.onMessage((event) => {
  console.log(event.type, event.status);
});

const unsubState = client.onStateChange((state) => {
  console.log('WebSocket state:', state);
});

client.connect('PRD-001');

// Plus tard :
unsubMsg();
unsubState();
client.disconnect();
```

## Contrat des messages (format des événements)

Tous les messages reçus par le client WebSocket sont des objets JSON typés :

### `OrderCreated`

```json
{
  "type": "OrderCreated",
  "orderId": "PRD-001",
  "status": "preparation",
  "previousStatus": null,
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T00:00:00.000Z"
}
```

### `OrderStatusChanged`

```json
{
  "type": "OrderStatusChanged",
  "orderId": "PRD-001",
  "status": "expedie",
  "previousStatus": "preparation",
  "createdAt": "2026-01-01T00:00:00.000Z",
  "updatedAt": "2026-01-01T01:00:00.000Z"
}
```

### Valeurs de `status`

`preparation` | `expedie` | `livre` | `annule`

## Reconnexion automatique

- Backoff exponentiel : 1s → 2s → 4s → … (plafonné à `maxDelay`)
- Jitter aléatoire de 0–1 s ajouté à chaque délai
- Arrêt définitif après `maxRetries` tentatives (état `closed`)
- Heartbeat JSON `{"action":"ping"}` envoyé toutes les 9 min pour éviter le timeout idle de 10 min d'API Gateway

## Tests

```bash
cd web_common
npm install
npm test
```

Les tests couvrent :
- `parseMessage` : parsing et validation des events
- `computeBackoff` : logique de backoff exponentiel + jitter
- `OrderWebSocketClient` : connexion, reconnexion, arrêt, émission d'événements (WebSocket mocké)
