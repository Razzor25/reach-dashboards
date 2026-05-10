# features/reach/service

## Purpose
Data retrieval layer for the Reach domain. Contains service modules responsible for querying, filtering, pagination, mapping, and bounded in-memory caching.

## Naming Convention
Files must use the `*-service.ts` suffix, e.g. `assessment-measures-service.ts`, `file-report-service.ts`.

## What Goes Here
- GraphQL query variable construction
- Filter translation (UI filter state → query variables)
- Pagination and sorting logic
- Mapping raw API responses to domain record types
- In-memory caching where appropriate

## What Does Not Go Here
- React components or hooks
- Server actions (those belong in `features/reach/actions/`)
- Low-level GraphQL transport (that belongs in `lib/graphql/`)
- Display formatting (that belongs in `features/reach/utility/` or `lib/formats.ts`)
