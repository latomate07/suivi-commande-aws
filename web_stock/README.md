# Web Suivi

Application React dédiée au suivi des commandes et à l'administration des statuts de livraison.

## Lancer en local

```bash
cd web_suivi
npm install
npm run dev
```

Puis ouvrir :

```text
http://127.0.0.1:5173/admin.html
http://127.0.0.1:5173/orders.html
http://127.0.0.1:5173/products.html
```

La page Produits nécessite l'API locale partagée avec `web_suivi` :

```bash
cd backend/local-server
npm install
npm run dev
```

## Build

```bash
npm run build
```

## Écrans

- `#/admin` : recherche d'une commande et modification du statut.
- `#/orders` : liste paginée des commandes existantes.
- `#/products` : catalogue produits, stock et statut de la commande en cours pour chaque produit (mis à jour depuis `web_suivi`).
