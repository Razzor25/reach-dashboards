# lib/shared

## Purpose
Cross-feature shared modules: chart utilities, reusable data structures, and infrastructure shared by two or more features.

## What Goes Here
- Shared chart data helpers and formatters
- Cross-feature cache utilities
- Common type definitions shared by multiple features

## What Does Not Go Here
- Feature-specific logic (that belongs in `features/reach/`)
- Low-level transport (that belongs in `lib/graphql/` or `lib/api/`)
- Domain constants (that belong in `lib/constants/`)
