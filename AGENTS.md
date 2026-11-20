# Project Agent Rules — Anni

## Post-Task Git & Vercel Deployment Rule
- After completing and verifying any task/change in this repository, always run a pre-commit safety audit, commit the changes using Conventional Commits, and push to `origin main` (`https://github.com/alphadphone-cell/anniversary.git`) so Vercel automatically triggers a fresh production deployment for review.
- Never commit secrets (`.env*`), `node_modules/`, or build artifacts (`dist/`).
- If `git push` fails due to auth/permission errors, report the exact error clearly without bypassing credentials.
