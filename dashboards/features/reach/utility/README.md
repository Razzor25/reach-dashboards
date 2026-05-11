# features/reach/utility

## Purpose
Reach-specific utility helpers: display formatters, value mappers, and output-shaping functions that are too domain-specific for `lib/formats.ts` but do not belong in services.

## Naming Convention
Files use descriptive camelCase names, e.g. `assessmentFormatters.ts`, `sdohMappers.ts`, `statusLabels.ts`.

## What Goes Here
- Date, text, and numeric formatters specific to Reach domain values
- Mappers that translate service records to UI-ready display objects
- Domain-specific label and status lookup tables

## What Does Not Go Here
- Data retrieval or query logic (that belongs in `features/reach/service/`)
- Generic shared formatters (those belong in `lib/formats.ts`)
- React components or hooks
