require("dotenv").config();
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const prismaClientDir = path.join(root, "node_modules", ".prisma", "client");
const prismaClientFile = path.join(root, "node_modules", ".prisma", "client", "index.js");

if (fs.existsSync(prismaClientDir)) {
  try {
    fs.rmSync(prismaClientDir, { recursive: true, force: true });
  } catch {
    try {
      if (fs.existsSync(prismaClientFile)) fs.unlinkSync(prismaClientFile);
    } catch {}
  }
}

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const isPostgres = Boolean(process.env.VERCEL) || dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
const schema = isPostgres ? "prisma/schema.prisma" : "prisma/schema.sqlite.prisma";

console.log(`[Recura DB] Detected provider: ${isPostgres ? "PostgreSQL" : "SQLite"} (${schema})`);
execSync(`npx prisma generate --schema=${schema}`, { stdio: "inherit" });
