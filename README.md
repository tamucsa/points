# TAMU CSA Points

Points tracking system for the Texas A&M Chinese Student Association (CSA). Members sign in with TAMU Google, view points/leaderboards, and check in to events. Officers/admins manage events and onboarding.

## Quickstart (developers)

### Prereqs
- Node.js (recommended: latest LTS)
- npm (or your preferred package manager)
- A Supabase project (hosted) or a local Supabase stack

### Setup
1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` with the required variables (names only; see docs):

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SITE_URL=...
```

3. Run the dev server:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Documentation (comprehensive)
- **Local setup**: `docs/LOCAL_SETUP.md`
- **Environment variables**: `docs/ENVIRONMENT.md`
- **Architecture (developer onboarding / transfer)**: `docs/ARCHITECTURE.md`
- **Operations (all workflows)**: `docs/OPERATIONS.md`
- **Known issues**: `docs/KNOWN_ISSUES.md`
- **Deployment**: `docs/DEPLOYMENT.md`
- **User onboarding**:
  - Members: `docs/ONBOARDING_MEMBERS.md`
  - Officers: `docs/ONBOARDING_OFFICERS.md`
  - Admins: `docs/ONBOARDING_ADMINS.md`

## Commands
- **Dev**: `npm run dev`
- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Format**: `npm run format`
