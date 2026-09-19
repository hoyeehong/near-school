#!/usr/bin/env bash
set -euo pipefail
: "${PROJECT:?Set PROJECT}" "${REGION:?Set REGION}" "${APP_IMAGE:?Set APP_IMAGE}"
REVISION="r-${GITHUB_SHA:0:12}"
PREVIOUS=$(gcloud run services describe near-school --region="$REGION" --project="$PROJECT" --format=json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>{const traffic=JSON.parse(s).status.traffic;const active=traffic.find(x=>x.percent===100);if(!active)throw new Error("Expected one revision receiving all production traffic");console.log(active.revisionName)})')
gcloud run deploy near-school --image="$APP_IMAGE" --region="$REGION" --project="$PROJECT" --no-traffic --tag=candidate --revision-suffix="$REVISION" --quiet
CANDIDATE=$(gcloud run services describe near-school --region="$REGION" --project="$PROJECT" --format=json | node -e 'let s="";process.stdin.on("data",c=>s+=c).on("end",()=>console.log(JSON.parse(s).status.traffic.find(x=>x.tag==="candidate").url))')
SMOKE_URL="$CANDIDATE" npm run smoke
rollback() {
  if [ -n "$PREVIOUS" ]; then
    gcloud run services update-traffic near-school --to-revisions="$PREVIOUS=100" --region="$REGION" --project="$PROJECT"
  fi
}
trap rollback ERR
gcloud run services update-traffic near-school --to-revisions="near-school-$REVISION=100" --region="$REGION" --project="$PROJECT"
PUBLIC_URL=$(gcloud run services describe near-school --region="$REGION" --project="$PROJECT" --format='value(status.url)')
SMOKE_URL="$PUBLIC_URL" npm run smoke
trap - ERR
gcloud run services update-traffic near-school --remove-tags=candidate --region="$REGION" --project="$PROJECT"
