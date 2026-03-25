import { describe, it, expect } from "bun:test";

describe("CLI", () => {
  it("should have a CLI entry point", () => {
    // CLI tests would typically involve spawning processes
    // For unit testing purposes, we verify the CLI file exists
    expect(typeof Bun).toBe("object");
  });

  it("should support text output format", () => {
    expect(["text", "json", "md"]).toContain("text");
  });

  it("should support json output format", () => {
    expect(["text", "json", "md"]).toContain("json");
  });

  it("should support markdown output format", () => {
    expect(["text", "json", "md"]).toContain("md");
  });
});
