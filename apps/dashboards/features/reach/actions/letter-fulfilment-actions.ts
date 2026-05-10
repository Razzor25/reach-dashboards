"use server";

import {
  fetchLetterRecords,
  fetchLetterFilterOptions,
} from "@/features/reach/service/letter-fulfilment-service";
import type {
  LetterRecord,
  LetterStatusTab,
  DateRangeKey,
  LetterFilterOptions,
} from "@/features/reach/service/letter-fulfilment-service";

export type LetterPageResult = {
  records: LetterRecord[];
  totalCount: number;
};

export async function getLetterRecords(
  tab: LetterStatusTab,
  dateRange: DateRangeKey,
  page: number,
  pageSize: number,
  memberId: string = "All",
  org: string = "All",
): Promise<LetterPageResult> {
  try {
    return await fetchLetterRecords(tab, dateRange, page, pageSize, memberId, org);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch letter fulfilment records: ${message}`);
  }
}

export async function getLetterFilterOptions(
  dateRange: DateRangeKey,
  tab: LetterStatusTab,
): Promise<LetterFilterOptions> {
  try {
    return await fetchLetterFilterOptions(dateRange, tab);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    throw new Error(`Failed to fetch letter filter options: ${message}`);
  }
}
