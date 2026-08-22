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

The API targets Bun 1.4. The package manager, release binary, and Docker Hardened
Images are pinned by reviewed version and digest.

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

## Infrastructure and delivery

The Terraform roots under `infra/terraform` are reviewed, validation-only
mirrors of the platform modules. They are never deployment entrypoints. A
protected GitHub pipeline selects Runsetta by immutable numeric repository ID
and runs the exact roots under `collinbentley1/platform/terraform/deployments`.
Do not run a consumer-root apply, use `-backend=false`, or add Secret Manager
versions manually.

Preview revisions share one pre-created Cloud Run preview service. Each pull
request receives a tagged, no-traffic revision; the platform's service-scoped
operator reconciles and removes only the matching stale tag. Production and
preview publishing, deployment, and preview operations use separate OIDC
identities with resource-scoped roles.

Runsetta is deliberately offline in both preview and production. The reviewed
runtime configuration sets `RUNSETTA_OFFLINE=1`, clears Cloud Run secret
bindings, and grants the runtime service account access to zero secret payloads.
The Terraform mirror may retain named secret containers as inert metadata, but
`runtime_secret_accessor_ids` stays empty. Enabling OpenAI or Spotify requires a
new platform review that pins exact numeric secret versions; it is not an
operator-time configuration change.

Delivery credentials belong only in their protected environments; repository-wide
copies are forbidden:

- `preview-build` and `production-build`: Docker Hardened Images credentials,
  the Socket token, and the reviewed Grype database manifest.
- the platform repository alone owns the trusted-main `dependency-scan` token.
- publish, deploy, and preview-operation environments: approval/OIDC boundaries
  only, with no reusable inherited secret bundle.
