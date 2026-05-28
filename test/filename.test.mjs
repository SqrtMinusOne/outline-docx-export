import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeFilename } from "../src/filename.mjs";

describe("sanitizeFilename", () => {
  it("removes reserved characters", () => {
    assert.equal(sanitizeFilename('Q2: Plan / "Draft"?'), "Q2- Plan - Draft");
  });

  it("falls back for empty names", () => {
    assert.equal(sanitizeFilename(" / "), "outline-document");
  });

  it("limits long names", () => {
    assert.equal(sanitizeFilename("x".repeat(150)).length, 120);
  });
});
