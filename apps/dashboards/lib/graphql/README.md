# lib/graphql

## Purpose
Centralized GraphQL transport layer. All low-level HTTP communication with Hasura/GraphQL endpoints lives here.

## Contents
- `client.ts` — core `requestGraphql` function; domain config registry; error logging via `lib/api/server-call-logger`.

## What Goes Here
- Domain endpoint configuration (`endpointEnv`, `secretEnv` per domain)
- The shared `requestGraphql<T>` transport function
- Domain-level GraphQL client wrappers if a domain needs specialized transport behavior

## What Does Not Go Here
- GraphQL query strings (define those in services)
- Domain business logic
- Response mapping or formatting
