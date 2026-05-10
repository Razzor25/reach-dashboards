# lib/api

## Purpose
Server-side API utilities: server actions that adapt service results for the client boundary, low-level API transport wrappers, and shared logging infrastructure.

## What Goes Here
- `server-call-logger.ts` — structured logging for outbound server calls (GraphQL, REST)
- Domain-specific GraphQL client wrappers (e.g. `reach-graphql-client.ts`)
- Server actions that are shared across features (thin adapter layer only; delegate to `features/*/service/`)

## What Does Not Go Here
- Domain business logic (that belongs in `features/reach/service/`)
- React components or client-side hooks
- GraphQL transport core (that belongs in `lib/graphql/`)
