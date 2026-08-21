# Runsetta

Runsetta is a running companion prototype rebuilt as a small open-source system:

- Pure Bun API for coaching messages, track transitions, OpenAI speech, and Spotify token exchange.
- OpenAI Agents SDK for TypeScript for generated coaching text.
- Native SwiftUI source for iOS 26 and watchOS 26 clients.
- GitHub Actions, Terraform, Workload Identity Federation, Artifact Registry, Secret Manager, and Cloud Run for GitOps deployment.

## API

```sh
bun install
bun run verify
bun run dev
```

The API targets stable Bun 1.4. Use `bun upgrade --stable` for local development; the Docker image pins `bun-v1.4.0` exactly.

Endpoints:

- `GET /livez`
- `POST /api/coach`
- `POST /api/spotify-transition`
- `POST /api/audio`
- `POST /api/spotify/token`
- `POST /api/spotify/refresh`

Runtime environment:

- `OPENAI_API_KEY`
- `RUNSETTA_API_TOKEN` required before any configured OpenAI or Spotify
  integration can be called; use at least 32 random characters and send it as
  a bearer token only from trusted clients
- `RUNSETTA_MESSAGE_MODEL` optional
- `RUNSETTA_TTS_MODEL` optional, defaults to `gpt-4o-mini-tts`
- `RUNSETTA_TTS_VOICE` optional, defaults to `marin`
- `SPOTIFY_CLIENT_ID`
- `SPOTIFY_CLIENT_SECRET`
- `SPOTIFY_REDIRECT_URI`

The API never expects Spotify secrets in the Apple app. Token exchange happens
server-side. The browser demo remains public only while local offline mode is
active; enabling a paid integration without `RUNSETTA_API_TOKEN` fails closed.

## Apple

```sh
cd apple
swift build
swift run RunsettaCoreCheck
```

The checked Swift package contains the shared API contract and view model. `apple/Apps/iOS` and `apple/Apps/watchOS` contain the SwiftUI app entry points for Xcode.

## Infrastructure

Terraform roots live under `infra/terraform`:

- `bootstrap` enables required Google APIs, creates state storage, service accounts, and GitHub OIDC trust.
- `prod` creates Artifact Registry, Secret Manager secret shells, and the production Cloud Run service.

For a new project, run the first bootstrap apply with `-backend=false` so Terraform can create the state bucket before the GCS backend is used. After that, reinitialize normally and apply `prod`.

Secret values are intentionally not stored in GitHub. Add Secret Manager versions for:

- `openai-api-key`
- `spotify-client-id`
- `spotify-client-secret`
- `spotify-redirect-uri`
