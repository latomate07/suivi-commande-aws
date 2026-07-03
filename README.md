# Suivi Commande AWS

Monorepo de travail pour une application serverless AWS.

## Structure

- `web_suivi/`: interface web pour le suivi des commandes
- `web_stock/`: interface web pour la gestion du stock
- `backend/`: logique métier, handlers et intégrations AWS
- `infra/`: notes et fichiers liés à l'infrastructure
- `template.yml`: squelette d'infrastructure AWS serverless
- `.mise.toml`: versions d'outils partagées via `mise`
- `.github/workflows/ci.yml`: validation automatique sur PR et push
- `.github/workflows/cd.yml`: déploiement manuel de la stack SAM
