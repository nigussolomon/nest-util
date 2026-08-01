# TBD: Registration Verification — Edge Cases

## 1. Race condition: two users registering the same identifier simultaneously

### Scenario
User A and User B both try `POST /auth/register` with the same email at near-identical times.

### Current behavior
- Request A: `findOne` → no user → INSERT succeeds (committed)
- Request B: `findOne` → no user (A hasn't committed yet) → INSERT → `QueryFailedError` (23505 unique violation)
- B gets a raw 500 (via `TypeOrmExceptionFilter` → 422) instead of the expected `ConflictException` (409)

### Desired behavior
Catch the unique constraint violation in `register()` and re-throw as `ConflictException`:

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

The first request wins (creates user + sends OTP). The second gets a clean 409.

---

## 2. Stale unverified account squatting on an identifier

### Scenario
1. Attacker registers with your email → unverified account created, OTP sent (TTL = 10 min)
2. 5 minutes later: code is still active, you try to register → `ConflictException` (attacker's account exists)
3. 10 minutes later: code has expired, you try to register → `ConflictException` (attacker's unverified account still exists)
4. You are permanently blocked until the attacker verifies or an admin manually deletes the account

### Desired behavior
During `register()`, if an existing user is **unverified** and their verification code has **expired**, delete the stale account and allow the new registration to proceed:

```typescript
if (existingUser) {
  if (verificationEnabled && !existingUser[verifiedField]) {
    const verif = this.resolveVerificationOptions(this.options.verification!);
    const expiresAt = this.toDate(existingUser[verif.expiresAtField]);
    if (!expiresAt || expiresAt <= new Date()) {
      await this.userRepository.delete((existingUser as any).id);
      // continue with registration
    } else {
      throw new ConflictException('User already exists');
    }
  } else {
    throw new ConflictException('User already exists');
  }
}
```

The squatting window is capped by `verification.ttlSeconds` (default 600s / 10 min).

### Note
Both fixes should be implemented together since they share the `register()` conflict path.
