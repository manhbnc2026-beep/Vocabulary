# Security Specification - VocabFlow

## 1. Data Invariants
- **Access Control**: Only users in the `allowed_users` collection OR the super admin (`manhbnc2026@gmail.com`) can read/write application data.
- **Role Management**: Only admins can modify the `allowed_users` collection.
- A Word must belong to a VocabList.
- A Word and VocabList must have a `userId` that matches the authenticated user.
- Timestamps must be server-validated.
- Words and VocabLists cannot be modified by other users.
- String sizes must be limited to prevent abuse.

## 2. The "Dirty Dozen" Payloads (Denial Tests)

1.  **Identity Spoofing (Create Word)**: Create a word with `userId` of another user.
2.  **Orphaned Word**: Create a word with a `listId` that doesn't exist.
3.  **Cross-User List Access**: Read a `vocab_list` belonging to another user.
4.  **Bulk Metadata Injection**: Add a `ghostField` to a `vocab_list`.
5.  **State Poisoning**: Update `text` of a word (immutability check).
6.  **Resource Exhaustion**: Send a 1MB string in `meaningVi`.
7.  **Timestamp Spoofing**: Provide a client-side `createdAt` date instead of `request.time`.
8.  **Anonymous Write**: Attempt to write without being signed in.
9.  **Whitelist Bypass**: A signed-in user NOT in `allowed_users` attempting to list words.
10. **Privilege Escalation**: A whitelisted 'user' attempting to add another user to `allowed_users`.
11. **Self-Admin**: A user attempting to change their own role to 'admin'.
12. **Super-Admin Deletion**: Attempting to delete the super-admin entry from `allowed_users`.

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify these. For this turn, I will implement the rules to block these.
