# app/dashboards

## Purpose
Route segments for each individual Reach dashboard page.

## Structure
Each subfolder maps 1:1 to a dashboard URL path:

| Folder | Route | Dashboard |
|---|---|---|
| `reach-assessment-and-measures/` | `/dashboards/reach-assessment-and-measures` | Reach - Assessment and Measures |
| `reach-file-report/` | `/dashboards/reach-file-report` | Reach - File Report |
| `reach-letter-fulfilment/` | `/dashboards/reach-letter-fulfilment` | Reach - Letter Fulfilment |
| `reach-sdoh/` | `/dashboards/reach-sdoh` | Reach - SDOH |

## What Goes Here
- Next.js `page.tsx` route entrypoints for each dashboard.
- Thin wrappers: pass server-fetched data to client components; no direct business logic.

## What Does Not Go Here
- Domain services, actions, or mappers — those belong in `features/reach/`.
- GraphQL queries or API transport — those belong in `lib/`.
- Shared UI components — those belong in `app/components/`.
