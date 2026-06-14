## ADDED Requirements

### Requirement: User profile is 1:1 with the auth user
The system SHALL persist a `Profile` with a unique `userId` (the Supabase auth user id, 1:1),
an optional `displayName`, optional `avatarUrl`, optional `bio`, optional `locale` and
`timezone`, and created/updated timestamps. The table SHALL be protected by Row-Level Security
keyed on the owner (`userId = auth.uid()`), consistent with the other tables.

#### Scenario: One profile per user
- **WHEN** a profile is created for a user
- **THEN** at most one `Profile` row exists for that `userId` (unique)

#### Scenario: RLS restricts a profile to its owner
- **WHEN** the `Profile` table is queried under the authenticated role
- **THEN** a user can read/write only their own profile row (`userId = auth.uid()`)
