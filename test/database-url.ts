export const TEST_DATABASE_NAME = "personal_crm_test";

// Same server and credentials as the app, but a separate database, so tests
// never touch real contacts.
export function toTestDatabaseUrl(databaseUrl: string): string {
  const url = new URL(databaseUrl);
  url.pathname = `/${TEST_DATABASE_NAME}`;
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
