// Creates and migrates the e2e database. Runs before the app under test starts
// (see webServer in playwright.config.ts): the app's /health needs the database.
import { prepareTestDatabase } from "../test/prepare-database";
import { e2eDatabaseUrl } from "./database";

await prepareTestDatabase(e2eDatabaseUrl());
console.log("E2E database is ready.");
