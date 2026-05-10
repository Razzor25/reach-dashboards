import {
  buildGraphqlPayloadLog,
  createServerCallId,
  logServerCall,
} from "@/lib/api/server-call-logger";

export type GraphqlDomain = "reach" | "member-comm" | "user-mgmt" | "mbr-prov";

type DomainConfig = {
  endpointEnv: string;
  secretEnv: string;
  service: string;
};

const DOMAIN_CONFIG: Record<GraphqlDomain, DomainConfig> = {
  reach: {
    endpointEnv: "REACH_GRAPHQL_ENDPOINT",
    secretEnv: "REACH_GRAPHQL_ADMIN_SECRET",
    service: "reach-graphql",
  },
  "member-comm": {
    endpointEnv: "MEMBER_COMM_GRAPHQL_ENDPOINT",
    secretEnv: "MEMBER_COMM_GRAPHQL_ADMIN_SECRET",
    service: "member-comm-graphql",
  },
  "user-mgmt": {
    endpointEnv: "USER_MGMT_GRAPHQL_ENDPOINT",
    secretEnv: "USER_MGMT_GRAPHQL_ADMIN_SECRET",
    service: "user-mgmt-graphql",
  },
  "mbr-prov": {
    endpointEnv: "MBR_PROV_GRAPHQL_ENDPOINT",
    secretEnv: "MBR_PROV_GRAPHQL_ADMIN_SECRET",
    service: "mbr-prov-graphql",
  },
};

function getConfig(domain: GraphqlDomain) {
  const config = DOMAIN_CONFIG[domain];
  const endpoint = process.env[config.endpointEnv];
  const secret = process.env[config.secretEnv];

  return {
    ...config,
    endpoint,
    secret,
  };
}

export async function requestGraphql<T>(
  domain: GraphqlDomain,
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const { endpointEnv, secretEnv, service, endpoint, secret } = getConfig(domain);

  if (!endpoint) {
    throw new Error(`${endpointEnv} is not configured`);
  }

  if (!secret) {
    throw new Error(`${secretEnv} is not configured`);
  }

  const requestId = createServerCallId();
  const startedAt = Date.now();
  const payloadLog = buildGraphqlPayloadLog(query, variables);

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-hasura-admin-secret": secret,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      const durationMs = Date.now() - startedAt;
      logServerCall({
        requestId,
        service,
        destinationUrl: endpoint,
        payload: payloadLog,
        status: "http_error",
        durationMs,
        httpStatus: response.status,
        errorMessage: `GraphQL request failed with status ${response.status}`,
      });

      throw new Error(`GraphQL request failed with status ${response.status}`);
    }

    const data = await response.json();

    if (data.errors) {
      const durationMs = Date.now() - startedAt;
      logServerCall({
        requestId,
        service,
        destinationUrl: endpoint,
        payload: payloadLog,
        status: "graphql_error",
        durationMs,
        httpStatus: response.status,
        errorMessage: JSON.stringify(data.errors),
      });

      throw new Error(`GraphQL errors: ${JSON.stringify(data.errors)}`);
    }

    const durationMs = Date.now() - startedAt;
    logServerCall({
      requestId,
      service,
      destinationUrl: endpoint,
      payload: payloadLog,
      status: "success",
      durationMs,
      httpStatus: response.status,
    });

    return data.data as T;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "Unknown network error";

    logServerCall({
      requestId,
      service,
      destinationUrl: endpoint,
      payload: payloadLog,
      status: "network_error",
      durationMs,
      errorMessage: message,
    });

    throw error;
  }
}
