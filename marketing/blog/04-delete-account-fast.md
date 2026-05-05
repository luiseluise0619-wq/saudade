---
title: Why I delete user accounts in 0.3 seconds
slug: delete-account-fast
date: 2026-05-04
edition: en
tags: [gdpr, account-deletion, privacy, engineering, data-rights]
canonical: https://saudade.app/blog/delete-account-fast
description: GDPR Article 17 says you can delete your account. Most apps make it take days. Mine takes 300 milliseconds. Here's the SQL, and why "soft delete" is a polite lie.
---

# Why I delete user accounts in 0.3 seconds

GDPR Article 17 — "the right to erasure", aka the right to be forgotten — says a user can ask a service to delete their personal data. The service has 30 days to comply.

Most services use all 30 days.

Mine takes 300 milliseconds.

Here's the SQL, and an argument for why "soft delete" — the standard industry compromise — is a polite lie.

## The default behaviour

When you click "delete my account" on most products, what happens looks like this:

1. A flag flips on your row. `users.deleted_at = NOW()`.
2. You can no longer log in. The login screen shows "this account has been disabled" or similar.
3. After 30 days, *maybe*, a cron job fires that anonymises some fields. Your name becomes "deleted_user_8281". Your email becomes `deleted_8281@example.com`. Your purchase history stays. Your forum posts stay, attributed to "[deleted]".
4. After 90 days, *maybe*, a manual review process actually deletes some rows.
5. A backup taken before step 1 sits on a third party's S3 bucket forever, contains everything, and nobody is sure how to delete it from there because the backup tool doesn't expose row-level access.

This is, technically, GDPR-compliant. The user has been "erased" in a sense the lawyer can defend. The user's data is on five servers in three jurisdictions, eight days into a 30-day window, behind an auth gate the user can no longer pass.

I find this dishonest. Mostly because it pretends to be honest.

## What I do instead

When you click "delete my account" on saudade, the request hits one endpoint. The endpoint runs eight queries, sequentially, in a single database transaction-ish (D1 doesn't quite do nested transactions, but it does atomic batches; close enough).

```js
const deletes = [
    ['DELETE FROM sessions      WHERE user_id = ?', uid],
    ['DELETE FROM magic_tokens  WHERE email   = ?', email],
    ['DELETE FROM consent_log   WHERE user_id = ?', uid],
    ['DELETE FROM cafe_submissions   WHERE user_email = ?', email],
    ['DELETE FROM city_requests      WHERE user_email = ?', email],
    ['DELETE FROM listening_log      WHERE user_id    = ?', uid],
    ['DELETE FROM user_following_cities WHERE user_id = ?', uid],
    ['DELETE FROM users           WHERE id = ?', uid]
];
for (const [sql, p] of deletes) {
    try { await env.SAUDADE_DB.prepare(sql).bind(p).run(); }
    catch (e) { /* table may not exist in early deployments */ }
}
```

Eight `DELETE` statements. No flags. No anonymisation. No 30-day cooldown. The row is gone. Every row that referenced the row is gone. The session is invalidated. The magic-link tokens (already-issued sign-in URLs) are burned.

Total time, measured at the worker: 280–340 ms across most regions.

## The tombstone

There is one row that survives: a `deletion_log` entry.

```sql
INSERT INTO deletion_log
  (user_id_hash, email_hash, requested_at, deleted_at, reason)
VALUES (?, ?, ?, ?, ?);
```

It is hashed only. Both `user_id` and `email` are SHA-256'd before they go into the row. The original values are not stored anywhere except the deleted user's own past records, which no longer exist.

The point of the tombstone is twofold:

1. **Audit.** If a regulator asks "did you actually honour the deletion request from this user", I can answer. The hash is enough to verify, "yes, an account whose email hashed to X requested deletion at time T and was deleted at T+0.3s." If the regulator wants to recover the email, they can't, and neither can I.
2. **Diagnostic.** If three users a day are deleting their accounts within a minute of signing up, something is wrong with the cover. The log lets me notice without identifying any individual user.

Both purposes are served by hashes. Neither needs the original data.

## Why "soft delete" is a polite lie

The industry argument for soft delete is: "users sometimes change their minds." If you hard-delete, the user can't get their account back. If you soft-delete, they can email support within 30 days and you can flip the flag.

This argument is true in approximately 0.3% of cases.

The remaining 99.7% of soft-delete is one of:

- **Litigation hold.** The company wants the data for the lawsuit it's expecting. This is sometimes legitimate, often not, and rarely disclosed to the user.
- **Re-engagement.** The company wants to send the user a "we miss you" email after 7, 14, 28 days. The deletion was a marketing event, not a privacy event.
- **Analytics.** The company wants to keep the user's behaviour aggregates "for product insights." The data is anonymised in name only — the row IDs still join to everything else.
- **Backup convenience.** The engineering team didn't want to write the backup-purge code.

In none of these cases does the user benefit. In all of them, the user has been told something that isn't quite true: "I deleted my account."

Hard delete is more honest. If the user changes their mind, they can sign up again; the email is the same; the data they care about (cities they've followed, café reviews they've written) is gone, but it was their data and they chose to erase it. That is the right consequence, not a bug.

## What about backups

This is the question every engineer asks first, and it's a fair one.

Cloudflare D1's Time Travel feature can restore a database to any point in the last 30 days. If a user deletes their account at 14:00 today, a malicious operator could in theory restore the database to 13:59 and recover the row.

I cannot prevent this in software. What I can do:

- **Document it.** The privacy policy says: "Deletion is immediate. Database backups exist for up to 30 days for disaster recovery; we do not use them to recover deleted user data, and a row restored from backup would be re-deleted on next sync."
- **Do it.** The next sentence in the privacy policy is enforced by the deployment pipeline: any restore from Time Travel triggers a re-run of the deletion log against the restored database.
- **Be small.** I am a one-person operation. The malicious operator scenario presupposes an adversary inside Cloudflare or inside me. Both are, currently, vanishingly unlikely. I'll re-evaluate if I hire.

This is not perfect. It is, I believe, more honest than the soft-delete model and the equal of any of the larger services I've audited.

## What this looks like to the user

There are two screens.

The first is the account panel at [saudade.app/#account](https://saudade.app/#account). It lists active sessions, lets you sign out of every device, lets you toggle four consent categories, lets you export everything as JSON, and at the very bottom, has a "Danger Zone" with a text input. Type `DELETE` and click the rust-coloured button.

The second is a one-line response: `Account deleted. Goodbye.` The page reloads to the cover. You are now a stranger to saudade.

If you change your mind a week later, sign up again with the same email. We won't recognise you.

## The code

Open source-ish. The repo is private but the worker is on public review. [`/auth/delete` endpoint](https://github.com/luiseluise0619-wq/saudade/blob/main/cloudflare-worker.js#L1500-L1554), 50 lines. The schema for `deletion_log` is in [`schema/sessions.sql`](https://github.com/luiseluise0619-wq/saudade/blob/main/schema/sessions.sql).

If you maintain a product with a soft-delete model and you'd like to make it actual-delete, the migration is small. The argument with your team is large. I'm happy to help with the second.

— LEEJAEJIN, *Lisbon desk · May 2026*
