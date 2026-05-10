# Features Folder

## Purpose
This folder holds domain/business logic organized by business area. Keep feature behavior here, not in route files.

## Current Domains
- `reach`: All Reach application business logic
  - `service/`: Data retrieval, query construction, filtering, pagination, and caching
  - `utility/`: Domain-specific formatters, mappers, and helper functions

## What Goes Here
- Domain services (`service/*-service.ts`)
- Server actions (`actions/*-actions.ts`) used by client pages/components
- Domain utility helpers (`utility/*`) for output shaping and formatting

## What Does Not Go Here
- Next.js route handlers (`app/api/*`)
- Page/layout wiring (`app/*`)
- Shared cross-domain infrastructure (`lib/*`)

## Rules
- Keep each feature self-contained.
- Import shared infrastructure from `lib/*`.
- Avoid feature-to-feature circular dependencies.
