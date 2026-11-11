// Drizzle puts the whole SQL and every value into a failed query's message:
// "Failed query: insert into contacts ... params: <name>,<phone>,<email>".
// Anything that logs such an error would write a person's data to the server
// log, so database errors are replaced with a short, data-free summary.

type QueryError = Error & { query: unknown; params: unknown };

// Postgres error fields that name things in the schema, never stored values.
// `message` and `detail` are left out: they may quote values, for example
// "Key (email)=(...) already exists".
type PostgresFields = {
  code?: unknown;
  table_name?: unknown;
  column_name?: unknown;
  constraint_name?: unknown;
};

function isQueryError(value: unknown): value is QueryError {
  return value instanceof Error && "query" in value && "params" in value;
}

function findQueryError(value: unknown): QueryError | undefined {
  const seen = new Set<unknown>();
  let current = value;
  while (current instanceof Error && !seen.has(current)) {
    if (isQueryError(current)) return current;
    seen.add(current);
    current = current.cause;
  }
  return undefined;
}

function describe(cause: unknown): string {
  if (typeof cause !== "object" || cause === null) return "";
  const fields = cause as PostgresFields;
  const parts = [
    ["code", fields.code],
    ["table", fields.table_name],
    ["column", fields.column_name],
    ["constraint", fields.constraint_name],
  ]
    .filter(([, field]) => typeof field === "string" && field !== "")
    .map(([label, field]) => `${label} ${field}`);
  return parts.length > 0 ? ` (${parts.join(", ")})` : "";
}

export function redactError(value: unknown): unknown {
  const queryError = findQueryError(value);
  if (!queryError) return value;

  const safe = new Error(`Database query failed${describe(queryError.cause)}`);
  // The original stack starts with the message that holds the data, so only
  // its "at ..." frames are kept: they show where the query failed.
  const frames = (queryError.stack ?? "")
    .split("\n")
    .filter((line) => /^\s+at /.test(line));
  safe.stack = [`${safe.name}: ${safe.message}`, ...frames].join("\n");
  return safe;
}

export function installSafeConsole(
  target: Pick<Console, "error" | "warn"> = console
) {
  for (const method of ["error", "warn"] as const) {
    const write = target[method].bind(target);
    target[method] = (...args: unknown[]) => write(...args.map(redactError));
  }
}
