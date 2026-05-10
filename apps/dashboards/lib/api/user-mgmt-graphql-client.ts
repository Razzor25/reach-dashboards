/**
 * User Management GraphQL wrapper.
 * Thin transport layer — business logic belongs in features/reach/service/.
 */

import { requestGraphql } from "@/lib/graphql/client";

export async function userMgmtGraphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return requestGraphql<T>("user-mgmt", query, variables);
}
