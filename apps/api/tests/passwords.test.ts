import { describe, expect, it } from "vitest";
import { hashPassword, verifyPassword } from "../src/lib/passwords.js";

describe("passwords", () => {
  it("hashes and verifies", async () => {
    const hashed = await hashPassword("secret");
    expect(hashed).not.toBe("secret");
    expect(await verifyPassword("secret", hashed)).toBe(true);
    expect(await verifyPassword("nope", hashed)).toBe(false);
  });
});
