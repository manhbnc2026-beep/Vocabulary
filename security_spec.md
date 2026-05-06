# Security Specification - VocabFlow

## 1. Data Invariants
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
9.  **Query Scraping**: List words without filtering by `userId`.
10. **ID Poisoning**: Use a 2KB string as a `listId`.
11. **Example List Abuse**: Add 10,000 examples to a word.
12. **PartOfSpeech Injection**: Set `partOfSpeech` to an invalid type or huge string.

## 3. Test Runner (Draft)
A `firestore.rules.test.ts` would verify these. For this turn, I will implement the rules to block these.
