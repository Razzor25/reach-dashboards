/**
 * REACH (QOM) GraphQL wrapper.
 * Covers QOM DB tables: qom_interaction, interaction_type, qom_ref,
 * dw_questnr_rspn_dtl, call_screening.
 * Thin transport layer — business logic belongs in features/reach/service/.
 */

import { requestGraphql } from "@/lib/graphql/client";

export async function reachGraphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return requestGraphql<T>("reach", query, variables);
}
