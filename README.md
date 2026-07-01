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

## Démarrage local

1. Installer les outils déclarés dans `.mise.toml` avec `mise install`.
2. Lancer une validation rapide avec `mise exec -- ruby -e "require 'yaml'; YAML.load_file('template.yml')"`.
3. Développer ensuite chaque périmètre dans son dossier dédié.

## CI/CD

- Le workflow CI vérifie le template SAM et l'arborescence de base sur les PR et les push vers `main` ou `develop`.
- Le workflow CD déploie la stack SAM manuellement via GitHub Actions, AWS OIDC et les secrets du dépôt.
