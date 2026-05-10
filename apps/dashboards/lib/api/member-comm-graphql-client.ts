/**
 * Member Communication GraphQL wrapper.
 * Covers Member_Communication DB tables: mbr_cmnct, mbr_cmnct_sbj, mbr_cmnct_sts_chg,
 * mbr_cmnct_prtcp, mbr_cmnct_ref, mbr_cmnct_key, mbr_cmnct_atr.
 * Thin transport layer — business logic belongs in features/reach/service/.
 */

import { requestGraphql } from "@/lib/graphql/client";

export async function memberCommGraphqlRequest<T>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  return requestGraphql<T>("member-comm", query, variables);
}
