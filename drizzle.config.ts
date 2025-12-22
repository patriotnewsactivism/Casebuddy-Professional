import { defineConfig } from "drizzle-kit";
import { resolveDatabaseUrl } from "./shared/databaseUrl";

const databaseUrl = resolveDatabaseUrl();

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
