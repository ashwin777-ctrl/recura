import fs from "fs";
import path from "path";

async function main() {
  console.log("\n=======================================================");
  console.log("    RECURA VS CODE MIGRATION VERIFICATION SUITE       ");
  console.log("=======================================================\n");

  let allPassed = true;

  // 1. Check required VS Code files
  const requiredFiles = [
    ".vscode/mcp.json",
    ".vscode/settings.json",
    ".vscode/launch.json",
    ".vscode/tasks.json",
    ".vscode/extensions.json",
    ".github/copilot-instructions.md",
    ".vscode/instructions/ui-ux-craft.md",
    ".vscode/instructions/playwright-testing.md",
    ".vscode/instructions/policy-engine.md",
    ".vscode/instructions/performance-security.md",
    ".vscode/instructions/code-quality.md",
    ".vscode/instructions/gsd-lifecycle.md",
    ".vscode/instructions/architecture-ddd.md",
    ".github/prompts/audit.prompt.md",
    ".github/prompts/deploy-verify.prompt.md",
  ];

  console.log("1. Checking VS Code Configuration Files:");
  for (const file of requiredFiles) {
    const fullPath = path.join(process.cwd(), file);
    if (fs.existsSync(fullPath)) {
      console.log(`  ✅ ${file} exists`);
    } else {
      console.log(`  ❌ MISSING: ${file}`);
      allPassed = false;
    }
  }

  // 2. Validate .vscode/mcp.json structure
  console.log("\n2. Validating .vscode/mcp.json MCP Server Definitions:");
  const mcpConfig = JSON.parse(fs.readFileSync(path.join(process.cwd(), ".vscode/mcp.json"), "utf8"));
  const expectedServers = ["github", "playwright", "supabase", "vercel"];
  for (const s of expectedServers) {
    if (mcpConfig.mcpServers && mcpConfig.mcpServers[s]) {
      console.log(`  ✅ MCP Server configured: ${s}`);
    } else {
      console.log(`  ❌ Missing MCP Server: ${s}`);
      allPassed = false;
    }
  }

  // 3. Test Supabase Connectivity via /api/health
  console.log("\n3. Testing Supabase & Vercel Live Health:");
  try {
    const res = await fetch("https://recura-three.vercel.app/api/health");
    if (res.ok) {
      const data = await res.json();
      console.log(`  ✅ Live Vercel Endpoint reachable: https://recura-three.vercel.app`);
      console.log(`  ✅ Supabase Status: ${data.database?.status}, Provider: ${data.database?.provider}, Latency: ${data.database?.latencyMs}ms`);
    } else {
      console.log(`  ❌ Vercel /api/health returned status ${res.status}`);
      allPassed = false;
    }
  } catch (err: any) {
    console.log(`  ❌ Live health check error: ${err.message}`);
    allPassed = false;
  }

  console.log("\n=======================================================");
  if (allPassed) {
    console.log("🎉 ALL VS CODE MIGRATION VALIDATION CHECKS PASSED!");
  } else {
    console.log("❌ MIGRATION VALIDATION FOUND ISSUES");
  }
  console.log("=======================================================\n");

  if (!allPassed) process.exit(1);
}

main();
