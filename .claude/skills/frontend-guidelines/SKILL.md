---
name: frontend-guidelines
description: "Frontend architecture rules and conventions for React/TypeScript apps using Atomic Design. Use when: creating or editing files in a frontend source tree; adding atoms/molecules/organisms/templates/pages; building forms, lists, dashboards or detail screens; introducing a new route; wiring server state with a data-fetching library (TanStack Query, SWR, RTK Query); adding UI-kit components (shadcn/ui, MUI, Chakra); adding icons; writing Storybook stories; rendering a name for another user/owner/author; adding or changing translatable strings; deciding which atomic layer a component or hook belongs in; reviewing a diff for layering, naming or duplication violations. DO NOT USE FOR: backend changes; infrastructure/Docker; auth/role/permission matrix changes; non-React frontends."
---

<!-- tech-rules:managed 2.0.0 -->

# Frontend Guidelines

Reusable checklist for any React + TypeScript frontend organised by Atomic Design. The skill
encodes layer boundaries, file conventions, data-flow rules and a mandatory duplicate scan.

**Precedence:** project-specific overrides (paths, libraries, templates) belong in the host repo's
`CLAUDE.md` / `AGENTS.md` / `agents.md` and take precedence over this skill.

## When to Use

- Touching any file in the frontend source tree (typical root: `src/`).
- Adding or refactoring a component, hook, service, route or page.
- Reviewing a PR/diff for layering, naming or duplication issues.
- Deciding which atomic layer (atom / molecule / organism / template / page) a piece of UI belongs
  in.

## Assumed Stack (adapt to project)

- React 18+ with TypeScript in strict mode (no `any`, no unexplained `@ts-ignore`).
- A utility-CSS or design-system layer (e.g. Tailwind) - no inline `style={{}}`.
- A headless/UI primitive kit (shadcn/ui, Radix, Headless UI) imported **only** from the atoms
  layer.
- A client-side router with route paths defined as constants; non-home routes lazy-loaded.
- A server-state library (TanStack Query, SWR, RTK Query) - components never call `fetch`/`axios`
  directly.
- A global UI-state mechanism (React Context preferred; avoid global stores unless measured
  performance requires one).
- Storybook (CSF3) for atoms, molecules, organisms and templates.
- A single icon library; **no inline SVG icons**.

> If the host project mandates specific libraries, use those exact ones.

## Atomic Design Layer Map

| Layer     | Folder (typical) | Holds | Forbidden |
| --------- | ---------------- | --- | --- |
| Atoms     | `src/atoms/`     | Smallest UI primitives; thin wrappers over UI-kit components | Business logic; direct domain types |
| Molecules | `src/molecules/` | 2+ atoms composed into a meaningful piece (FormField, StatCard) | Page/domain logic; implicit prop spreading |
| Organisms | `src/organisms/` | Reusable complex sections (DataTable, PageHeader, Modal, Form) | Direct data fetching - data comes via props |
| Templates | `src/templates/` | Page layout shells with named slots | Domain content; one-off layouts living inside a page |
| Pages     | `src/pages/`     | Route-level screens grouped by feature subfolder (`pages/<feature>/<Name>Page.tsx`) | Page files directly under `pages/`; structural `div`s / custom layout markup |
| Features  | `src/features/`  | Domain modules (hooks, context, domain-specific components) | Cross-domain coupling |
| Hooks     | `src/hooks/`     | Cross-cutting reusable hooks | Domain-specific logic (put it under `features/`) |
| Services  | `src/services/`  | Query/mutation definitions for the server-state library | Component imports of raw `fetch`/`axios` |
| Context   | `src/context/`   | Global UI state providers | Server state (use the data layer) |
| Router    | `src/router/`    | Route definitions, guards, path constants | Inline string paths scattered across the codebase |
| Types     | `src/types/`     | Shared DTOs / API shapes | Component-local prop types |
| Lib       | `src/lib/`       | Pure utility functions | React imports |

## Layer Dependency Direction (hard rule)

Imports may only point **downward** through the layer stack. A file may import from its own layer or
any layer below it, **never** from a layer above it.

```
pages  ->  templates  ->  organisms  ->  molecules  ->  atoms
  |            |             |            |
  +- features/<domain> (hooks, context, domain components)
         |
         +- services  ->  types / lib
```

- **Atoms / molecules / organisms / templates MUST NOT import from `pages/`.** A reusable lower
  layer reaching up into a route-level screen is an inverted dependency. The data/hook it needs
  belongs in `features/<domain>/hooks/` (or `hooks/`), and the page wires it in.
- **Do not type a prop as `ReturnType<typeof someHook>`** when the hook lives in a higher layer.
  That silently couples a reusable component to a page. Define an explicit `<Component>Props` shape
  (or a shared type in `types/`) and pass only the data and handlers the component actually needs.
- Shared logic two layers need lives in the **lowest** layer that satisfies both (move it down:
  page -> feature/hook -> service/lib), never up.

Review check: open the import block of any atom/molecule/organism/template. If you see `pages/...`,
it is a violation - relocate the imported thing downward.

## Sub-folder Categorisation (mandatory once a layer exceeds ~8 files)

A flat folder with dozens of components destroys discoverability. As soon as any atomic layer
crosses roughly eight files, group its files into purpose-named sub-folders. The sub-folder name
describes the **kind of UI building block**, not the domain - domain grouping is reserved for
`features/` and `pages/`. **Exception:** `organisms/` may group by domain, because organisms are
page-section sized and cluster by feature area.

Default vocabulary. Use these names; add new ones only when a category genuinely does not fit, and
keep them stable once introduced.

- **`atoms/`** - by primitive kind: `buttons/`, `inputs/`, `media/`, `badges/`, `feedback/`
  (spinner, skeleton, progress, toast), `typography/`, `layout/` (stack, divider, card).
- **`molecules/`** - by composition kind: `forms/` (label + input + error), `cards/` (single-entity
  card), `lists/` (row-shaped list items), `headers/`, `branding/`, `status/` (empty, error, loading
  message), `dialogs/`, `menus/`, `media/`, `buttons/` (button + trigger behaviour).
- **`organisms/`** - by domain: `navigation/`, `dialogs/`, `auth/`, one folder per real feature
  domain, `decorative/`.
- **`templates/`** - flat; there are only ever a handful of layout shells.
- **`pages/`** - already grouped by feature per the page rules below.

Rules:

1. **Stable names.** No `widgets/`, `controls/`, `shared/`, `misc/`, `common/` or other catch-alls.
2. **No domain names under `atoms/` or `molecules/`.** A `ProjectCard` molecule lives in
   `molecules/cards/`, not `molecules/projects/`. Domain-specific complex pieces belong in
   `organisms/<feature>/` or `features/<domain>/`.
3. **One sub-folder per file.** If two fit equally well, pick the one describing its UI role, not
   its data shape.
4. **No re-export barrels at sub-folder level** unless the project already uses barrels everywhere.
   Direct paths are clearer for jump-to-definition.
5. **Empty categories are fine.** Do not delete a documented category because no file lives there
   yet.

## Layer Decision Flow

Pick the right folder **before** creating a file:

1. Primitive UI unit, no business logic -> **atoms/**.
2. Composes 2+ atoms into a meaningful piece -> **molecules/**.
3. Complex reusable section that takes data via props -> **organisms/**.
4. Page-level layout shell with slots -> **templates/** (justify any new one).
5. Route-level screen -> **pages/<feature>/** (template + slot content only; never directly under
   `pages/`).
6. Domain-specific code -> **features/<domain>/**.
7. Pure util -> **lib/** - Shared hook -> **hooks/** - Shared type -> **types/**.

## Procedure: Create a New Component

1. **Search first.** Look in atoms/molecules/organisms for similar components. If one exists, pause
   and ask the user:
   > **Similar component found: `<Name>`** - `<what it does>`. **Use as-is / Extend / Create new
   > (justify)?**
2. **Pick the layer** using the Decision Flow.
3. **File layout.** Simple: `atoms/buttons/Button.tsx`. With stories/types:
   `molecules/forms/FormField/FormField.tsx` + `FormField.stories.tsx` (+ `FormField.types.ts` if
   non-trivial).
4. **Naming.** PascalCase component and file. Props interface named `<Component>Props`; do not
   export it unless it is consumed elsewhere.
5. **One component per file; filename = component name.** A file named `Foo.tsx` exports a component
   `Foo`. Do not park several unrelated components in a mis-named file. Split them into their own
   files (each in the correct layer) or, if they are genuinely one cohesive unit, name the file after
   the exported component. Small private subcomponents used only inside the file are fine.
6. **Exports.** Named exports only - no default exports.
7. **Story.** Co-locate a `.stories.tsx`. Cover default + meaningful variants + empty/loading/error
   where applicable. CSF3 with `satisfies Meta<typeof Component>`.

## Procedure: Build a Page

1. Create `pages/<feature>/<Name>Page.tsx`. **Pages live in a feature subfolder** (lowercase domain
   name: `auth`, `profile`, `home`). Reuse an existing feature folder before creating a new one.
2. Co-locate the page's test file (`<Name>Page.test.tsx`) in the same feature subfolder.
3. Choose an existing template. **No structural `div`s in the page.**
4. Fetch data via feature hooks (`features/<domain>/hooks/`) that wrap services (`services/`).
5. Pass data + organisms into template slots.
6. Register the route in `router/` using a path constant; lazy-load unless it is the home route.
7. Handle loading and error states explicitly - no silent failures.

**Pages compose only. Hard limit: 150 lines.** Interactive state lives in organisms or hooks, not in
pages. A page over the limit is a page doing an organism's job.

## Procedure: Add Data Fetching

1. Define the query/mutation in `services/<domain>.ts` using the project's server-state library.
2. Add request/response types in `types/`.
3. If local composition is needed, expose it via a hook in `features/<domain>/hooks/`.
4. Components consume only via the hook - never `fetch`/`axios` directly.

## Procedure: Render a Foreign Reference (user, account, owner, comment author)

Many features render information *about another principal* - the author of a comment, a list's
owner, a friend tag. These views always exist from at least two perspectives (the actor, and one or
more observers), and the data the frontend has on hand differs per perspective. This is the single
biggest source of "looks fine on my account, broken on yours" bugs.

1. **One central resolver per foreign-reference type.** Put it under `lib/` (e.g.
   `lib/userDisplay.ts`) and export a single function such as `resolveUserName(id, context)`. Every
   component that renders a name for a user id goes through it. Components must not poke into a
   lookup map (`friendsById[id]`) - that guarantees inconsistent fallbacks across screens.
2. **The resolver's context is explicit.** It accepts `currentUserId`, the friends list and any
   cached profile maps as arguments, not read from a global. Components compose the context once
   near the data boundary.
3. **The viewer is part of the resolver, not a special case in JSX.** `id === currentUserId` always
   resolves to a fixed sentinel ("You", or the host translation). Components never branch on
   `id === currentUserId` to render a name.
4. **No silent string-literal fallbacks.** `?? "Unknown"`, `?? "N/A"`, `?? "-"` in user-facing JSX
   are forbidden. The resolver returns either a real name or a degraded-but-distinguishable value
   (the first eight characters of the id, a muted "Anonymous" with the id in a tooltip). In
   development it should `console.warn` when it degrades, so missing wiring surfaces while
   dogfooding instead of shipping as "Unknown".
5. **Test every perspective.** Where a feature has actors and observers, test the matrix (actor =
   me / someone else x observer = me / someone else x observer present / absent). A suite that only
   covers `actor === viewer` is incomplete by definition.
6. **Push display data to the source when the resolver cannot see the truth.** If the frontend
   routinely needs names for ids it cannot have in scope, extend the backend DTO to ship
   `displayName` alongside the id - do not invent a global "all users" lookup on the client.

The same applies to any other foreign reference: entity ids in an activity feed, role tokens in
admin views. Wherever the UI renders a label for an id, there is exactly one resolver and zero
silent fallbacks.

## Procedure: Translatable Strings

**Externalize user-facing strings through the project's existing i18n library. Do not introduce one
where none exists** - a scaffold without i18n stays without i18n until someone decides otherwise,
and that decision is not this skill's to make.

With an i18n library in place:

1. **Co-locate the message definitions** next to the component / page - one message unit per view
   unit, in its own file (`messages.ts`), containing only definitions and no JSX, hooks or logic.
2. The component imports the messages and formats them. **Do not define messages inside a `.tsx`**
   view file.
3. Message keys/IDs follow `<view-kebab>.<key-kebab>` so an extracted catalog stays grouped by view.
4. Truly shared strings (two or more unrelated views) go to a project-level shared messages module,
   not duplicated per view.
5. After adding or changing messages, run the project's extraction script and never hand-edit
   generated catalog files.

The concrete API is the project's: `defineMessages`/`FormattedMessage` for react-intl,
`t()`/resource JSON for i18next. Follow whichever the repo already uses.

Red flags: message definitions inside a `.tsx` file; hardcoded user-facing text in JSX in a project
that *has* i18n; message IDs that do not share a prefix with their sibling messages.

## Procedure: Add a UI-Kit Component (shadcn/ui, MUI)

1. Generate/install per the kit's instructions; place the resulting file in `atoms/` (move it there
   if the tool put it elsewhere).
2. If project defaults are needed (fixed variant/size/theme), wrap it in an atom that applies them.
3. Export from the atom. **All other layers import the atom, never the kit's path directly.**

## Mandatory primitives

These cover the duplicate clusters that appear in every UI codebase. Create them early; do not let
inline equivalents accumulate.

| Primitive | Layer | Purpose |
| --- | --- | --- |
| `Button` | atom | Single source of truth for every clickable rectangle. Supports `as="a"` / `as={Link}` so a styled `<Link>` is never necessary. |
| `Card` | atom | Reusable bordered surface with `padding` / `tone` / `interactive` variants. Forbids ad-hoc card markup. |
| `Avatar` | atom | One avatar renderer with fallback. No inline `<img>` for user avatars anywhere else. |
| `TextInput` / `TextArea` | atom | The only text input primitives. Raw `<input>` / `<textarea>` only inside these files. |
| `BrandLockup` | molecule | The ONLY place that renders the brand mark, parameterised by `size` / `tone` / `showText`. Used by every header, hero and splash. |
| `AvatarWithText` | molecule | Avatar + title + optional subtitle + optional trailing actions. Replaces every "flex items-center gap" + avatar + name block. |
| `SectionHeader` | molecule | Accent bar + heading + optional description + actions slot. |
| `PageHeader` | molecule | Page-level title + description + optional actions. |
| `PageStatusMessage` | molecule | Centered empty/loading/error message. Replaces every ad-hoc status `div`. |

## Proactive Duplicate Scan (mandatory before finishing an edit)

Before finishing changes to a page or organism, scan the surrounding JSX for structurally identical
blocks that differ only in props / variant / icon / colour / handler. If found: extract into a shared
component first, then continue with the original change.

Red flags:

- Two `<button>` / `<div>` blocks with the same className skeleton, swapping only icon/label/handler.
- Repeated layout `div`s with no domain logic.
- A diff showing the same markup copy-pasted with minor tweaks.
- Inline brand-mark markup recreated in a header or hero - extend the one `BrandLockup` instead.
- Inline card panel markup (`rounded border bg-surface` containers) - use the `Card` atom.
- Inline "avatar + title + subtitle" rows - use `AvatarWithText`.
- Inline `<input>` / `<textarea>` instead of the project's input atoms.
- A `<Link>` styled to look like a button - extend `Button` with an `as`/`href` capability.
- A section header recreated more than once - extract `SectionHeader`.

## Forbidden Patterns (hard rules)

- Layout markup in page components.
- **Structural-only `div`s in pages, templates and organisms.** Every `div`/`section` they render
  must carry domain meaning (a slot boundary, a list root, a form element). Pure `flex`/`grid`/
  spacing wrappers belong in an atom (`Card`, `Stack`) or molecule. A `div` chain with no domain
  handler or role gets extracted or replaced.
- Business logic in atoms or molecules.
- **Upward layer imports** - an atom/molecule/organism/template importing from `pages/`.
- **`ReturnType<typeof pageHook>` as a prop type** - pass an explicit props shape instead.
- **Mis-named multi-component files** - the filename must match the single exported component.
- Direct UI-kit imports outside the atoms layer.
- `fetch` / `axios` calls inside components.
- New page layouts that bypass the template system.
- Page files directly under `pages/` instead of `pages/<feature>/`.
- Pages over 150 lines, or holding interactive state.
- Inline styles (`style={{}}`) - use the project's CSS approach.
- Inline SVG icons - use the project's icon library.
- Message definitions inlined in a view (`.tsx`) file.
- Hardcoded user-facing strings in a project that has an i18n library.
- Silent string-literal fallbacks for missing foreign references (`?? "Unknown"`).
- Direct lookup-map access for foreign-reference display inside a component.
- `any` type or unexplained `@ts-ignore`.
- Default exports.
- Two JSX blocks with identical structure differing only in props/data/colour.

## Naming Cheat Sheet

| Thing | Convention | Example |
| --- | --- | --- |
| Component and file | PascalCase | `DataTable.tsx` |
| Hook | `use` + camelCase | `useMemberList` |
| Service / queries file | camelCase | `memberService.ts` |
| Context | PascalCase + `Context` | `AuthContext` |
| Types / interfaces | PascalCase | `MemberDto`, `CreateMemberInput` |
| Props interface | `<Component>Props` | `FormFieldProps` |
| Global constants | UPPER_SNAKE_CASE | `API_BASE_URL` |

## Completion Checklist

- [ ] Component sits in the correct atomic layer and sub-folder.
- [ ] Page lives in `pages/<feature>/`, is under 150 lines, and holds no interactive state.
- [ ] No duplicate JSX structures left behind (proactive scan done).
- [ ] Mandatory primitives used instead of inline equivalents.
- [ ] No structural-only `div`s in pages, templates or organisms.
- [ ] No forbidden patterns introduced.
- [ ] Storybook story exists for new atoms/molecules/organisms/templates.
- [ ] Icons come from the project's icon library; sizing via class names, not `width`/`height` props.
- [ ] Server state goes through the project's data layer (`services/` + hooks).
- [ ] Loading and error states handled.
- [ ] Foreign-reference labels go through the central resolver, with no silent fallbacks.
- [ ] Translatable strings externalized through the project's i18n library, if it has one; extraction
      script run if messages changed.
- [ ] Named exports only; no `any`.
- [ ] Project-specific rules in the repo's `CLAUDE.md` / `AGENTS.md` respected - they override this
      skill.
