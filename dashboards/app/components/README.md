# app/components

## Purpose
Shared shell and navigation components used across all Reach dashboard pages.

## Contents
- `AppShell.tsx` — top-level layout wrapper; composes `BrandHeader` and `LeftNav`; resolves the active dashboard name from the current route path.
- `BrandHeader.tsx` — top brand header with Optum/Curo logos, page title, and conditional Back button.
- `LeftNav.tsx` — left icon navigation sidebar for large screens; Reach-specific nav items.

## What Goes Here
- Shell/chrome components that wrap every page (header, nav, layout scaffold).
- Shared presentational components used by two or more dashboard pages.

## What Does Not Go Here
- Domain-specific chart or data components — those belong in `features/reach/`.
- Page-level components that are only used by a single dashboard route.
- Utility functions or data access — those belong in `lib/`.
