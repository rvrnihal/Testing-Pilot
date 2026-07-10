# QA Copilot Azure Deployment

This repo is best deployed to Azure as:

- Web: Azure Container Apps
- API: Azure Container Apps
- Database: Azure Database for PostgreSQL Flexible Server
- Secrets: Azure Key Vault
- Images: Azure Container Registry

This app already has separate runtime paths for:

- Next.js frontend in the repo root
- Express API in `backend/src/server.ts`
- Prisma/PostgreSQL in `prisma/schema.prisma`

## 1. Prerequisites

Install locally:

- Azure CLI
- Docker Desktop
- Node.js 20+

Login:

```powershell
az login
```

Pick names once and reuse them:

```powershell
$RG="qa-copilot-rg"
$LOCATION="centralindia"
$PG="qa-copilot-pg"
$DB="qacopilot"
$KV="qa-copilot-kv"
$ACR="qacopilotacr"
$ENV="qa-copilot-env"
$API_APP="qa-copilot-api"
$WEB_APP="qa-copilot-web"
```

## 2. Create the resource group

```powershell
az group create --name $RG --location $LOCATION
```

## 3. Create Azure PostgreSQL Flexible Server

```powershell
az postgres flexible-server create `
  --resource-group $RG `
  --name $PG `
  --location $LOCATION `
  --admin-user qaadmin `
  --admin-password "<STRONG_PASSWORD>" `
  --sku-name Standard_B1ms `
  --tier Burstable `
  --version 16 `
  --storage-size 32
```

Create the database:

```powershell
az postgres flexible-server db create `
  --resource-group $RG `
  --server-name $PG `
  --database-name $DB
```

Production connection string format:

```text
postgresql://qaadmin:<PASSWORD>@qa-copilot-pg.postgres.database.azure.com:5432/qacopilot?sslmode=require
```

## 4. Create Azure Key Vault

```powershell
az keyvault create `
  --name $KV `
  --resource-group $RG `
  --location $LOCATION `
  --enable-rbac-authorization true
```

Store secrets:

```powershell
az keyvault secret set --vault-name $KV --name DATABASE-URL --value "<DATABASE_URL>"
az keyvault secret set --vault-name $KV --name JWT-SECRET --value "<JWT_SECRET>"
az keyvault secret set --vault-name $KV --name OPENAI-API-KEY --value "<OPENAI_API_KEY>"
az keyvault secret set --vault-name $KV --name OPENAI-ADMIN-API-KEY --value "<OPENAI_ADMIN_API_KEY>"
az keyvault secret set --vault-name $KV --name OPENAI-USAGE-API-KEY-ID --value "<OPENAI_USAGE_API_KEY_ID>"
az keyvault secret set --vault-name $KV --name OPENAI-USAGE-TOKEN-LIMIT --value "0"
az keyvault secret set --vault-name $KV --name OPENAI-MODEL --value "gpt-4.1-mini"
az keyvault secret set --vault-name $KV --name STRIPE-SECRET-KEY --value "<STRIPE_SECRET_KEY>"
az keyvault secret set --vault-name $KV --name STRIPE-PRICE-STARTER --value "<STRIPE_PRICE_STARTER>"
az keyvault secret set --vault-name $KV --name STRIPE-PRICE-GROWTH --value "<STRIPE_PRICE_GROWTH>"
az keyvault secret set --vault-name $KV --name STRIPE-PRICE-SCALE --value "<STRIPE_PRICE_SCALE>"
```

## 5. Create Azure Container Registry

```powershell
az acr create `
  --resource-group $RG `
  --name $ACR `
  --sku Basic
```

Login:

```powershell
az acr login --name $ACR
```

## 6. Build and push images

Web image:

```powershell
docker build -f Dockerfile.web -t "$ACR.azurecr.io/qa-copilot-web:latest" .
docker push "$ACR.azurecr.io/qa-copilot-web:latest"
```

API image:

```powershell
docker build -f Dockerfile.api -t "$ACR.azurecr.io/qa-copilot-api:latest" .
docker push "$ACR.azurecr.io/qa-copilot-api:latest"
```

## 7. Create Container Apps environment

```powershell
az extension add --name containerapp --upgrade
az provider register --namespace Microsoft.App
az provider register --namespace Microsoft.OperationalInsights
```

```powershell
az containerapp env create `
  --name $ENV `
  --resource-group $RG `
  --location $LOCATION
```

## 8. Deploy API

```powershell
az containerapp create `
  --name $API_APP `
  --resource-group $RG `
  --environment $ENV `
  --image "$ACR.azurecr.io/qa-copilot-api:latest" `
  --target-port 4000 `
  --ingress external `
  --registry-server "$ACR.azurecr.io"
```

Get the API URL:

```powershell
az containerapp show --name $API_APP --resource-group $RG --query properties.configuration.ingress.fqdn
```

Set API environment variables:

```powershell
az containerapp update `
  --name $API_APP `
  --resource-group $RG `
  --set-env-vars `
  API_PORT=4000 `
  DATABASE_URL="<DATABASE_URL>" `
  JWT_SECRET="<JWT_SECRET>" `
  OPENAI_API_KEY="<OPENAI_API_KEY>" `
  OPENAI_ADMIN_API_KEY="<OPENAI_ADMIN_API_KEY>" `
  OPENAI_USAGE_API_KEY_ID="<OPENAI_USAGE_API_KEY_ID>" `
  OPENAI_USAGE_TOKEN_LIMIT="0" `
  OPENAI_MODEL="gpt-4.1-mini" `
  STRIPE_SECRET_KEY="<STRIPE_SECRET_KEY>" `
  STRIPE_PRICE_STARTER="<STRIPE_PRICE_STARTER>" `
  STRIPE_PRICE_GROWTH="<STRIPE_PRICE_GROWTH>" `
  STRIPE_PRICE_SCALE="<STRIPE_PRICE_SCALE>" `
  NEXT_PUBLIC_APP_URL="https://<WEB_FQDN>" `
  CORS_ORIGIN="https://<WEB_FQDN>"
```

## 9. Push Prisma schema and seed data

Set your production DB URL in the shell first:

```powershell
$env:DATABASE_URL="postgresql://qaadmin:<PASSWORD>@qa-copilot-pg.postgres.database.azure.com:5432/qacopilot?sslmode=require"
```

Then run:

```powershell
npm run db:push
npm run db:seed
```

## 10. Deploy Web

```powershell
az containerapp create `
  --name $WEB_APP `
  --resource-group $RG `
  --environment $ENV `
  --image "$ACR.azurecr.io/qa-copilot-web:latest" `
  --target-port 3000 `
  --ingress external `
  --registry-server "$ACR.azurecr.io"
```

Get the web URL:

```powershell
az containerapp show --name $WEB_APP --resource-group $RG --query properties.configuration.ingress.fqdn
```

Set web environment variables:

```powershell
az containerapp update `
  --name $WEB_APP `
  --resource-group $RG `
  --set-env-vars `
  NEXT_PUBLIC_API_URL="https://<API_FQDN>/api" `
  NEXT_PUBLIC_APP_URL="https://<WEB_FQDN>"
```

After the web URL is known, go back and update the API app if you used placeholders for `CORS_ORIGIN` or `NEXT_PUBLIC_APP_URL`.

## 11. Smoke test production

Check the API first:

```text
https://<API_FQDN>/api/health
```

Then test in this order:

1. Open the web app
2. Sign up / login
3. Dashboard loads
4. Create project
5. Generate test cases
6. Generate release risk
7. Export Excel
8. Export PDF
9. Run website QA / visual QA
10. Test billing if Stripe is enabled

## 12. Common issues

### Frontend cannot call API

Usually caused by:

- wrong `NEXT_PUBLIC_API_URL`
- wrong `CORS_ORIGIN`

### API fails on website QA or PDF features

Usually caused by:

- missing Playwright runtime dependencies
- container memory too low

This repo already includes a Playwright-capable API Dockerfile at `Dockerfile.api`.

### Prisma cannot connect

Check:

- `DATABASE_URL`
- Azure PostgreSQL firewall/network settings
- `sslmode=require`

## 13. Recommended next hardening steps

- Move container app secrets to Key Vault references
- Add custom domains
- Add TLS certificates
- Add Azure Front Door
- Add Application Insights
- Add CI/CD from GitHub Actions or Azure DevOps

## 14. Optional one-script helper

This repo now includes:

- `scripts/deploy-azure.ps1`

You can run the deployment in stages instead of copy-pasting every Azure CLI command manually.

Example:

```powershell
.\scripts\deploy-azure.ps1 `
  -CreateResources `
  -PushSecrets `
  -BuildImages `
  -DeployApps `
  -PostgresAdminPassword "<STRONG_PASSWORD>" `
  -JwtSecret "<JWT_SECRET>" `
  -OpenAiApiKey "<OPENAI_API_KEY>" `
  -OpenAiAdminApiKey "<OPENAI_ADMIN_API_KEY>" `
  -OpenAiUsageApiKeyId "<OPENAI_USAGE_API_KEY_ID>" `
  -StripeSecretKey "<STRIPE_SECRET_KEY>" `
  -StripePriceStarter "<STRIPE_PRICE_STARTER>" `
  -StripePriceGrowth "<STRIPE_PRICE_GROWTH>" `
  -StripePriceScale "<STRIPE_PRICE_SCALE>"
```

If you only want to build and deploy after resources already exist:

```powershell
.\scripts\deploy-azure.ps1 `
  -BuildImages `
  -DeployApps `
  -PostgresAdminPassword "<STRONG_PASSWORD>" `
  -JwtSecret "<JWT_SECRET>" `
  -OpenAiApiKey "<OPENAI_API_KEY>"
```

To print the current live URLs:

```powershell
.\scripts\deploy-azure.ps1 -ShowUrls
```
