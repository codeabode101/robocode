# Robocode - Cloudflare Pages Deployment

## Quick Setup

### 1. Install Wrangler CLI
```bash
npm install -g wrangler
wrangler login
```

### 2. Build Frontend (Static Export)
```bash
cd apps/web
npm install
npm run build  # This generates 'out' folder
```

### 3. Deploy to Cloudflare Pages
```bash
cd ../..
npx wrangler pages deploy apps/web/out --project-name=robocode
```

## Environment Variables

Set these in Cloudflare Pages Dashboard → Settings → Environment Variables:

```
WORKOS_API_KEY=sk_test_...
WORKOS_CLIENT_ID=client_...
COCKROACHDB_CONNECTION_STRING=postgresql://...
APPWRITE_PROJECT_ID=app_...
APPWRITE_API_KEY=...
JWT_SECRET=your_256_bit_secret
BATTLE_ENGINE_SECRET=your_256_bit_secret
```

## Backend Deployment

The Express API server (`apps/server`) must be deployed separately to a Node.js platform:

- **Railway**: `railway up`
- **Render**: Connect GitHub repo, set root to `apps/server`
- **Fly.io**: `fly launch` in `apps/server`

## Full Deployment Steps

1. **Deploy Backend First**:
   ```bash
   cd apps/server
   npm install
   # Deploy to Railway/Render/Fly
   ```

2. **Update Frontend API URLs**:
   - Edit `apps/web/src/lib/api.ts`
   - Replace `/api` with your deployed backend URL

3. **Deploy Frontend**:
   ```bash
   cd apps/web
   npm install
   npm run build
   npx wrangler pages deploy out --project-name=robocode
   ```

## Live URLs

- Frontend: https://robocode.pages.dev
- Backend: (your-railway-url.railway.app)
