---
name: pickfit-integration-check
description: Orchestrate PickFit frontend-backend integration checks with custom Codex subagents. Use after backend or frontend changes to verify API contracts, SPA state, browser flows, saved/feedback persistence, product image rendering, and cross-layer regressions.
---

# PickFit Integration Check

Use this skill after implementing a vertical slice that touches both frontend and backend.

## Available Project Agents

Spawn these custom agents when the environment supports Codex subagents:

- `pickfit_frontend_mapper`: read-only frontend flow and expected contracts.
- `pickfit_backend_mapper`: read-only backend endpoint and persistence map.
- `pickfit_contract_reviewer`: read-only frontend/backend JSON contract comparison.
- `pickfit_browser_verifier`: browser-based local flow verification.
- `pickfit_integration_reviewer`: final synthesis of findings.

## Orchestration

1. Confirm the relevant local server command.
2. Start the server in the parent session if needed.
3. Spawn frontend and backend mapper agents in parallel.
4. Spawn contract reviewer using the mapped artifacts or current code.
5. Spawn browser verifier when a local URL is running.
6. Consolidate with integration reviewer.
7. Return only blocking and high-signal non-blocking findings.

## Agent Prompt Templates

Frontend mapper:

```text
Use pickfit_frontend_mapper. Read the current PickFit frontend and list screens, state fields, mock dependencies, API expectations, and likely integration risks. Do not edit files.
```

Backend mapper:

```text
Use pickfit_backend_mapper. Read the current PickFit backend and list endpoints, response shapes, persistence behavior, environment assumptions, and likely integration risks. Do not edit files.
```

Contract reviewer:

```text
Use pickfit_contract_reviewer. Compare frontend expectations against backend implementation for the changed slice. Return mismatches with file evidence. Do not edit files.
```

Browser verifier:

```text
Use pickfit_browser_verifier. Open the local PickFit app and verify the relevant user flow, console errors, network/API behavior, images, and layout. Do not edit files.
```

Integration reviewer:

```text
Use pickfit_integration_reviewer. Consolidate the mapper, contract, and browser findings. Remove duplicates and style-only noise. Return blocking integration issues first.
```

## Contract Checklist

Check only endpoints that exist or are part of the changed slice:

- `GET /api/health`
- `GET /api/products`
- `POST /api/recommendations`
- `GET /api/recommendations/{id}`
- saved outfit endpoints
- feedback endpoints
- auth/session endpoints
- URL analysis and crawl job endpoints

## Finding Format

```text
Severity:
Finding:
Evidence:
Likely owner:
Repro:
Suggested next action:
```

Do not let subagents modify application code. Fixes happen in the parent session after reviewing findings.
