param(
  [string]$ResourceGroup = "qa-copilot-rg",
  [string]$Location = "centralindia",
  [string]$PostgresServer = "qa-copilot-pg",
  [string]$DatabaseName = "qacopilot",
  [string]$KeyVault = "qa-copilot-kv",
  [string]$AcrName = "qacopilotacr",
  [string]$ContainerEnv = "qa-copilot-env",
  [string]$ApiApp = "qa-copilot-api",
  [string]$WebApp = "qa-copilot-web",
  [string]$PostgresAdminUser = "qaadmin",
  [string]$PostgresAdminPassword = "",
  [string]$JwtSecret = "",
  [string]$DatabaseUrl = "",
  [string]$OpenAiApiKey = "",
  [string]$OpenAiModel = "gpt-4.1-mini",
  [string]$HuggingFaceApiKey = "",
  [string]$HuggingFaceModel = "Qwen/Qwen2.5-7B-Instruct",
  [string]$StripeSecretKey = "",
  [string]$StripePriceStarter = "",
  [string]$StripePriceGrowth = "",
  [string]$StripePriceScale = "",
  [switch]$CreateResources,
  [switch]$PushSecrets,
  [switch]$BuildImages,
  [switch]$DeployApps,
  [switch]$ShowUrls
)

$ErrorActionPreference = "Stop"

function Write-Step($message) {
  Write-Host ""
  Write-Host "==> $message" -ForegroundColor Cyan
}

function Require-Command($name) {
  if (-not (Get-Command $name -ErrorAction SilentlyContinue)) {
    throw "Required command not found: $name"
  }
}

function Invoke-Az {
  param([string[]]$Arguments)
  Write-Host ("az " + ($Arguments -join " ")) -ForegroundColor DarkGray
  & az @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Azure CLI command failed."
  }
}

function Invoke-Docker {
  param([string[]]$Arguments)
  Write-Host ("docker " + ($Arguments -join " ")) -ForegroundColor DarkGray
  & docker @Arguments
  if ($LASTEXITCODE -ne 0) {
    throw "Docker command failed."
  }
}

function Ensure-Value($value, $name) {
  if ([string]::IsNullOrWhiteSpace($value)) {
    throw "Missing required value: $name"
  }
}

function Build-DatabaseUrl {
  param(
    [string]$Server,
    [string]$Database,
    [string]$User,
    [string]$Password
  )

  return "postgresql://${User}:${Password}@${Server}.postgres.database.azure.com:5432/${Database}?sslmode=require"
}

Require-Command az

if ($BuildImages) {
  Require-Command docker
}

$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

if (-not $CreateResources -and -not $PushSecrets -and -not $BuildImages -and -not $DeployApps -and -not $ShowUrls) {
  Write-Host "No action switch supplied." -ForegroundColor Yellow
  Write-Host "Use one or more of: -CreateResources -PushSecrets -BuildImages -DeployApps -ShowUrls"
  exit 0
}

if ($CreateResources -or $PushSecrets -or $DeployApps -or $ShowUrls) {
  Write-Step "Checking Azure login"
  Invoke-Az @("account", "show")
}

if ($CreateResources) {
  Ensure-Value $PostgresAdminPassword "PostgresAdminPassword"

  Write-Step "Creating resource group"
  Invoke-Az @("group", "create", "--name", $ResourceGroup, "--location", $Location)

  Write-Step "Creating PostgreSQL flexible server"
  Invoke-Az @(
    "postgres", "flexible-server", "create",
    "--resource-group", $ResourceGroup,
    "--name", $PostgresServer,
    "--location", $Location,
    "--admin-user", $PostgresAdminUser,
    "--admin-password", $PostgresAdminPassword,
    "--sku-name", "Standard_B1ms",
    "--tier", "Burstable",
    "--version", "16",
    "--storage-size", "32"
  )

  Write-Step "Creating database"
  Invoke-Az @(
    "postgres", "flexible-server", "db", "create",
    "--resource-group", $ResourceGroup,
    "--server-name", $PostgresServer,
    "--database-name", $DatabaseName
  )

  Write-Step "Creating Key Vault"
  Invoke-Az @(
    "keyvault", "create",
    "--name", $KeyVault,
    "--resource-group", $ResourceGroup,
    "--location", $Location,
    "--enable-rbac-authorization", "true"
  )

  Write-Step "Creating Azure Container Registry"
  Invoke-Az @(
    "acr", "create",
    "--resource-group", $ResourceGroup,
    "--name", $AcrName,
    "--sku", "Basic"
  )

  Write-Step "Registering Container Apps providers"
  Invoke-Az @("extension", "add", "--name", "containerapp", "--upgrade")
  Invoke-Az @("provider", "register", "--namespace", "Microsoft.App")
  Invoke-Az @("provider", "register", "--namespace", "Microsoft.OperationalInsights")

  Write-Step "Creating Container Apps environment"
  Invoke-Az @(
    "containerapp", "env", "create",
    "--name", $ContainerEnv,
    "--resource-group", $ResourceGroup,
    "--location", $Location
  )
}

if ($PushSecrets) {
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    Ensure-Value $PostgresAdminPassword "PostgresAdminPassword"
    $DatabaseUrl = Build-DatabaseUrl -Server $PostgresServer -Database $DatabaseName -User $PostgresAdminUser -Password $PostgresAdminPassword
  }

  Ensure-Value $DatabaseUrl "DatabaseUrl"
  Ensure-Value $JwtSecret "JwtSecret"

  Write-Step "Pushing secrets to Key Vault"
  $secrets = @(
    @{ Name = "DATABASE-URL"; Value = $DatabaseUrl },
    @{ Name = "JWT-SECRET"; Value = $JwtSecret },
    @{ Name = "OPENAI-API-KEY"; Value = $OpenAiApiKey },
    @{ Name = "OPENAI-MODEL"; Value = $OpenAiModel },
    @{ Name = "HUGGINGFACE-API-KEY"; Value = $HuggingFaceApiKey },
    @{ Name = "HUGGINGFACE-MODEL"; Value = $HuggingFaceModel },
    @{ Name = "STRIPE-SECRET-KEY"; Value = $StripeSecretKey },
    @{ Name = "STRIPE-PRICE-STARTER"; Value = $StripePriceStarter },
    @{ Name = "STRIPE-PRICE-GROWTH"; Value = $StripePriceGrowth },
    @{ Name = "STRIPE-PRICE-SCALE"; Value = $StripePriceScale }
  )

  foreach ($secret in $secrets) {
    if ([string]::IsNullOrWhiteSpace($secret.Value)) {
      continue
    }

    Invoke-Az @(
      "keyvault", "secret", "set",
      "--vault-name", $KeyVault,
      "--name", $secret.Name,
      "--value", $secret.Value
    ) | Out-Null
  }
}

if ($BuildImages) {
  Write-Step "Logging into ACR"
  Invoke-Az @("acr", "login", "--name", $AcrName)

  $webImage = "$AcrName.azurecr.io/qa-copilot-web:latest"
  $apiImage = "$AcrName.azurecr.io/qa-copilot-api:latest"

  Write-Step "Building web image"
  Invoke-Docker @("build", "-f", "Dockerfile.web", "-t", $webImage, ".")

  Write-Step "Building API image"
  Invoke-Docker @("build", "-f", "Dockerfile.api", "-t", $apiImage, ".")

  Write-Step "Pushing web image"
  Invoke-Docker @("push", $webImage)

  Write-Step "Pushing API image"
  Invoke-Docker @("push", $apiImage)
}

if ($DeployApps) {
  if ([string]::IsNullOrWhiteSpace($DatabaseUrl)) {
    Ensure-Value $PostgresAdminPassword "PostgresAdminPassword"
    $DatabaseUrl = Build-DatabaseUrl -Server $PostgresServer -Database $DatabaseName -User $PostgresAdminUser -Password $PostgresAdminPassword
  }

  Ensure-Value $DatabaseUrl "DatabaseUrl"
  Ensure-Value $JwtSecret "JwtSecret"

  $webImage = "$AcrName.azurecr.io/qa-copilot-web:latest"
  $apiImage = "$AcrName.azurecr.io/qa-copilot-api:latest"

  Write-Step "Deploying API container app"
  Invoke-Az @(
    "containerapp", "create",
    "--name", $ApiApp,
    "--resource-group", $ResourceGroup,
    "--environment", $ContainerEnv,
    "--image", $apiImage,
    "--target-port", "4000",
    "--ingress", "external",
    "--registry-server", "$AcrName.azurecr.io"
  )

  $apiFqdn = (& az containerapp show --name $ApiApp --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv).Trim()
  if (-not $apiFqdn) {
    throw "Could not resolve API FQDN after deployment."
  }

  Write-Step "Deploying web container app"
  Invoke-Az @(
    "containerapp", "create",
    "--name", $WebApp,
    "--resource-group", $ResourceGroup,
    "--environment", $ContainerEnv,
    "--image", $webImage,
    "--target-port", "3000",
    "--ingress", "external",
    "--registry-server", "$AcrName.azurecr.io"
  )

  $webFqdn = (& az containerapp show --name $WebApp --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv).Trim()
  if (-not $webFqdn) {
    throw "Could not resolve web FQDN after deployment."
  }

  Write-Step "Updating API environment variables"
  Invoke-Az @(
    "containerapp", "update",
    "--name", $ApiApp,
    "--resource-group", $ResourceGroup,
    "--set-env-vars",
    "API_PORT=4000",
    "DATABASE_URL=$DatabaseUrl",
    "JWT_SECRET=$JwtSecret",
    "OPENAI_API_KEY=$OpenAiApiKey",
    "OPENAI_MODEL=$OpenAiModel",
    "HUGGINGFACE_API_KEY=$HuggingFaceApiKey",
    "HUGGINGFACE_MODEL=$HuggingFaceModel",
    "STRIPE_SECRET_KEY=$StripeSecretKey",
    "STRIPE_PRICE_STARTER=$StripePriceStarter",
    "STRIPE_PRICE_GROWTH=$StripePriceGrowth",
    "STRIPE_PRICE_SCALE=$StripePriceScale",
    "NEXT_PUBLIC_APP_URL=https://$webFqdn",
    "CORS_ORIGIN=https://$webFqdn"
  )

  Write-Step "Updating web environment variables"
  Invoke-Az @(
    "containerapp", "update",
    "--name", $WebApp,
    "--resource-group", $ResourceGroup,
    "--set-env-vars",
    "NEXT_PUBLIC_API_URL=https://$apiFqdn/api",
    "NEXT_PUBLIC_APP_URL=https://$webFqdn"
  )

  Write-Step "Deployment complete"
  Write-Host "Web URL: https://$webFqdn" -ForegroundColor Green
  Write-Host "API URL: https://$apiFqdn/api/health" -ForegroundColor Green
  Write-Host ""
  Write-Host "Next manual step: set DATABASE_URL in your shell and run npm run db:push then npm run db:seed" -ForegroundColor Yellow
}

if ($ShowUrls) {
  Write-Step "Current app URLs"
  $apiFqdn = (& az containerapp show --name $ApiApp --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv).Trim()
  $webFqdn = (& az containerapp show --name $WebApp --resource-group $ResourceGroup --query properties.configuration.ingress.fqdn -o tsv).Trim()
  if ($webFqdn) {
    Write-Host "Web URL: https://$webFqdn" -ForegroundColor Green
  }
  if ($apiFqdn) {
    Write-Host "API Health: https://$apiFqdn/api/health" -ForegroundColor Green
  }
}
