# Preparar a Central no Mac

Este pacote foi reconstruído a partir do snapshot completo v26 e já inclui a aba Envios e a documentação técnica.

## Instalação

```bash
mkdir -p ~/Projetos
cd ~/Projetos
unzip ~/Downloads/central-oabjf-v26-envios.zip
cd central-oabjf-v26-envios
./scripts/fetch-live-assets.sh
npm install
npm run build:pages
```

## Criar repositório Git local

```bash
git init
git branch -M main
git add .
git commit -m "feat: consolida Central e adiciona gestão de envios diários"
```

## Vincular o perfil Cloudflare correto

```bash
npx wrangler auth activate oab-jf "$PWD"
npx wrangler pages project list --profile oab-jf
```

Confirme que `central-oabjf` aparece antes de publicar.

## Publicar no Cloudflare Pages

```bash
npx wrangler pages deploy dist-pages --project-name central-oabjf --profile oab-jf
```
