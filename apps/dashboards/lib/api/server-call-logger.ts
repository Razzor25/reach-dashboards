type ServerCallStatus = "success" | "http_error" | "graphql_error" | "network_error";

type ServerCallLogEntry = {
  requestId: string;
  service: string;
  destinationUrl: string;
  payload: unknown;
  status: ServerCallStatus;
  durationMs: number;
  httpStatus?: number;
  errorMessage?: string;
};

const SERVER_CALL_LOGGING_ENABLED = process.env.SERVER_CALL_LOGGING_ENABLED !== "false";
const LOG_MODE: "tracking" | "debug" =
  process.env.SERVER_CALL_LOG_MODE === "debug" ? "debug" : "tracking";
const MAX_QUERY_LOG_LENGTH = 2000;
const SLOW_CALL_THRESHOLD_MS = 5000;
const ANSI_YELLOW = "\x1b[33m";
const ANSI_RESET = "\x1b[0m";

export function createServerCallId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function extractGraphqlOperationName(query: string): string {
  const match = query.match(/^\s*(?:query|mutation|subscription)\s+([A-Za-z_][A-Za-z0-9_]*)/m);
  return match?.[1] ?? "anonymous";
}

export function buildGraphqlPayloadLog(
  query: string,
  variables?: Record<string, unknown>,
): { query: string; variables?: Record<string, unknown> } {
  const compactQuery = query.replace(/\s+/g, " ").trim();

  return {
    query:
      compactQuery.length > MAX_QUERY_LOG_LENGTH
        ? `${compactQuery.slice(0, MAX_QUERY_LOG_LENGTH)}...`
        : compactQuery,
    variables: sanitizeGraphqlVariablesForLog(variables),
  };
}

function sanitizeGraphqlVariablesForLog(
  variables?: Record<string, unknown>,
): Record<string, unknown> | undefined {
  if (!variables) {
    return variables;
  }

  const sanitized: Record<string, unknown> = { ...variables };

  for (const key of ["memberIds", "indvIds"]) {
    const value = sanitized[key];
    if (Array.isArray(value)) {
      sanitized[key] = `[hidden ${key}; count=${value.length}]`;
    }
  }

  return sanitized;
}

export function logServerCall(entry: ServerCallLogEntry): void {
  if (!SERVER_CALL_LOGGING_ENABLED) {
    return;
  }

  if (LOG_MODE === "tracking") {
    logTrackingLine(entry);
    return;
  }

  logDebugBlock(entry);
}

function logTrackingLine(entry: ServerCallLogEntry): void {
  const payload = entry.payload as Record<string, unknown> | null;
  const operationName =
    payload && typeof payload.query === "string"
      ? extractGraphqlOperationName(payload.query)
      : "n/a";

  const isSlow = entry.durationMs >= SLOW_CALL_THRESHOLD_MS;
  const prefix = isSlow ? `${ANSI_YELLOW}[SLOW]${ANSI_RESET} ` : "";

  const parts = [
    `[gql]`,
    operationName,
    entry.service,
    entry.destinationUrl,
    entry.status,
    `${entry.durationMs}ms`,
  ];

  if (entry.errorMessage) {
    parts.push(`error=${entry.errorMessage}`);
  }

  console.log(`${prefix}${parts.join(" | ")}`);
}

function logDebugBlock(entry: ServerCallLogEntry): void {
  const isSlow = entry.durationMs >= SLOW_CALL_THRESHOLD_MS;
  const label = isSlow ? `${ANSI_YELLOW}[SLOW SERVER CALL]${ANSI_RESET}` : "[SERVER CALL]";

  console.log(`\n${label}`);
  console.log(`  requestId   : ${entry.requestId}`);
  console.log(`  service     : ${entry.service}`);
  console.log(`  url         : ${entry.destinationUrl}`);
  console.log(`  status      : ${entry.status}`);
  console.log(`  duration    : ${entry.durationMs}ms`);

  if (entry.httpStatus !== undefined) {
    console.log(`  httpStatus  : ${entry.httpStatus}`);
  }

  if (entry.errorMessage) {
    console.log(`  error       : ${entry.errorMessage}`);
  }

  if (entry.payload) {
    console.log(`  payload     :`, JSON.stringify(entry.payload, null, 2));
  }

  console.log();
}
