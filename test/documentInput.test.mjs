import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  normalizeDocumentInput,
  UserInputError,
} from "../src/documentInput.mjs";

describe("normalizeDocumentInput", () => {
  it("accepts UUIDs", () => {
    assert.equal(
      normalizeDocumentInput("2b4d2c26-44f8-4ad2-86d1-6bb7e30d8c0a"),
      "2b4d2c26-44f8-4ad2-86d1-6bb7e30d8c0a"
    );
  });

  it("accepts Outline slugs", () => {
    assert.equal(
      normalizeDocumentInput("project-plan-abcdefghij"),
      "project-plan-abcdefghij"
    );
  });

  it("extracts the slug from an Outline document URL", () => {
    assert.equal(
      normalizeDocumentInput(
        "https://outline.example.com/doc/project-plan-abcdefghij?ref=nav"
      ),
      "project-plan-abcdefghij"
    );
  });

  it("extracts document ids from an id query parameter", () => {
    assert.equal(
      normalizeDocumentInput(
        "https://outline.example.com/docx-export?id=2b4d2c26-44f8-4ad2-86d1-6bb7e30d8c0a"
      ),
      "2b4d2c26-44f8-4ad2-86d1-6bb7e30d8c0a"
    );
  });

  it("throws for unsupported input", () => {
    assert.throws(
      () => normalizeDocumentInput("https://outline.example.com/settings"),
      UserInputError
    );
  });
});
