import test from "node:test";
import assert from "node:assert/strict";
import { currentUser, hashToken, originAllowed, sessionCookie, tokenFrom, withAuth } from "./auth.js";
test("opaque session cookie parsing and hashing", () => {
  const token = "a".repeat(64);
  assert.equal(tokenFrom(new Request("https://example.test", { headers: { cookie: `other=1; examportal_session=${token}` } })), token);
  assert.equal(tokenFrom(new Request("https://example.test", { headers: { cookie: "examportal_session=bad" } })), undefined);
  assert.equal(hashToken(token).length, 64);
  assert.match(sessionCookie(token), /HttpOnly; SameSite=Lax/);
  assert.match(sessionCookie("", 0), /Max-Age=0/);
});
test("anonymous requests cannot reach protected handlers", async () => {
  let called = false;
  const response = await withAuth("teacher", () => { called = true; })(new Request("https://example.test/api/questions"));
  assert.equal(response.status, 401); assert.equal(called, false);
});
test("foreign-origin writes are rejected before authentication", async () => {
  const request = new Request("https://example.test", { method: "POST", headers: { origin: "https://evil.test" } });
  assert.equal(originAllowed(request), false);
  assert.equal((await withAuth("teacher", () => assert.fail())(request)).status, 403);
});
test("session identity comes from database, never student header", async () => {
  const user = { _id: "real-user", role: "student", status: "active" };
  const db = { collection(name) { return { async findOne(query) { if (name === "sessions") { assert.ok(query.expiresAt.$gt instanceof Date); return { userId: user._id }; } assert.equal(query._id, user._id); assert.equal(query.status, "active"); return user; } }; } };
  const request = new Request("https://example.test", { headers: { cookie: `examportal_session=${"b".repeat(64)}`, "x-student-id": "spoofed" } });
  assert.equal(await currentUser(request, db), user);
});
