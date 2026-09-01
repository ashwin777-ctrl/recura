require("dotenv").config();
const { execSync } = require("child_process");

const dbUrl = process.env.DATABASE_URL || "file:./dev.db";
const isPostgres = Boolean(process.env.VERCEL) || dbUrl.startsWith("postgres://") || dbUrl.startsWith("postgresql://");
const schema = isPostgres ? "prisma/schema.prisma" : "prisma/schema.sqlite.prisma";

console.log(`[Recura DB] Detected provider: ${isPostgres ? "PostgreSQL" : "SQLite"} (${schema})`);
execSync(`npx prisma generate --schema=${schema}`, { stdio: "inherit" });
