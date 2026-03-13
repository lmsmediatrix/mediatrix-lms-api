$ErrorActionPreference = 'Stop'

# Usage:
#   powershell -ExecutionPolicy Bypass -File scripts/gcp/create-deploy-key.ps1
# Prereq:
#   1) gcloud CLI installed and logged in: gcloud auth login
#   2) Correct account selected in gcloud

$PROJECT_ID = 'alma-490104'
$SERVICE_ACCOUNT_NAME = 'github-actions-deploy-develop'
$SERVICE_ACCOUNT_EMAIL = "$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"
$KEY_FILE = 'gcp-sa-key-develop.json'

Write-Host "Using project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID"

Write-Host 'Enabling required APIs...'
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com --project "$PROJECT_ID"

Write-Host 'Creating service account if missing...'
$null = gcloud iam service-accounts describe "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID" 2>$null
if ($LASTEXITCODE -ne 0) {
  gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" --display-name 'GitHub Actions Deploy (develop)' --project "$PROJECT_ID"
}
else {
  Write-Host "Service account already exists: $SERVICE_ACCOUNT_EMAIL"
}

Write-Host 'Granting IAM roles...'
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SERVICE_ACCOUNT_EMAIL" --role roles/run.admin | Out-Null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SERVICE_ACCOUNT_EMAIL" --role roles/cloudbuild.builds.editor | Out-Null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SERVICE_ACCOUNT_EMAIL" --role roles/artifactregistry.writer | Out-Null
gcloud projects add-iam-policy-binding "$PROJECT_ID" --member "serviceAccount:$SERVICE_ACCOUNT_EMAIL" --role roles/iam.serviceAccountUser | Out-Null

Write-Host "Creating service account key file: $KEY_FILE"
gcloud iam service-accounts keys create "$KEY_FILE" --iam-account "$SERVICE_ACCOUNT_EMAIL" --project "$PROJECT_ID"

Write-Host 'Done. Next steps:'
Write-Host "1) Open $KEY_FILE and copy all JSON content."
Write-Host '2) Add GitHub secret in your repo: GCP_SA_KEY_DEVELOP'
Write-Host '3) Commit and push to develop to trigger deploy workflow.'
Write-Host "4) Keep $KEY_FILE private and do not commit it."
