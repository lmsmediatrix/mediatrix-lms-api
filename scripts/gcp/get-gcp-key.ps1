<#
.SYNOPSIS
Creates a GCP service account key for deployment.

.USAGE
powershell -ExecutionPolicy Bypass -File scripts/gcp/get-gcp-key.ps1
powershell -ExecutionPolicy Bypass -File scripts/gcp/get-gcp-key.ps1 -ProjectId "my-project" -Force
#>

param(
  [string]$ProjectId = 'alma-490104',
  [string]$ServiceAccountName = 'github-actions-deploy-develop',
  [string]$KeyFile = 'gcp-sa-key-develop.json',
  [string]$GithubSecretName = 'GCP_SA_KEY_DEVELOP',
  [switch]$Force
)

$ErrorActionPreference = 'Stop'

$ServiceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"

function Assert-CommandExists {
  param([Parameter(Mandatory = $true)][string]$Name)
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    throw "Required command '$Name' was not found in PATH. Install Google Cloud CLI first: https://cloud.google.com/sdk/docs/install"
  }
}

function Confirm-GcloudAuthenticated {
  $activeAccount = (gcloud config list account --format='value(core.account)' 2>$null).Trim()
  if ([string]::IsNullOrWhiteSpace($activeAccount)) {
    throw "No active gcloud account found. Run 'gcloud auth login' and try again."
  }
  Write-Host "Using gcloud account: $activeAccount"
}

function Confirm-ServiceAccount {
  $null = gcloud iam service-accounts describe "$ServiceAccountEmail" --project "$ProjectId" 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating service account: $ServiceAccountEmail"
    gcloud iam service-accounts create "$ServiceAccountName" --display-name 'GitHub Actions Deploy (develop)' --project "$ProjectId" | Out-Null
    return
  }

  Write-Host "Service account already exists: $ServiceAccountEmail"
}

function Grant-Role {
  param([Parameter(Mandatory = $true)][string]$Role)
  Write-Host "Granting role: $Role"
  gcloud projects add-iam-policy-binding "$ProjectId" --member "serviceAccount:$ServiceAccountEmail" --role "$Role" | Out-Null
}

Assert-CommandExists -Name 'gcloud'
Confirm-GcloudAuthenticated

if ((Test-Path -LiteralPath $KeyFile) -and -not $Force.IsPresent) {
  throw "Key file already exists: $KeyFile. Remove it or rerun with -Force."
}

if ((Test-Path -LiteralPath $KeyFile) -and $Force.IsPresent) {
  Remove-Item -LiteralPath $KeyFile -Force
}

Write-Host "Using project: $ProjectId"
gcloud config set project "$ProjectId" | Out-Null

Write-Host 'Enabling required APIs...'
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com --project "$ProjectId" | Out-Null

Confirm-ServiceAccount

Write-Host 'Granting IAM roles...'
Grant-Role -Role 'roles/run.admin'
Grant-Role -Role 'roles/cloudbuild.builds.editor'
Grant-Role -Role 'roles/artifactregistry.writer'
Grant-Role -Role 'roles/iam.serviceAccountUser'

Write-Host "Creating service account key file: $KeyFile"
gcloud iam service-accounts keys create "$KeyFile" --iam-account "$ServiceAccountEmail" --project "$ProjectId" | Out-Null

Write-Host ''
Write-Host 'Done. Next steps:'
Write-Host "1) Open $KeyFile and copy all JSON content."
Write-Host "2) Add GitHub secret in your repo: $GithubSecretName"
Write-Host '3) Commit and push to develop to trigger deploy workflow.'
Write-Host "4) Keep $KeyFile private and do not commit it."
