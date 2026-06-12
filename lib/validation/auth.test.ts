import { describe, expect, it } from "vitest";

import {
  PASSWORD_MIN_LENGTH,
  emailSchema,
  resetPasswordSchema,
  signUpSchema,
} from "@/lib/validation/auth";

describe("emailSchema normalization", () => {
  it("trims and lowercases the email", () => {
    expect(emailSchema.parse("  User@Example.COM ")).toBe("user@example.com");
  });

  it("rejects an invalid email", () => {
    expect(emailSchema.safeParse("nope").success).toBe(false);
  });
});

describe("password rules", () => {
  it(`rejects a password shorter than ${PASSWORD_MIN_LENGTH}`, () => {
    const res = signUpSchema.safeParse({
      email: "a@b.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(res.success).toBe(false);
  });

  it("rejects mismatched confirm-password", () => {
    const res = signUpSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      confirmPassword: "password2",
    });
    expect(res.success).toBe(false);
  });

  it("accepts a valid, matching password", () => {
    const res = signUpSchema.safeParse({
      email: "a@b.com",
      password: "password1",
      confirmPassword: "password1",
    });
    expect(res.success).toBe(true);
  });

  it("resetPasswordSchema enforces match", () => {
    expect(
      resetPasswordSchema.safeParse({
        password: "password1",
        confirmPassword: "nope",
      }).success,
    ).toBe(false);
  });
});
