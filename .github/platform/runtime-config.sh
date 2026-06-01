#!/usr/bin/env bash
set -euo pipefail

env_values="RUNSETTA_TTS_MODEL=gpt-4o-mini-tts,RUNSETTA_TTS_VOICE=marin"
secret_mappings=()

if gcloud secrets versions describe latest --project="${PROJECT_ID}" --secret="openai-api-key" >/dev/null 2>&1; then
  secret_mappings+=("OPENAI_API_KEY=openai-api-key:latest")
else
  env_values="${env_values},RUNSETTA_OFFLINE=1"
fi

for mapping in \
  "SPOTIFY_CLIENT_ID=spotify-client-id" \
  "SPOTIFY_CLIENT_SECRET=spotify-client-secret" \
  "SPOTIFY_REDIRECT_URI=spotify-redirect-uri"; do
  env_name="${mapping%%=*}"
  secret_name="${mapping#*=}"

  if gcloud secrets versions describe latest --project="${PROJECT_ID}" --secret="${secret_name}" >/dev/null 2>&1; then
    secret_mappings+=("${env_name}=${secret_name}:latest")
  fi
done

flags="--set-env-vars=${env_values}"
if [ "${#secret_mappings[@]}" -gt 0 ]; then
  secret_values="$(IFS=,; echo "${secret_mappings[*]}")"
  flags="${flags} --set-secrets=${secret_values}"
fi

echo "flags=${flags}" >> "$GITHUB_OUTPUT"
