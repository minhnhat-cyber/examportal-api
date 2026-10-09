import test from "node:test";
import assert from "node:assert/strict";
import { validateStudent } from "./student-validation.js";
test("account addresses support a domain without a dot", () => {
  assert.equal(validateStudent({ name: "Alice", email: "alice@examportal" }).value.email, "alice@examportal");
  assert.ok(validateStudent({ name: "Alice", email: "alice@example.com" }).value);
  for (const email of ["alice", "alice@@examportal", "alice@", "alice @examportal"]) assert.ok(validateStudent({ name: "Alice", email }).error);
});
