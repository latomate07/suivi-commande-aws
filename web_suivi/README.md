# Web Suivi

Application React (Vite + Tailwind CSS + shadcn/ui) qui affiche le catalogue produit récupéré depuis `web_stock`
et permet de commander un produit. Une fois commandé, une barre de progression suit le statut de la commande.
Ce statut est mis à jour par l'administrateur depuis `web_stock` (page Produits) et remonte automatiquement ici
par sondage de l'API locale partagée.

## Prérequis

L'API locale partagée doit tourner (voir `backend/local-server`) :

```bash
cd backend/local-server
npm install
npm run dev
```

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

- Récupère `GET /api/products` sur l'API locale et affiche chaque produit dans une carte (shadcn `Card`).
- Le bouton **Commander** appelle `POST /api/products/:id/order`, ce qui décrémente le stock et crée une commande au statut « Préparation ».
- Tant qu'une commande est en cours, une barre de progression (shadcn `Progress`) reflète son statut (Préparation → Expédiée → En livraison → Livrée, ou Incident).
- Le site sonde l'API toutes les 3 secondes : quand le statut est changé depuis `web_stock` (page Produits), la progression se met à jour automatiquement ici, sans rechargement.
