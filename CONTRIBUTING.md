# Contributing to Animascroll

Thanks for your interest in contributing!

## Prerequisites

- Node.js 20+
- npm
- A [Clerk](https://clerk.com) account (free)
- A [Neon](https://neon.tech) database (free tier)
- A [Vercel](https://vercel.com) project with Blob storage
- A [Groq](https://console.groq.com) API key (free tier)

## Local Setup

```bash
# 1. Fork and clone
git clone https://github.com/your-username/animascroll.git
cd animascroll

# 2. Install dependencies
npm install

# 3. Configure environment
cp .env.example .env.local
# Fill in your keys in .env.local

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

## Making Changes

1. **Branch naming** — use a prefix: `feat/`, `fix/`, or `chore/`
   ```
   git checkout -b feat/my-feature
   ```

2. **Code style**
   - TypeScript strict mode — no `any` without a good reason
   - Tailwind for all styling — avoid inline styles
   - Keep components in `src/components/`, API routes in `src/app/api/`
   - Don't add new npm packages without discussing in the issue first

3. **Before submitting**
   ```bash
   npm run build -- --webpack   # must pass with no errors
   ```

## Submitting a Pull Request

- Keep PRs small and focused on one thing
- Describe **what** changed and **why** in the PR description
- Reference any related issue with `Closes #123`
- PRs that break the build will not be merged

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Browser / OS if it's a UI issue

## Security Issues

Please do **not** open a public issue for security vulnerabilities. See [SECURITY.md](SECURITY.md).
