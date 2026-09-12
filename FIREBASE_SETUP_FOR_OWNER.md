# Firebase Setup — Engagement Points System

For the Firebase project owner. You didn't build this feature, so here's the
minimum you need: what's already in your rules that must not change, exactly
what to add, how to verify it before publishing, and what "it worked" looks
like. (A longer document, `FIREBASE_RULES_POINTS.md`, covers the same ground
with full reasoning if you want it — this one is the checklist.)

No credentials or `config.js` content appear anywhere in this document.

---

## 0. The one thing to understand first

Realtime Database `.write` rules **cascade down and can't be overridden by a
stricter rule further down the tree**, and `.validate` rules **never run on
deletes**. That combination means the points data can't be protected by
adding a rule *at* `pointAwards` alone — it has to be protected by making
sure nothing *above* it grants broader access than intended. That's why
section 2 touches your existing `users/$uid` write rule, not just adds new
child rules under it.

---

## 1. Existing rules that must be preserved

Your current ruleset already has to support this shipped app behavior —
none of it changes, and none of it should be deleted or narrowed:

- **Read access on `users/$uid`** broad enough that any signed-in, approved
  member can read *any* member's profile node (member-profile pages, the
  admin member list, and @mention autocomplete all depend on this today).
  This document adds no new `.read` rules — the points leaderboard and point
  histories ride on this same existing read access.
- **Self-write on `users/$uid`** — a member can write to their own node
  (used both at signup, to create their initial record, and afterward, to
  edit their own profile fields).
- **Admin write on `users/$uid`** — an account whose own `role` is `admin`
  can write to *any* member's node (used for approve/promote/demote/remove
  and now also for renaming a member).
- **All rules for everything outside `users/`** — `discussions`,
  `perspectives`, `features`, `lessons`, `bulletin`, `deleted_posts`, and
  anything else. Nothing in this feature touches those paths. Leave them
  exactly as they are.

Section 2 below replaces the *shape* of the `users/$uid` write rule (from
"self can write the whole node forever" to "self can write the whole node
once, at creation, then only specific fields") without removing any of the
capabilities above — see the table in section 5 for how each one is still covered.

---

## 2. New rules to merge

Merge this into your existing `users` rules block — **do not replace your
whole ruleset with just this** (see the warning in section 7). The
`".write"` at `$uid` is the one line that's a genuine *change* to something
that already exists; everything else here is new:

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

**If your admin check uses a different field/value than `role === 'admin'`,
or your account-approval field isn't relevant here** — this ruleset doesn't
depend on a `status` field at all, only `role`. Swap every occurrence of
`root.child('users').child(auth.uid).child('role').val() === 'admin'` for
whatever your existing admin check actually is; the rest of the structure
stays the same.

---

## 3. Rules Playground tests to run (before publishing)

Realtime Database → Rules → **Playground**. Run all ten; #1 and #7 matter most.

| # | Action | As | Location / data | 
|---|---|---|---|
| 1 | Write | non-admin member | `users/<their uid>/pointAwards/test` — full record, `points: 999` |
| 2 | Write | admin | same as #1 |
| 3 | Write | non-admin member | `users/<their uid>/pointRequests/test` — `{status: "approved"}` |
| 4 | Write | non-admin member | `users/<their uid>/pointRequests/test` — full record, `status: "pending"` |
| 5 | Write | admin | `users/<that admin's own uid>/pointRequests/test` — updating status |
| 6 | Write | admin | change `points` on an *existing* award record |
| 7 | **Delete** | non-admin member | an existing record at `users/<their uid>/pointAwards/<realId>` |
| 8 | Delete | admin | same as #7 |
| 9 | Write | non-admin member | `users/<their uid>/displayName` and `/bio` |
| 10 | Write | a brand-new (not-yet-existing) uid | `users/<new uid>` — `{email, role, status, uid}` |

---

## 4. Firebase Storage rules (point-request evidence)

Point-request evidence uploads go to `point_evidence/{uid}/{fileName}`.
Storage → Rules:

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

    // Existing post upload paths used elsewhere on the site — merge with
    // whatever Storage rules already exist for these, don't replace them.
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

Tighten `allow read: if true` on the second block if post attachments
shouldn't be fetchable by anyone with the URL.

---

## 5. What a successful test run looks like

| # | Expected result | Why |
|---|---|---|
| 1 | **DENIED** | A member can never write into `pointAwards` — no self clause exists in that rule at all |
| 2 | **ALLOWED** | Admins can award points directly |
| 3 | **DENIED** | Only an admin can change a request's status |
| 4 | **ALLOWED** | A member can create their own pending request |
| 5 | **DENIED** | An admin can't approve their own submission |
| 6 | **DENIED** | Existing awards are immutable; corrections must be new records |
| 7 | **DENIED** | **The specific gap this ruleset closes** — no delete access for members, since `.write` (not `.validate`) is what gates deletes |
| 8 | **ALLOWED** | Admins retain cleanup ability |
| 9 | **ALLOWED** | Profile self-editing still works — the regression this change risks most |
| 10 | **ALLOWED** | Signup still works |

If all ten match, publish.

---

## 6. If a test fails

- **#2, #5, #6, or #8 don't match** → your admin check isn't
  `role === 'admin'`. Find your existing rule's actual admin condition and
  substitute it everywhere `root.child('users').child(auth.uid).child('role').val()
  === 'admin'` appears in section 2. Re-run all ten.
- **#9 fails (denied when it should be allowed)** → the app writes a field
  under `users/$uid` that isn't in this ruleset's allowlist (`displayName`,
  `bio`, `phone`, `secondaryEmail`, `emailNotifications`, `phoneNotifications`).
  Add the missing field's own `{ ".write": "auth.uid === $uid" }` entry.
  **Do not** fix this by making `users/$uid`'s top-level `.write` unconditional
  for `auth.uid === $uid` again — that reopens the exact hole in test #7.
- **#10 fails** → something else is required at signup beyond
  `email`/`role`/`status`/`uid`. Check what the signup code actually writes
  and make sure the `!data.exists()` clause still covers a fresh node with
  no field restrictions (it should, by design — it only restricts *existing*
  records).
- **#1 or #7 succeed when they should be denied** → the top-level `users/$uid`
  `.write` still has an unconditional self-write clause (`auth.uid === $uid`
  with no `&& !data.exists()`) somewhere, and it's cascading past the
  restrictions below it. Fix that line specifically, re-run all ten.
- **Anything else unexpected** → don't publish. Revert to your saved copy of
  the original rules (see the warning below) and get whoever built this
  feature to look at the specific failing case.

---

## 7. ⚠️ Do not replace your whole ruleset with just this

**Before touching anything: copy your current rules to a text file, or note
where your Console's version history is, so you can roll back in one click.**

The JSON in section 2 is a *fragment* — it only shows the `users` block, and
only the parts of it that are new or changed. Your actual ruleset has rules
for other top-level paths (`discussions`, `perspectives`, `features`,
`lessons`, `bulletin`, `deleted_posts`, and possibly more) that are **not
shown here because they don't need to change**. If you paste section 2 in as
your entire ruleset, you will delete all of those and break the rest of the
site. Merge it into what you have; don't overwrite.
