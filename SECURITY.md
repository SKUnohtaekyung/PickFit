# Security

## Secret Handling

- Never commit `.env`, `.env.*`, `.envrc`, local tool settings, API keys, database passwords, session secrets, or private keys.
- Commit only `.env.example`, with empty placeholders and comments.
- Keep `OPENAI_API_KEY` server-side. Browser code must call PickFit's same-origin PHP API, never OpenAI directly.
- If a key may have been pushed to GitHub, revoke or rotate it first. History cleanup is secondary once the credential is invalid.

## Local Checks

Run this before committing security-sensitive changes:

```bash
npm run security:scan
composer test
```

The security scan checks tracked and untracked commit-candidate files for known token patterns and fails if a real environment file would enter git.

## GitHub Settings

For the public repository, enable:

- Secret scanning alerts
- Push protection
- Dependabot alerts
- Branch protection requiring the `Security / Secret scan` workflow

## Incident Runbook

1. Revoke or rotate the exposed credential with the provider.
2. Replace only the local/server environment value.
3. Check GitHub secret scanning alerts and repository forks/PRs.
4. If the exposed secret is still sensitive after rotation, rewrite history with `git-filter-repo` and contact GitHub Support for cache/PR reference cleanup.
