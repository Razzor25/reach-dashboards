# lib/constants

## Purpose
Shared reference data constants used across features and pages: org lookups, status mappings, priority tables, and other stable reference values.

## What Goes Here
- Org and market lookup tables (e.g. `orgs.ts`)
- Status label mappings (e.g. `status-mapping.ts`)
- Priority/category reference data (e.g. `priorities.ts`)
- Any other stable, domain-agnostic reference tables

## What Does Not Go Here
- Domain-specific business logic
- Mutable state or runtime-derived values
- Feature-specific constants (those belong in `features/reach/utility/`)
