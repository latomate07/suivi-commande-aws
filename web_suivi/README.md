# Web Suivi

Application React (Vite + Tailwind CSS + shadcn/ui) qui affiche un catalogue produit et permet de commander un
produit. Une fois commandé, l'avancement de la commande est suivi via l'API serverless publique déployée sur AWS.

## API

`src/lib/api.js` pointe vers l'API publique déployée :

```
https://qrrj372ee2.execute-api.eu-west-1.amazonaws.com/dev
```

Cette API n'expose que `POST /create/{orderId}` et `GET /track/{orderId}` (voir `backend/src/handlers/`). Elle ne
relie pas une commande à un produit et n'a pas de route publique de catalogue (`GET /list/products` existe mais est
protégée par Cognito sur l'API admin, non branchée ici). En conséquence :

- Le catalogue produit (`PRODUCTS_CATALOG` dans `src/lib/api.js`) est **statique côté front**, en miroir des mêmes
  produits que `backend/src/handlers/listProducts.ts`.
- L'association entre un `orderId` et le produit commandé est stockée **côté client** (`src/lib/orderStore.js`,
  `localStorage`), puisque le backend ne la connaît pas. Ouvrir un lien de suivi sur un autre appareil/navigateur
  affichera le statut mais pas le produit associé.
- Le vocabulaire de statut réel du backend est `preparation / expedie / livre / annule` (voir
  `backend/src/handlers/updateOrder.ts`).

## Lancer en local

```bash
cd web_suivi
npm install
npm run dev
```

Puis ouvrir [http://127.0.0.1:5174](http://127.0.0.1:5174).

## Build

```bash
npm run build
```

## Fonctionnement

- Le bouton **Commander** génère un `orderId` côté client et appelle `POST /create/{orderId}` sur l'API réelle.
- Une **modal** (shadcn `Dialog`) confirme l'enregistrement avec un bouton **Suivre la commande** vers `#/orders/{orderId}`.
- La page de suivi dédiée (`OrderTrackingPage`) affiche un stepper vertical (Préparation → Expédiée → Livrée), ou un
  bandeau dédié si la commande est annulée.
- Le site sonde `GET /track/{orderId}` toutes les 3 secondes pour refléter tout changement de statut fait côté
  backend (console AWS, API admin, etc.), sans rechargement.
