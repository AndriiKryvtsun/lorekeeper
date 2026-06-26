## 1. Specs

- [x] 1.1 MODIFY `auth-ui` "Authentication pages" requirement to drop the magic-link option (delta written)
- [x] 1.2 MODIFY `user-auth` "Email authentication" requirement to remove magic link as a secondary path (delta written)

## 2. Code removal

- [x] 2.1 Remove the "Send a magic link instead" button, `onMagicLink`, and the `signInWithMagicLink` action state from `components/auth/sign-in-form.tsx`
- [x] 2.2 Remove the `signInWithMagicLink` Server Action from `lib/auth/actions.ts`
- [x] 2.3 Remove the now-unused `signInWithOtp` mock stub from `lib/auth/actions.test.ts`

## 3. Verification

- [x] 3.1 Run `npx tsc --noEmit` and the full test suite
