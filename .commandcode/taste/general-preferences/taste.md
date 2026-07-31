# General Preferences
- Prefers opt-in features with backward-compatible defaults — new behavior is off by default and must be explicitly enabled; existing code paths must be preserved until a developer consciously opts in. Confidence: 0.90
- Prefers fail-closed security mechanisms — when a security check cannot be performed (e.g., no authenticated user), deny access (403) rather than silently allowing it. Confidence: 0.85
- Prefers returning 404 (Not Found) rather than 403 (Forbidden) when a resource exists but the requesting user does not own it, to prevent existence leaks (attacker cannot distinguish "doesn't exist" from "not yours"). Confidence: 0.80
- Prefers detailed, structured implementation plans written before coding — plans include specific file paths, type signatures, function signatures, line-number references, and explicit behavior tables. Confidence: 0.85
- Prefers documentation (SKILL.md, MIGRATION-GUIDE.md) to be updated as part of the implementation itself, not as a separate follow-up task. Confidence: 0.75
- Prefers comprehensive test matrices covering all scenarios — owned, not-owned, bypass-via-permissions, bypass-via-predicate, unauthenticated, enforcement-off, and variant configurations — for every affected endpoint. Confidence: 0.75
- Prefers extracting shared logic into private helpers rather than duplicating code across methods (e.g., `applyOwnershipCondition`, `applyIncludeJoins`). Confidence: 0.70
- Uses `pnpm` as the package manager and runs tests via `pnpm nx test <project-name>` (not `npx jest` or `npx nx test`). Confidence: 0.80
- Prefers granular, distinct permission action names over coarse/overloaded ones — e.g., `findAll` → `read` and `findOne` → `readOne` as separate defaults rather than both mapping to `read`. Confidence: 0.70
