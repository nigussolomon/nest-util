# TBD: Assisted Onboarding — Edge Cases

## 1. Race condition: two agents completing onboarding for the same identifier

### Scenario
Two agents start onboarding for the same email, then both call `POST /auth/onboarding/user` with valid (unconsumed) onboarding tokens at near-identical times.

### Current behavior
- Request A: `OnboardingJwtGuard` loads the attempt (not consumed) → passes → `findOne` → no user → INSERT succeeds → attempt marked consumed
- Request B: `OnboardingJwtGuard` loads the attempt (not consumed yet — A hasn't committed) → passes → `findOne` → no user (A hasn't committed yet) → INSERT → `QueryFailedError` (23505 unique violation on the identifier)
- B gets a raw 500 (via `TypeOrmExceptionFilter` → 422) instead of a clean `ConflictException` (409)

### Desired behavior
Catch the unique constraint violation in `createUserFromOnboarding()` and re-throw as `ConflictException`:

```typescript
try {
  savedUser = await this.userRepository.save(newUser);
} catch (error) {
  if ((error as any)?.code === '23505') {
    throw new ConflictException('User already exists');
  }
  throw error;
}
```

The first request wins (creates user + consumes attempt). The second gets a clean 409.

---

## 2. Stale pending attempt squatting on an identifier

### Scenario
1. Agent A starts onboarding for an email and receives the invitee's OTP, but never completes (or the invitee ignores it)
2. The pending `OnboardingAttemptEntity` row remains (OTP TTL = 5 min), and the partial unique index on `(identifierField, identifier) WHERE "consumedAt" IS NULL` blocks a new `start` for the same identifier
3. The agent cannot re-start until the row is cleaned up (no expiry sweep exists)

### Desired behavior
During `startOnboarding()`, if a pending attempt exists but its OTP has **expired**, delete the stale attempt and allow a fresh start:

```typescript
const pending = await this.onboardingAttemptRepository.findOne({ where: { [identifierField]: identifier } });
if (pending) {
  const expiresAt = this.toDate(pending.expiresAt);
  if (expiresAt && expiresAt <= new Date()) {
    await this.onboardingAttemptRepository.delete((pending as any).id);
  } else {
    throw new ConflictException('Onboarding already in progress');
  }
}
```

The squatting window is capped by `onboarding.ttlSeconds` (default 300s / 5 min). A scheduled sweep (`consumedAt IS NOT NULL` and `expiresAt < now`) is a further hardening step for high-volume systems.

---

## 3. Onboarding token reuse timing window

### Scenario
An agent receives an `onboarding_token`, then the invitee also obtains the token (e.g. a leaked agent clipboard) and calls `POST /auth/onboarding/user` first.

### Current behavior
The token is single-use via `consumedAt` on the attempt, but consumption and the user INSERT are not atomic: two requests presenting the same valid token can both pass the guard before either commits, producing a duplicate user (see issue 1).

### Desired behavior
Make consume-and-create atomic:
- Wrap the "mark consumed + create user" step in a transaction (or update the attempt with `consumedAt = now() WHERE "consumedAt" IS NULL` and check affected rows before proceeding)
- On a lost race, return `ConflictException` without creating a user

### Note
Issues 1 and 3 share the same failure mode (the guard's read-then-write is non-atomic) and should be fixed together.
