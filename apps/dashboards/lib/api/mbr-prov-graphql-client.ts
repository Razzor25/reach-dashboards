/**
 * Member Provider GraphQL wrapper.
 * Thin transport layer — business logic belongs in features/reach/service/.
 * Covers: indv, mbr_prov_org_configurations, indv_cli_org.
 */

import { requestGraphql } from "@/lib/graphql/client";

export async function mbrProvGraphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return requestGraphql<T>("mbr-prov", query, variables);
}
