"use server";

import {
  fetchInteractionsData,
  fetchMembersReachedData,
  introspectReachSchema,
} from "@/features/reach/service/assessment-measures-service";

// Re-export types from service (must be done separately to avoid server action issues)
export type {
  DateRangeKey,
  InteractionsData,
  MembersReachedData,
} from "@/features/reach/service/assessment-measures-service";

// Introspect the REACH GraphQL schema to find available tables
export async function getAvailableTables(): Promise<string[]> {
  try {
    const tables = await introspectReachSchema();
    return tables.filter(t => !t.startsWith("__"));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to introspect schema: ${message}`);
  }
}

export async function getInteractionsData(
  dateRange: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): Promise<InteractionsData> {
  try {
    return await fetchInteractionsData(dateRange, customFrom, customTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch interactions data: ${message}`);
  }
}

export async function getMembersReachedData(
  dateRange: DateRangeKey,
  customFrom?: string,
  customTo?: string,
): Promise<MembersReachedData> {
  try {
    return await fetchMembersReachedData(dateRange, customFrom, customTo);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch members reached data: ${message}`);
  }
}
