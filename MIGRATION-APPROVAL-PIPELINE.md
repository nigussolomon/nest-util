# Migration Plan: Approval Pipeline — `pending` → `draft → submitted`

> **Scope:** Consumers who already enabled `approvalPipeline` on a previous
> release where every created record started at `pending`. That release's
> lifecycle was:
>
> ```
> pending ──────────> approved
>    │  └───────────> rejected
>    └─> modification_requested ──> resubmitted ──> approved / rejected
> ```
>
> The new lifecycle is:
>
> ```
> draft ──> submitted ────────> approved
>    │        │  └────────────> rejected
>    │        └─> modification_requested ──> resubmitted ──> approved / rejected
> ```

---

## What changed (summary)

1. **New initial status `draft` (default).** New records are *not* immediately
   reviewable; they sit in `draft` until `submit` is called.
2. **New `submit` action / permission / endpoint.** `POST /:id/approval/submit`
   moves `draft → submitted` and records `requestedBy`.
3. **Reviewable state renamed `pending` → `submitted`.** `approve` / `reject` /
   `requestModification` now accept `submitted` / `resubmitted` (previously
   `pending` / `resubmitted`).
4. **`currentValue` auto-capture.** When a modification request omits
   `currentValue`, the server now captures it from the live record
   (including relation objects; circular refs sanitized). Previously it was
   caller-supplied only.
5. **`approval_statuses.status` column default is now `'draft'`** (was `'pending'`).

---

## Risk / impact

| Area | Level | Notes |
|---|---|---|
| **Data** | **HIGH** | Existing `approval_statuses` rows with `status='pending'` become orphaned — the new code does not treat `pending` as reviewable, and `submit` only accepts `draft`. **You must migrate data.** |
| **API** | MEDIUM | New `submit` endpoint. Adopting the draft flow means clients must call it before approval. Keeping old behavior requires `initialStatus: 'submitted'`. |
| **Config** | LOW | Optional new `submit` permission and `submitApproval` endpoint action. |

---

## Step 1 — Decide target behavior

- **Preserve old behavior (fastest upgrade):** set `initialStatus: 'submitted'`.
  Records are created reviewable exactly as before; the new `submit` endpoint is
  simply a no-op for them. Minimal code/client change.
- **Adopt the new draft flow:** keep the default. Clients call `submit` after
  `create` to move a record into the reviewable state.

---

## Step 2 — Code changes

```ts
super({
  repository,
  approvalPipeline: {
    enabled: true,
    initialStatus: 'submitted',        // omit for the new draft flow
    permissions: {
      submit: 'posts.submit',           // NEW — only used by the draft flow
      approve: 'posts.approve',
      reject: 'posts.reject',
      requestModification: 'posts.update',
      resubmit: 'posts.update',
    },
    visibleStatuses: ['approved'],
  },
});
```

Permission guard:

```ts
buildCrudPermissionsFromRegistry(permissionRegistry, {
  resource: 'posts',
  endpointActions: {
    getApproval: 'read',
    submitApproval: 'submit',           // NEW
    approveApproval: 'approve',
    rejectApproval: 'reject',
    requestModification: 'update',
    resubmitApproval: 'update',
  },
});
```

---

## Step 3 — Database data migration (REQUIRED)

For every consumer database, remap existing `pending` rows to the new
reviewable token.

**Option A — keep them immediately reviewable (matches old behavior):**

```sql
UPDATE approval_statuses SET status = 'submitted' WHERE status = 'pending';
```

**Option B — force them through the new draft flow (creators must submit):**

```sql
UPDATE approval_statuses SET status = 'draft' WHERE status = 'pending';
```

> `modification_requested` / `resubmitted` / `approved` / `rejected` rows are
> unchanged — they remain valid in the new flow.

---

## Step 4 — Database schema migration (recommended)

```sql
ALTER TABLE approval_statuses ALTER COLUMN status SET DEFAULT 'draft';
```

The service sets the status explicitly, so this only affects rows inserted
outside the service; aligning the default avoids surprises. If you manage schema
through TypeORM migrations (not `synchronize`), add a migration that runs the
Step 3 `UPDATE` and the Step 4 `ALTER`.

---

## Step 5 — Clients / API contract

- New endpoint: `POST /:resource/:id/approval/submit` (no body). Call it after
  `create` when using the draft flow.
- `submitApproval` is now a `CrudEndpoint`; ensure it is not in
  `disabledEndpoints` if you intend to use it.
- Swagger: the `approval/*` group now exposes **6** endpoints —
  `get`, `submit`, `approve`, `reject`, `request-modification`, `resubmit`.

---

## Step 6 — Verify (checkpoint)

- Existing `pending` rows are now `submitted`; `approve` / `reject` work on them.
- `POST /:id/approval/submit` turns `draft` → `submitted` (or is a no-op when
  already `submitted`).
- `request-modification` with no `currentValue` returns the live value,
  including relation objects.

---

## Rollback

- **Code:** revert `initialStatus` / `submit` permission. The old code again
  treats `pending` as reviewable.
- **Data:** if you changed `pending → submitted`, you can revert with
  `UPDATE approval_statuses SET status = 'pending' WHERE status = 'submitted';`
  (only safe if no new `draft` / `submitted` rows you care about). The
  `submitted` string is purely the new reviewable token and is functionally
  identical to the old `pending`.
