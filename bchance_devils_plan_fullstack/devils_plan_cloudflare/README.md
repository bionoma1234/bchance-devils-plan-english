# The Devil's Plan: English Game Hub | BChance Edition

A fan-made English practice site with a working Cloudflare multiplayer **beta**. This is not a copy of the original creator's source code or official game artwork.

## Included

- Five selectable games with local solo practice: Heavy 13, Russian Roulette (fictional probability game), Memory Poker, Square Count, Cube Century
- Six-character live room creation and joining
- Player nicknames, visible players/host and chat
- Host-led **synchronized Square Count** game: shared board, individual submissions, hidden answers until reveal, server-verified results
- Same-origin website and API on one Cloudflare Worker; one SQLite-backed Durable Object per room
- Host may start, reveal and clear live Square Count rounds
- High scores for solo games stored only in each browser's local storage
- GitHub Actions deploy workflow

**Not included yet:** authentic rule translations from the original game, multiplayer logic for Heavy 13 / Russian Roulette / Memory Poker / Cube Century, registered user accounts, persistent global leaderboards, moderation, anti-abuse controls, invite-by-URL, lobby passwords, or a managed production-scale service. Rooms expire 24 hours after creation. This is suitable for beta testing with friends, not an unmoderated public game service.

## Quick deployment (Cloudflare account required)

1. Install Node.js 22 or newer.
2. Unzip the project. In the folder containing `package.json` and `wrangler.jsonc`, run:

   ```bash
   npm install
   npm test
   npx wrangler login
   npm run dev
   ```

3. Open the local address displayed by Wrangler, generally `http://localhost:8787`, in your browser. Test rooms in two separate browser windows (ideally one incognito, or on another device connected to a URL reachable by both).
4. Deploy:

   ```bash
   npm run deploy
   ```

5. Copy the `*.workers.dev` URL printed by Wrangler. The site and backend work there, without using your personal domain yet.

Cloudflare Workers has a Free plan and SQLite-backed Durable Objects are supported on it within usage limits. A Cloudflare login and deployment permissions are required; no local database server is needed.

## Connect games.bchance.co (recommended)

**Keep your main website `bchance.co` where it is.** Only add the new game subdomain.

If `bchance.co` is already an active **Cloudflare DNS zone**:
1. Cloudflare dashboard → **Workers & Pages** → **bchance-devils-plan-english**.
2. **Settings → Domains & Routes → Add → Custom Domain**.
3. Enter `games.bchance.co`, confirm, and let Cloudflare manage the required DNS record and HTTPS certificate.
4. Verify `https://games.bchance.co` opens and `/api/health` returns JSON.

If your DNS is hosted elsewhere, you cannot attach a Cloudflare Worker custom domain until the DNS zone is on Cloudflare. One path is to add `bchance.co` to Cloudflare and switch authoritative nameservers at the domain registrar, **after carefully copying all existing DNS records (website, email/MX, SPF, DKIM, etc.)**. Do not change the existing root or `www` records unless you intend to migrate the portfolio site. Alternatively keep your game temporarily on its `workers.dev` URL.

## Host source code on GitHub with auto-deploy

1. Create a new repository, e.g. `bchance-devils-plan-english`.
2. Upload **the contents of this ZIP as the repository root**, preserving `.github/workflows/deploy.yml`, `public/`, `src/`, `package.json`, and `wrangler.jsonc`.
3. In your Cloudflare dashboard, find your **Account ID** and create a scoped API token with permissions needed to deploy Workers and Durable Objects. The domain/zone may require additional edit rights when configuring a custom domain.
4. GitHub repository → **Settings → Secrets and variables → Actions** → create two secrets:
   - `CLOUDFLARE_API_TOKEN` = the Cloudflare API token
   - `CLOUDFLARE_ACCOUNT_ID` = the Cloudflare Account ID
5. Push to the `main` branch or trigger **Actions → Deploy game to Cloudflare → Run workflow**. GitHub Actions uses Wrangler to deploy the site and backend together.

**Never commit API tokens, passwords, or secrets into source files.** You do not need to put your Cloudflare account ID inside source files if you pass it to the GitHub Action as configured here.

## Why not GitHub Pages alone?

GitHub Pages can host a static `index.html` with custom DNS, but it cannot run Durable Objects or WebSockets servers. `public/index.html` will still have local solo practice on GitHub Pages, but live room features require an API backend. This project intentionally uses **Cloudflare Workers for both frontend and backend**, with **GitHub as the source code and deployment trigger** to avoid CORS and extra API domains.

## Project structure

```text
public/index.html            English interface + live multiplayer client
src/index.js                 API + Durable Object multiplayer room server
wrangler.jsonc               Cloudflare deployment configuration
package.json                 Scripts and Wrangler dependency
.github/workflows/deploy.yml GitHub automatic deployment
 tests/smoke-test.mjs        Minimal backend room-game smoke test
```

## API endpoints

- `GET /api/health`: service health
- `POST /api/rooms`: creates room `{ "gameId": "square" }`, returns code and host token
- `GET /api/rooms/ABCDEF`: public room metadata
- `GET /api/rooms/ABCDEF/socket?...`: WebSocket (browser client handles this)

The host token grants room-host privileges and should not be shared publicly. The six-character code lets guests join. We currently treat room codes as invitations, not strong secrets.

## Testing and limitations

`npm test` checks simulated room creation, host/guest WebSocket connections, Square Count answers and results, and chat. It does **not** emulate the entire Cloudflare runtime. Before inviting users, test a deployed Worker from two browsers, including reconnection and mobile layouts. Keep an eye on the Cloudflare dashboard for quota and runtime errors.

## Attribution

Independent fan-made English adaptation. Not affiliated with Netflix or the original site creator. If you intend to distribute widely, confirm permissions for any third-party branding or game material. This version uses original practice game interpretations rather than claiming verified reproduction of the original rules.

## Official references

- Cloudflare static assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Durable Objects: https://developers.cloudflare.com/durable-objects/
- Cloudflare Worker custom domains: https://developers.cloudflare.com/workers/configuration/routing/custom-domains/
- GitHub Actions deployment: https://developers.cloudflare.com/workers/ci-cd/external-cicd/github-actions/
- GitHub Pages custom domains (static-only alternative): https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/about-custom-domains-and-github-pages
