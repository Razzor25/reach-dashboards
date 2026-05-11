<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Reach Dashboards Repo Standards

Use this file as the single source of truth for repo-wide coding patterns. Keep it committed, concise, and prescriptive so all sessions and all developers get the same defaults.

## Scope

- Apply these rules to every change unless a nearby file already establishes a stronger local pattern.
- Preserve existing public APIs and file structure unless the task explicitly requires a change.
- Prefer extending existing dashboard patterns over introducing new abstractions.

## Naming Conventions

- Use PascalCase for React components and component file names, for example `BrandHeader`, `AppShell`, and `LeftNav`.
- Use camelCase for helpers, service functions, server actions, constants, and local variables.
- Keep domain types named from the business concept, for example `ReachRecord`, `AssessmentPage`, `StatusFilter`, and `DateRangeKey`.
- Prefer explicit names over shortened aliases. Abbreviations are acceptable only when the repo already uses the domain term.
- Name route segments, folders, and URL paths in lowercase kebab-case.
- Match existing suffixes for backend access layers:
	- `*-service.ts` for data retrieval, query construction, mapping, caching, and orchestration.
	- `*-actions.ts` for server actions that adapt service results for the client boundary.
	- `*-client.ts` for low-level API or GraphQL transport wrappers.

## Data Retrieval Patterns

- Default to server-first data access. Fetch data in server routes, server actions, or server-side modules before passing the result to client components.
- Keep transport and low-level connector logic in `lib/graphql/` and `lib/api/`. Do not place endpoint wiring directly in page or presentational component files.
- Use `features/reach/service/*-service.ts` for the main domain retrieval workflow, including:
	- query variable construction
	- filter translation
	- pagination and sorting logic
	- mapping related datasets into domain records
	- bounded in-memory caching where already used by the repo
- Use `features/reach/actions/*-actions.ts` only as a thin server boundary. Actions should validate or adapt payloads for serialization, then delegate to the service layer.
- Keep formatting concerns out of the data retrieval layer. Date, text, and display formatting belongs in `features/reach/utility/` or `lib/formats.ts`.
- When adding a new dashboard data source, follow the existing split:
	- centralized GraphQL transport and domain client wrappers in `lib/graphql/` and `lib/api/`
	- domain service in `features/reach/service/`
	- optional server action in `features/reach/actions/`
	- optional utility helpers in `features/reach/utility/`
	- page/component consumption in `app/`
- Reuse existing domain constants and lookup tables before introducing new copies of the same reference data.

## Architecture Guardrails

- Keep `app/` thin: route entrypoints, route handlers, layout wiring, and HTTP response concerns only.
- Keep domain behavior in `features/`:
	- `features/reach/service/*`
	- `features/reach/actions/*`
	- `features/reach/utility/*`
- Keep shared infrastructure in `lib/` only (GraphQL transport, shared cache/ref lookups, constants, formatting, chart shared modules).
- Do not reintroduce domain logic folders under `lib/reach` or `lib/domain`.
- Do not reintroduce compatibility shims for moved domain services/actions unless explicitly requested for a migration window.

## UI Experience Patterns

- Preserve the current dashboard experience: clean clinical/operations UI, high scanability, restrained color, strong hierarchy, and low visual noise.
- Prefer the existing palette and surface language already used across the app: white and slate surfaces with cyan accents for featured or primary emphasis.
- Keep shell elements consistent with the current layout:
	- top brand header
	- left icon navigation on large screens
	- content area with generous whitespace and clear section separation
- Favor readable card and table layouts with obvious labels, concise copy, and predictable interaction targets.
- Use Tailwind utility classes in the same style as the existing codebase. Avoid introducing a separate styling pattern unless there is a clear need.
- Do not introduce flashy animation, dense gradients, or decorative effects that conflict with the current product feel.
- Prefer responsive layouts that remain usable on smaller widths without changing the information hierarchy.

## App Router Patterns

- Follow the App Router structure already present in `app/`.
- Keep shared shell and navigation logic in `app/components/`.
- Use `"use client"` only for components that need hooks, browser APIs, or direct interactivity.
- Keep route files and layouts thin; move reusable logic into `lib/` or focused components.

## Documentation Convention

- Use folder-level `README.md` files as the primary source of ownership and boundary documentation.
- Add or update a folder `README.md` whenever introducing a new functional folder or changing folder responsibilities.
- Keep folder docs short and actionable. Include:
	- purpose of the folder
	- what belongs in the folder
	- what should not be added there
	- boundary references to adjacent layers
- Prefer documentation at architecture boundaries first:
	- `features/`
	- feature subfolders like `actions/`, `service/`, and `utility/`
	- `app/components/`, `app/dashboards/`
	- shared `lib/` domains such as `graphql/`, `shared/`, and `constants/`
- Do not add top-of-file comment blocks to every file.
- Add file-level header comments only when a file has non-obvious intent, nuanced constraints, or migration caveats that are hard to infer from names and types.
- Keep file-level headers concise and focused on intent and constraints, not line-by-line behavior.
- When folder docs and file headers disagree, align code and docs in the same change and treat folder `README.md` as the architecture source of truth.

## Change Discipline

- Before writing code against framework behavior, read the relevant docs under `node_modules/next/dist/docs/` when the task touches a changed or uncertain Next.js surface.
- Make the smallest change that fits the existing dashboard pattern.
- Avoid inventing new naming schemes, folder conventions, or UI motifs when an existing repo pattern already solves the problem.
- If you introduce a new convention that should persist, update this file in the same change.
