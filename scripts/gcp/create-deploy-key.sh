#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   bash scripts/gcp/create-deploy-key.sh
# Prereq:
#   1) gcloud CLI installed and logged in: gcloud auth login
#   2) Correct account selected in gcloud

PROJECT_ID="alma-490104"
SERVICE_ACCOUNT_NAME="github-actions-deploy-develop"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
KEY_FILE="gcp-sa-key-develop.json"

echo "Using project: ${PROJECT_ID}"
gcloud config set project "${PROJECT_ID}"

echo "Enabling required APIs..."
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com iam.googleapis.com --project "${PROJECT_ID}"

echo "Creating service account if missing..."
if ! gcloud iam service-accounts describe "${SERVICE_ACCOUNT_EMAIL}" --project "${PROJECT_ID}" >/dev/null 2>&1; then
  gcloud iam service-accounts create "${SERVICE_ACCOUNT_NAME}" \
    --display-name="GitHub Actions Deploy (develop)" \
    --project "${PROJECT_ID}"
else
  echo "Service account already exists: ${SERVICE_ACCOUNT_EMAIL}"
fi

echo "Granting IAM roles..."
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/run.admin" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/cloudbuild.builds.editor" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/artifactregistry.writer" >/dev/null

gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:${SERVICE_ACCOUNT_EMAIL}" \
  --role="roles/iam.serviceAccountUser" >/dev/null

echo "Creating service account key file: ${KEY_FILE}"
gcloud iam service-accounts keys create "${KEY_FILE}" \
  --iam-account="${SERVICE_ACCOUNT_EMAIL}" \
  --project "${PROJECT_ID}"

echo "Done. Next steps:"
echo "1) Open ${KEY_FILE} and copy all JSON content."
echo "2) Add GitHub secret in your repo: GCP_SA_KEY_DEVELOP"
echo "3) Commit and push to develop to trigger deploy workflow."
echo "4) Keep ${KEY_FILE} private and do not commit it."
