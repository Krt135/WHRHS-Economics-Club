# Firebase rules — Engagement Points System

> **Deploying this?** `FIREBASE_SETUP_FOR_OWNER.md` is the concise
> checklist version of this same document — start there. This file has the
> full reasoning behind each decision, for anyone who wants it or hits a
> case the checklist doesn't cover.

**For whoever has Firebase Console access for this project** (not necessarily
the person who wrote the app code). The Economic Forum site just had an
Engagement Points System added — members earn points for club activities
(Floor posts, meetings, debates, essays, etc.), see a leaderboard, and can
request credit for something they did; execs review requests and can award
points directly. All the application code for this is finished and already
in the repo. The one remaining step, and the reason this document exists, is
that **it needs rule changes deployed in the Firebase project itself** before
it's safe to use — this repo has no `database.rules.json`, rules live only
in the Console, and there's no way to deploy them from outside it.

## Do this, in order

1. Open **Firebase Console → your project → Realtime Database → Rules**.
2. **Copy your current rules somewhere safe first** (a text file, or use the
   Console's own history/rollback if it has one). Section 2 below replaces
   the `.write` behavior of an existing node, not just adds new keys — you
   want an easy way back if something doesn't match what this doc assumed.
3. Read "⚠️ Why this isn't just two new rules" below — it explains a
   Realtime Database subtlety that determines the whole shape of the fix.
4. Apply the ruleset under "What to add" — it replaces the `.write` rule
   at `users.$uid` and adds the nested `pointAwards`/`pointRequests` blocks.
5. **Realtime Database → Rules → Playground**: run the simulations near the
   bottom of this doc *before* publishing. #1 and #7 are the two that matter most.
6. Publish.
7. If you also use Firebase Storage for file uploads on this site, add the
   rules under "Storage rules" too (same Console, Storage → Rules tab).
8. Run the "After you publish" smoke test at the end of this doc.
9. Reply to whoever asked you to do this so they know it's live.

The points data itself lives nested under the existing user node:
`users/{uid}/pointAwards/{awardId}` and `users/{uid}/pointRequests/{requestId}`
— no new top-level collections.

---

## ⚠️ Why this isn't just two new rules

**I have never had Firebase Console access for this project** (nor has the
person who asked me to write this) — everything below about your *existing*
rules is reconstructed from what the app's shipped code requires, not from
reading them directly. I grepped every place the code writes to a user's own
`users/{uid}` node to make sure this reconstruction is complete; the two
call sites are quoted below so you can sanity-check them against what you
actually have.

**The problem.** In Realtime Database, `.read`/`.write` cascade downward and
**cannot be revoked by a rule further down the tree.** Your app's shipped
behavior tells us your existing `users/$uid` rule must grant:

- A member can write their **own** node — `profile.js`'s save button does
  exactly this (see the exact fields below).
- An **admin** can write to *any* member's node — `admin.js` uses this for
  approve/promote/demote/remove/rename.

So the existing rule is almost certainly shaped like
`auth.uid === $uid || <caller is admin>` — self, unconditionally, or an admin.

That single fact breaks two different things about the points feature,
in two different ways:

1. **A `.validate` rule can't fix a write, because `.validate` never runs on
   deletes.** My first draft of these rules used `.validate` to require
   `role === 'admin'` for anything written into `pointAwards`. That correctly
   blocks a member from *overwriting* an award with garbage data — but a
   **delete** has no "new data" for `.validate` to inspect, so Realtime
   Database skips `.validate` entirely for deletes. The cascading `auth.uid
   === $uid` grant from `users/$uid` still applies underneath, so a member
   could `remove()` — or wipe with `set(null)` — their own `pointAwards`
   records, silently destroying the audit trail this system exists to keep.
2. **You can't just add a stricter `.write` at `pointAwards` either**, for
   the same cascading reason: an ancestor granting access can never be
   overridden by a stricter rule underneath it. Firebase ORs write
   permission from the root down to the target path — if *any* level says
   yes, the write proceeds to that exact leaf.

**The fix doesn't require restructuring your data** (points stay nested
under `users/{uid}` exactly as before) — it requires restructuring *where*
the self-write grant lives. The trick: an ancestor rule's condition can
check `data.exists()` **at that ancestor's own location**. So instead of
granting a member permanent write access to their whole node, grant it only
**at the moment their account doesn't exist yet** (i.e. exactly once, at
signup) — then re-grant the *specific fields* they need to keep editing
individually, underneath that. `pointAwards`/`pointRequests` are never in
that field list, so once an account exists, nothing grants a member write
access there at all — not overwrite, not delete.

The two real self-write call sites, confirmed by grepping the whole
`scriptFolder/`, so nothing here is guessed:

```js
// auth.js — once, at signup, before the record exists:
await set(ref(db, 'users/' + user.uid), { email, role, status, uid });

// profile.js — ongoing, editing an existing account:
await update(ref(db, `users/${user.uid}`), {
  displayName, secondaryEmail, bio, phone, emailNotifications, phoneNotifications
});
```

No other file in the app writes to a user's own node. (Admin actions write
to *other* users' nodes — `role`, `status`, `displayName`, or a full
`remove()` — and stay covered by the unconditional admin clause.)

**Trade-off to know about before you publish:** this is a stricter rule than
whatever you have today, reconstructed rather than read. If some self-edit
feature breaks after deploying this, the fix is to add that specific field
to the allowlist below — **not** to revert to a whole-node self-write grant,
since that's the exact hole this document exists to close. One deliberate
behavior change: a member can no longer delete or overwrite their *entire*
own account record in one shot the way an unconditional `auth.uid === $uid`
rule would have allowed — this is a tightening, not a loosening, but it is
a change. There's also no "cancel my pending request" feature in the UI
today, so restricting members to create-only on `pointRequests` (no
self-delete, even for their own still-pending request) costs nothing — but
if you add a cancel button later, that specific write path will need its
own explicit grant.

---

## What to add

Replace the `.write` rule at `users.$uid`, and add the field-level and
nested rules, so the block looks like this (merge with whatever else is
already there for other fields — this only shows what changes):

```json
"users": {
  "$uid": {
    ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin' || (auth.uid === $uid && !data.exists())",

    "displayName":        { ".write": "auth.uid === $uid || root.child('users').child(auth.uid).child('role').val() === 'admin'" },
    "bio":                { ".write": "auth.uid === $uid" },
    "phone":              { ".write": "auth.uid === $uid" },
    "secondaryEmail":     { ".write": "auth.uid === $uid" },
    "emailNotifications": { ".write": "auth.uid === $uid" },
    "phoneNotifications": { ".write": "auth.uid === $uid" },

    "pointAwards": {
      "$awardId": {
        ".write": "root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['memberId','activity','points','activityDate','awardedAt','awardedByUid']) && newData.child('memberId').val() === $uid && newData.child('points').isNumber() && newData.child('points').val() >= 0 && newData.child('points').val() <= 200 && newData.child('activity').isString() && newData.child('activityDate').isString() && (!data.exists() || (newData.child('memberId').val() === data.child('memberId').val() && newData.child('activity').val() === data.child('activity').val() && newData.child('points').val() === data.child('points').val() && newData.child('activityDate').val() === data.child('activityDate').val() && newData.child('awardedAt').val() === data.child('awardedAt').val() && newData.child('awardedByUid').val() === data.child('awardedByUid').val()))",
        "points":       { ".validate": "newData.isNumber()" },
        "memberId":     { ".validate": "newData.val() === $uid" },
        "awardedByUid": { ".validate": "newData.isString()" },
        "$other":       { ".validate": true }
      }
    },
    "pointRequests": {
      "$requestId": {
        ".write": "(auth.uid === $uid && !data.exists()) || root.child('users').child(auth.uid).child('role').val() === 'admin'",
        ".validate": "newData.hasChildren(['memberId','activity','activityDate','description','submittedAt','status']) && newData.child('memberId').val() === $uid && newData.child('description').isString() && newData.child('description').val().length <= 2000 && ((!data.exists() && auth.uid === $uid && newData.child('status').val() === 'pending') || (data.exists() && root.child('users').child(auth.uid).child('role').val() === 'admin' && auth.uid !== $uid && data.child('status').val() === 'pending' && newData.child('memberId').val() === data.child('memberId').val() && newData.child('activity').val() === data.child('activity').val() && newData.child('submittedAt').val() === data.child('submittedAt').val()))",
        "status":   { ".validate": "newData.val() === 'pending' || newData.val() === 'approved' || newData.val() === 'rejected'" },
        "memberId": { ".validate": "newData.val() === $uid" },
        "$other":   { ".validate": true }
      }
    }
  }
}
```

No `.read` rules are needed — the leaderboard and member point profiles are
meant to be visible to every signed-in member, and the existing read rule on
`users/$uid` (the one that already makes member profiles and @mention
autocomplete work) covers these subtrees automatically.

## What each clause actually enforces

| Requirement | Enforced by |
|---|---|
| A member can't delete or overwrite their own (or anyone's) point awards | `pointAwards` has **no self clause at all** in its `.write` — only the admin condition. Since `.write` is the actual access gate (not `.validate`), this blocks deletes too, not just malformed writes |
| A member can't award themselves points | same clause — the check is on the **caller's own** role, independent of whose subtree is being written |
| An award can't be silently rewritten | when `data.exists()`, the core fields must stay byte-for-byte identical. Revoking still works because it only *adds* fields (`revoked`, `revokedBy*`); a correction must be a **new** record with `correctionOf` pointing back |
| Points can't be a garbage value | `isNumber()` plus a 0–200 range, matching the app-side check |
| A member can't file a request as someone else, or delete/edit one after submitting | `pointRequests` self-write only fires when `!data.exists()` — creation only, once |
| A member can't self-approve | admin review requires `auth.uid !== $uid` — even an admin reviewing their own submission is blocked |
| A request can't be approved twice | review requires the current stored `status` to still be `pending` |
| Signup still works | the node-level `.write` grants a brand-new user (`!data.exists()` at `users/$uid` itself) their full initial record once |
| Profile self-edit still works | each of the 6 fields `profile.js` actually writes gets its own standing self-write grant |
| Admin actions (promote/demote/approve/remove/rename) still work | the node-level admin clause is unconditional — an admin can write or delete anything under any `$uid`, exactly as today |

## Storage rules (the evidence uploads)

Point-request evidence goes to `point_evidence/{uid}/{file}`. The client checks
type and size, but that's a hint, not a boundary:

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    function signedIn() { return request.auth != null; }

    match /point_evidence/{uid}/{fileName} {
      allow read: if signedIn();
      allow write: if signedIn()
                   && request.auth.uid == uid
                   && request.resource.size < 8 * 1024 * 1024
                   && (request.resource.contentType.matches('image/.*')
                       || request.resource.contentType == 'application/pdf');
    }

    // Existing post upload paths.
    match /{folder}/{fileName} {
      allow read: if true;
      allow write: if signedIn()
                   && request.resource.size < 10 * 1024 * 1024
                   && folder in ['post_covers', 'post_docs', 'weekly_images',
                                 'weekly_files', 'academy_images', 'academy_files',
                                 'inline_images'];
    }
  }
}
```

Adjust the `allow read: if true` on the second block if you'd rather post
attachments not be publicly fetchable by URL.

## Verify before trusting it (Console → Realtime Database → Rules → Playground)

Run all of these. #1 and #7 are the ones that matter most — #1 is the
original self-award hole, #7 is the delete gap this update specifically closes.

1. **Write** to `users/<someMemberUid>/pointAwards/test`, authenticated **as
   that same non-admin member**, with a full well-formed record (`{memberId:
   "<their uid>", activity: "meeting_attend", points: 999, activityDate:
   "2026-09-12", awardedAt: 1, awardedByUid: "<their uid>"}`) → **DENIED**.
2. Same write, authenticated **as an admin** → **ALLOWED**.
3. Write `{status: "approved"}` to `users/<own uid>/pointRequests/test`
   as that member → **DENIED**.
4. Create `users/<own uid>/pointRequests/test` as that member with a full
   record and `status: "pending"` → **ALLOWED**.
5. An admin updating `users/<that same admin's own uid>/pointRequests/test`
   → **DENIED** (no self-approval, even for execs).
6. An admin changing `points` on an existing award → **DENIED**
   (corrections must create a new record, not edit in place).
7. **Delete** an existing award at `users/<someMemberUid>/pointAwards/<a
   real existing awardId>`, authenticated **as that same non-admin member**
   → must be **DENIED**. (This is the gap being fixed. If it's allowed, the
   `users/$uid` node-level `.write` still has an unconditional self clause
   somewhere and is still cascading past the field-level restrictions.)
8. Same delete, authenticated **as an admin** → **ALLOWED** (admins can still
   clean up test data / genuinely broken records if needed).
9. **Regression** — as a regular (non-admin) member, `update()` their own
   `displayName` and `bio` at `users/<their own uid>` → must be **ALLOWED**.
   If this fails, the field-level self-write grants aren't matching your
   actual field names — check them against what `profile.js` writes (quoted
   above) rather than this doc.
10. **Regression** — simulate the signup write: `set()` a brand-new
    `users/<a uid that doesn't exist yet>` with `{email, role, status, uid}`,
    authenticated as that same (brand-new) uid → must be **ALLOWED**.

## Known limitations (accepted, not overlooked)

- A member can no longer delete their entire own account record in one shot
  the way an unconditional self-write rule would have allowed. This is a
  deliberate side effect of closing the points-deletion hole, not a bug —
  account removal is now exclusively an admin action (`removeUser` in
  `admin.js`), which is how it already behaves in practice today.
- There's no "cancel my pending request" feature in the UI, so members can't
  currently delete their own submitted requests either, approved/rejected or
  still pending. If you want that later, it needs a narrow, explicit
  addition to the `pointRequests` `.write` rule (allow self-delete only
  when the stored `status` is still `'pending'`) — don't reopen the general
  self-write grant to add it.
- This entire fix assumes `role === 'admin'` is the exact field/value your
  existing rules already check for admin status (`profile.js`/`admin.js`
  behavior implies it, but I've never read your actual rules to confirm).
  Simulation #2 will fail immediately, loudly, and safely if that's wrong —
  it won't silently misbehave.

## After you publish — quick functional smoke test

Everything below is app behavior, not rules — confirms the deploy took and
the feature still works end to end for real users. A few minutes with two
real accounts (one admin, one regular member):

1. As the **regular member**: edit your display name and bio on your own
   profile page and save — this must still work (this is the regression the
   new rules are riskiest for).
2. Sign in as the member → open **Engagement Points** in the sidebar → the
   leaderboard loads and shows a "Request Points" button.
3. Submit a request (pick any activity, add a date/description) → it shows
   as **Pending** on that member's own point history.
4. Sign in as an **admin** → **Admin Panel → 🏆 Points tab → Pending
   Requests** → approve the request you just submitted, adjusting the points
   if you like.
5. Back as the member: refresh — the request now shows **Approved**, and
   the points appear in their total and on the leaderboard without needing
   a manual reload.
6. As the admin, use **Add Points** to award a different member directly,
   then **Revoke** it from the **All Awards** tab — the original stays
   visible (crossed out) with who revoked it and why, nothing disappears.
7. Open devtools console as the **regular member** and try running (this
   attempts the self-award hole with a well-formed record, so a denial can
   only mean the role check is working):
   ```js
   import("https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js")
     .then(m => {
       const db = m.getDatabase(window.auth.app);
       const uid = window.auth.currentUser.uid;
       const path = "users/" + uid + "/pointAwards/hack";
       return m.set(m.ref(db, path), {
         memberId: uid, activity: "meeting_attend", points: 999,
         activityDate: "2026-01-01", awardedAt: Date.now(), awardedByUid: uid
       });
     });
   ```
   This **must fail** with a permission-denied error.
8. Still as the regular member, try deleting one of your own *real* award
   records from devtools (use an `awardId` you can actually see in your own
   point history — open the page, inspect the rendered data, or just try any
   plausible id if none is handy since a nonexistent path denies the same way):
   ```js
   import("https://www.gstatic.com/firebasejs/12.11.0/firebase-database.js")
     .then(m => {
       const db = m.getDatabase(window.auth.app);
       const uid = window.auth.currentUser.uid;
       return m.remove(m.ref(db, "users/" + uid + "/pointAwards/hack"));
     });
   ```
   This **must also fail** with permission-denied — this is the specific gap
   this update closes. If either #7 or #8 succeeds, stop and re-check the
   rules against section "What to add" above before telling anyone it's live.

If steps 1–8 all behave as described, the feature is fully live and secure.
