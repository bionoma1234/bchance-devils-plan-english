# BChance Games | Play Lab

The source for the **BChance Games** game library and its first playable collection, an unofficial English Devil's Plan fan adaptation.

## Pages

| URL path | Purpose |
| --- | --- |
| `/` | BChance Games home and game catalog |
| `/devils-plan/` | Devil's Plan game selection and legacy beta lobby |
| `/devils-plan/heavy-13/` | Reconstructed Heavy 13 vs computer |
| `/devils-plan/memory-poker/` | Reconstructed Memory Poker solo/AI game |
| `/devils-plan/square-count/` | Reconstructed Square Count target-sum training |
| `/api/health` | Server health response |
| `/api/rooms` | Shared multiplayer rooms |

Cloudflare Workers serves the static pages from `public/` and handles multiplayer through the existing Worker and SQLite-backed Durable Objects.

The **internal Cloudflare Worker name** remains `bchance-devils-plan-english` so current GitHub credentials and deployment configuration do not need to change. The eventual public domain is `games.bchance.co`.

## Project structure

```
public/
  index.html                  # Games catalog
  devils-plan/index.html      # Devil's Plan English Edition
src/index.js                  # Cloudflare Worker API + GameRoom Durable Object
tests/smoke-test.mjs          # Server-side test
tests/site-structure.mjs      # Checks the hub/game page paths
wrangler.jsonc                # Cloudflare configuration
.github/workflows/deploy.yml  # GitHub Actions auto-deploy
```

## Deploy

The GitHub workflow runs tests then deploys on commits to `main` using two GitHub Actions repository secrets: `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID`.

1. Register a `workers.dev` account subdomain in Cloudflare Workers if you have not yet done so.
2. Confirm the above secrets are configured. Never commit credentials to GitHub.
3. Open the GitHub Actions tab and run **Deploy game to Cloudflare**, or push to `main`.
4. Check the Worker URL and test `/`, `/devils-plan/`, and `/api/health`. For multiplayer, create a Square Count room and join from a second browser/device.
5. After verifying, add the domain in Cloudflare: **Workers & Pages → bchance-devils-plan-english → Settings → Domains & Routes → Add → Custom Domain → games.bchance.co**. A custom domain requires an active `bchance.co` Cloudflare DNS zone. Keep your portfolio DNS records intact.

Node.js 22+ manual local development: `npm install`, `npm test`, `npx wrangler dev`.

## Add another game

Create `public/your-game-slug/index.html` and add a playable card linking to `/your-game-slug/` in `public/index.html`. If the game needs online players, extend `src/index.js` with separately namespaced API endpoints or a dedicated Worker as the library grows.

## Current status and limitations

The Devil's Plan adaptation now includes rule-based solo reconstructions of Heavy 13, Memory Poker and Square Count. Russian Roulette (fictional probability) and Cube Century remain experimental legacy prototypes clearly labeled as such. Its Cloudflare multiplayer beta includes six-character room codes, room chat, and synchronized Square Count rounds with server-checked answers. The Quoridor/Dice Devil Memory Poker rules and public Square Count descriptions inform the reconstructions, but exact UI and multiplayer parity with doke's site has **not** been verified. No registered user accounts, global leaderboard, moderation, or public production-scale protections are included. Rooms expire after 24 hours.

The home page includes clear placeholders for future releases. It does not claim these games already exist.

Independent fan-made game project; not affiliated with Netflix or the original site's creator. Confirm third-party rights before wider distribution.

Official references:
- https://developers.cloudflare.com/workers/static-assets/routing/advanced/serving-a-subdirectory/
- https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/


## Live multiplayer (beta)

All five game selections can now create a private room code with synchronized websocket state, chat, ready checks, host start/next-round controls, automatic round timers and server-side validation. Join links follow `/devils-plan/room/?code=ABCDEF` and rooms use the existing Cloudflare Durable Object.

- **Memory Poker**: synchronized 20-second memorization and 60-second choice with hidden selections, shared community cards and poker-hand ranking.
- **Heavy 13**: synchronized rock/chip commitments, server ordered placement, rainbow choice, passing and penalties.
- **Square Count**: simultaneous answer submission and server-side rectangle-count scoring.
- **Cube Century / Count the Cubes beta**: shared 3D stacked-cube counting puzzles and scoring. This is **not a verified recreation** of the original Cube Century.
- **Russian Roulette beta**: exactly six players, virtual credits, private/public investigation, rotation and seat result. Not a verified pixel- or rule-perfect copy of the original site.

The new multiplayer mode is an independent interpretation of documented gameplay, not a complete recreation of the referenced website. Live cross-browser behavior and visual parity still need manual verification.


## JakBox: five independent party games

- URL: \`/jakbox/\`; room controller: \`/jakbox/room/?code=ABCDEF\`.
- Five distinct game modes: Prompt Clash (Quiplash-inspired), Truth Trap (Fibbage-inspired), Sketch Bluff (Drawful-inspired), Split Vote (Split the Room-inspired), Shirt Showdown (Tee K.O.-inspired).
- Mechanics studied from the official Jackbox Games pages:
  - https://www.jackboxgames.com/games/quiplash
  - https://www.jackboxgames.com/games/fibbage-4
  - https://www.jackboxgames.com/games/the-jackbox-party-pack-1/drawful
  - https://www.jackboxgames.com/games/split-the-room
  - https://www.jackboxgames.com/games/tee-k-o-2
- Differences from the commercial products: new prompts, simplified rounds, custom scoring, no licensed assets/audio/host characters, no audience mode or proprietary Jackbox integrations. Six-character BChance room codes, not Jackbox's original four-letter codes.
- Multiplayer backend: reuses \`GameRoom\` Cloudflare Durable Object for room create/join, per-player private state, ready checks, in-room chat, timed stage transitions, server-authoritative vote scoring, scoring and reconnection. The beta needs multi-device acceptance testing.
- Drawing: touch-enabled 2D stroke input with server-side point validation; graphics are player-generated and are not copied assets. No room at \`jackbox.tv\` can be joined with a JakBox code.
- Names and source references are included solely to document gameplay inspiration. This independent project is not affiliated with Jackbox Games, Inc.
