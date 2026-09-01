import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";

const repoRoot = path.resolve(__dirname, "../..");

function read(file: string) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

describe("No Anthropic/Claude dependency remains", () => {
  it("does not contain Anthropic configuration or Claude references in app sources", () => {
    const files = [
      ".env",
      ".env.example",
      "src/lib/types.ts",
      "src/lib/metrics.ts",
      "src/lib/agent.ts",
      "src/app/page.tsx",
      "src/components/AuditFilterExport.tsx",
      "src/components/CaseTimeline.tsx",
      "README.md",
      "docs/ARCHITECTURE.md",
      "docs/PITCH.md",
    ];

    for (const file of files) {
      const content = read(file);
      if (file === "src/tests/no-claude-config.test.ts") continue;
      expect(content.toLowerCase()).not.toContain("anthropic");
      expect(content.toLowerCase()).not.toContain("claude");
    }
  });
});
