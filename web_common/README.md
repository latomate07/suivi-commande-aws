# @suivi-commande/web-common

Librairie front partagée pour le suivi de commande en temps réel par polling.

## Installation

Dans `web_suivi/package.json` ou `web_stock/package.json` :

```json
{
  "dependencies": {
    "@suivi-commande/web-common": "file:../web_common"
  }
}
```

Build la librairie une première fois :

```bash
cd web_common && npm install && npm run build
cd ../web_suivi && npm install   # ou web_stock
```

## Variable d'environnement requise

L'URL de l'API publique est disponible dans l'output SAM `PublicApiUrl` :

```bash
aws cloudformation describe-stacks \
  --stack-name suivi-commande \
  --query "Stacks[0].Outputs[?OutputKey=='PublicApiUrl'].OutputValue" \
  --output text
```

| Framework | Variable | Fichier |
|-----------|----------|---------|
| Vite      | `VITE_API_URL` | `.env` |
| CRA       | `REACT_APP_API_URL` | `.env` |
| Next.js   | `NEXT_PUBLIC_API_URL` | `.env.local` |

## Hook React — `useOrderTracking`

```tsx
import { useOrderTracking } from '@suivi-commande/web-common';

function OrderStatus({ orderId }: { orderId: string }) {
  const apiUrl = import.meta.env.VITE_API_URL;

  const { status, order, loading, error } = useOrderTracking(orderId, apiUrl);

  if (loading) return <p>Chargement…</p>;
  if (error)   return <p>Erreur : {error}</p>;

  return <p>Statut : {status}</p>;
}
```

### Valeurs retournées

| Champ | Type | Description |
|-------|------|-------------|
| `order` | `Order \| null` | Dernier objet commande reçu |
| `status` | `OrderStatus \| null` | Champ `status` de la commande |
| `loading` | `boolean` | `true` avant la première réponse |
| `error` | `string \| null` | Message d'erreur en cas d'échec |

### Options

```tsx
useOrderTracking(orderId, apiUrl, {
  interval: 3_000,   // intervalle de polling en ms (défaut : POLL_INTERVAL_MS = 5 000)
});
```

## Fonction bas niveau — `pollOrder`

Pour les cas hors React :

```ts
import { pollOrder } from '@suivi-commande/web-common';

const stop = pollOrder(
  'CMD-001',
  'https://api.example.com/dev',
  (order) => console.log('Mise à jour :', order.status),
  {
    interval: 5_000,
    onError: (err) => console.error(err),
  },
);

// Plus tard :
stop();
```

## Changer l'intervalle par défaut globalement

Dans `web_common/src/pollOrder.ts`, modifier la constante :

```ts
export const POLL_INTERVAL_MS = 5_000; // ← changer cette valeur
```

## Format de la commande

```ts
interface Order {
  orderId: string;
  status: 'preparation' | 'expedie' | 'livre' | 'annule';
  createdAt: string; // ISO 8601
  updatedAt: string; // ISO 8601
}
```

## Tests

```bash
cd web_common && npm install && npm test
```
