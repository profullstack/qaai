# QAAI Setup Guide

## Quick Start

Follow these steps to get QAAI up and running locally.

### Prerequisites

Ensure you have the following installed:
- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm** - Install with `npm install -g pnpm`
- **Git** - [Download](https://git-scm.com/)

### Step 1: Clone and Install

```bash
# Navigate to the project directory
cd qaai

# Install dependencies
pnpm install
```

### Step 2: Set Up Supabase

1. **Create a Supabase Project**
   - Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
   - Click "New Project"
   - Fill in project details and wait for setup to complete

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy the following:
     - Project URL
     - `anon` public key
     - `service_role` key (keep this secret!)

3. **Run Database Migrations**
   - Go to SQL Editor in Supabase Dashboard
   - Copy and run `infra/supabase/schema.sql`
   - Then copy and run `infra/supabase/policies.sql`

4. **Create Storage Bucket**
   - Go to Storage in Supabase Dashboard
   - Create a new bucket named `artifacts`
   - Set it to **Private**
   - The policies from `policies.sql` will handle access

### Step 3: Configure Environment Variables

```bash
# Copy the example env file
cp .env.example .env

# Edit .env and fill in your values
nano .env  # or use your preferred editor
```

Required variables:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Choose your LLM provider
LLM_PROVIDER=openai  # or anthropic, or ollama
OPENAI_API_KEY=your-key-here  # if using OpenAI
```

### Step 4: Start Development Servers

```bash
# Terminal 1: Start the web app
pnpm dev:web

# Terminal 2: Start the runner service (once implemented)
pnpm dev:runner
```

The web app will be available at [http://localhost:3000](http://localhost:3000)

### Step 5: Create Your First User

1. Navigate to [http://localhost:3000](http://localhost:3000)
2. You'll be redirected to the login page
3. Sign up with email and password
4. Check your email for verification (if enabled)

### Step 6: Create an Organization

After logging in:
1. You'll need to create an organization
2. This will be done through the UI (to be implemented)
3. For now, you can create one manually in Supabase:

```sql
-- In Supabase SQL Editor
-- Replace 'your-user-id' with your actual user ID from auth.users
INSERT INTO organizations (name) VALUES ('My Organization');

INSERT INTO org_members (org_id, user_id, role)
VALUES (
  (SELECT id FROM organizations WHERE name = 'My Organization'),
  'your-user-id',
  'owner'
);
```

## Development Workflow

### Running Tests

```bash
# Run all tests
pnpm test

# Run tests for specific package
pnpm --filter web test
pnpm --filter runner test
```

### Linting and Formatting

```bash
# Lint all packages
pnpm lint

# Format all files
pnpm format
```

### Building for Production

```bash
# Build web app
pnpm build:web

# Build runner service
pnpm build:runner
```

## Project Structure

```
qaai/
├── apps/
│   └── web/              # Next.js web application
├── services/
│   └── runner/           # Background worker service
├── packages/
│   └── playwright-tests/ # Generated test files
├── infra/
│   ├── supabase/        # Database schema and policies
│   ├── railway/         # Deployment configs
│   └── github/          # CI/CD workflows
└── docs/                # Documentation
```

## Troubleshooting

### "Module not found" errors
```bash
# Clear node_modules and reinstall
rm -rf node_modules
pnpm install
```

### Supabase connection issues
- Verify your environment variables are correct
- Check that your Supabase project is not paused
- Ensure RLS policies are applied

### Port already in use
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9

# Or use a different port
PORT=3001 pnpm dev:web
```

## Next Steps

1. ✅ Project structure created
2. ✅ Database schema and RLS policies set up
3. 🚧 Next.js app initialization (in progress)
4. ⏳ Supabase auth integration
5. ⏳ Base UI components
6. ⏳ Runner service setup

## Getting Help

- **Documentation**: See [ARCHITECTURE.md](./ARCHITECTURE.md) for system design
- **Implementation Guide**: See [IMPLEMENTATION_GUIDE.md](./IMPLEMENTATION_GUIDE.md)
- **Issues**: Check the GitHub Issues tab
- **Discussions**: Use GitHub Discussions for questions

## Contributing

We welcome contributions! Please read our contributing guidelines before submitting PRs.

---

**Status**: Phase 1 in progress - Foundation setup
**Last Updated**: 2025-11-02