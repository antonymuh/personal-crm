export const TEST_DATABASE_NAME = "personal_crm_test";
// Separate from the Vitest one, so both suites can run at the same time.
export const E2E_DATABASE_NAME = "personal_crm_e2e_test";

// Same server and credentials as the app, but a separate database, so tests
// never touch real contacts.
export function toTestDatabaseUrl(
  databaseUrl: string,
  name: string = TEST_DATABASE_NAME
): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${name}`;
  return url.toString();
}

export function databaseName(databaseUrl: string): string {
  return decodeURIComponent(new URL(databaseUrl).pathname.slice(1));
}

export function assertTestDatabase(name: string): void {
  if (!name.endsWith("_test")) {
    throw new Error(
      `Refusing to run tests against database "${name}": its name must end with "_test".`
    );
  }
}
