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

2. Set up `.env.local` — see `docs/ENVIRONMENT.md`.

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
- **Known issues / planned features**: [GitHub Issues](https://github.com/tamucsa/points/issues) (labels `known-issue`, `planned-feature`)
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
