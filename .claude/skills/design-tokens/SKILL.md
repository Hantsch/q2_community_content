---
name: design-tokens
description: "Method for a semantic design-token layer in a React/Tailwind app and the mobile accessibility floor that goes with it. Use when: picking colours for a component; writing a class list that would contain a hex value or a raw palette class (slate-500, gray-200); adding or changing dark mode; setting up or extending the token vocabulary in tailwind.config or the CSS variable block; adding a theme; choosing spacing, radius, elevation or transitions; building anything touch-operated; reviewing UI code for hardcoded colours, missing focus states, too-small touch targets or colour-only status. DO NOT USE FOR: choosing a brand palette from scratch; backend code; non-Tailwind styling systems."
---

<!-- tech-rules:managed 2.0.0 -->

# Design Tokens and the Accessibility Floor

A method, not a fixed palette. It defines *which roles exist* and *how they are wired*, so that a
project can pick its own colours and still get one-line theming, working opacity modifiers and a
consistent vocabulary. Where a repository already has a token layer, adopt its names and extend it;
do not introduce a second one alongside.

## The wiring

Two files carry the whole system.

**1. Bare `r g b` triplets as CSS custom properties**, one block per theme:

```css
@layer base {
  :root {
    color-scheme: light;

    /* Page + surfaces */
    --color-bg: 248 250 252;
    --color-surface: 255 255 255;
    --color-surface-muted: 248 250 252;
    --color-surface-strong: 226 232 240;
    --color-surface-inverse: 15 23 42;

    /* Text */
    --color-text: 15 23 42;
    --color-text-muted: 51 65 85;
    --color-text-subtle: 100 116 139;
    --color-text-faint: 148 163 184;
    --color-text-inverse: 255 255 255;

    /* Borders / rings */
    --color-border: 203 213 225;
    --color-border-strong: 148 163 184;

    /* Brand accent */
    --color-accent: 79 70 229;
    --color-accent-hover: 67 56 202;
    --color-accent-soft: 238 242 255;
    --color-accent-soft-border: 199 210 254;
    --color-accent-text: 79 70 229;
    --color-accent-text-strong: 55 48 163;
    --color-accent-on: 255 255 255;   /* text/icon colour on top of bg-accent */

    /* Status - each is a triad: solid, soft fill, border */
    --color-danger: 220 38 38;
    --color-danger-soft: 254 226 226;
    --color-danger-border: 254 202 202;
    --color-success: 5 150 105;
    --color-success-soft: 209 250 229;
    --color-success-border: 167 243 208;
    --color-warning: 217 119 6;
    --color-warning-soft: 254 243 199;
    --color-warning-border: 253 230 138;
  }

  .dark {
    color-scheme: dark;
    /* same names, values re-picked for similar perceptual contrast on a dark surface */
  }
}
```

**2. A `token()` helper registering them as Tailwind colours:**

```js
const token = (name) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        bg: token('--color-bg'),
        surface: token('--color-surface'),
        'surface-muted': token('--color-surface-muted'),
        text: token('--color-text'),
        'text-muted': token('--color-text-muted'),
        border: token('--color-border'),
        accent: token('--color-accent'),
        'accent-on': token('--color-accent-on'),
        danger: token('--color-danger'),
        // ... one entry per custom property
      },
    },
  },
};
```

Why bare triplets and not `#rrggbb`: the `rgb(var(--x) / <alpha-value>)` form keeps Tailwind's
opacity modifiers working, so `bg-surface/60` and `text-text/80` still compile. A hex value in the
custom property breaks that silently.

Why `darkMode: 'class'`: theme is the `dark` class on `<html>`, not a component prop. Dark mode then
costs one CSS variable block instead of a `dark:` variant on every element. Adding a theme
(high-contrast, a per-tenant palette) means copying a block and overriding the tokens you want -
zero component edits.

## The role vocabulary

Use the role, not the colour. The point of the layer is that a component never knows what colour it
is.

| Role | Classes |
| --- | --- |
| Page background | `bg-bg` |
| Card / panel | `bg-surface` |
| Hover / pressed tiers | `bg-surface-muted`, `bg-surface-strong` |
| Inverted surface | `bg-surface-inverse` + `text-text-inverse` |
| Primary text | `text-text` |
| Secondary text | `text-text-muted`, `text-text-subtle`, `text-text-faint` |
| Border / ring | `border-border`, `border-border-strong` |
| Accent fill (CTA) | `bg-accent` + `text-accent-on` |
| Accent text / tint | `text-accent-text`, `bg-accent-soft` + `border-accent-soft-border` |
| Danger | `bg-danger`, `bg-danger-soft`, `text-danger`, `ring-danger-border` |
| Success | `bg-success-soft`, `text-success`, `ring-success-border` |
| Warning | `bg-warning-soft`, `text-warning`, `ring-warning-border` |

**A raw palette class in application code is a bug, not a style choice.** `bg-slate-100`,
`text-gray-500`, `border-zinc-200`, `#1f2937`, `rgb(31 41 55)` - each one is a value that will not
flip with the theme and will drift from its neighbours. Raw palette values appear in exactly one
place: the custom-property block above. If no role fits what you are building, add a role; do not
reach past the layer.

**One accent per screen.** The accent marks the single most important action in view. A second accent
does not add emphasis, it removes it - everything else on that screen uses surface, text and border
roles. Status colours are not accents: they report state and are driven by data, not by importance.

## Radius, elevation, spacing, motion

- **Radius:** `rounded-full` for pills and avatars, `rounded-md` for buttons, inputs and most cards,
  `rounded-lg`/`rounded-xl` for large panels. Three tiers, not seven.
- **Elevation:** `shadow-sm` is the default resting elevation. `shadow-lg`/`shadow-xl` are for
  floating things only (menus, dialogs). An interactive card changes its surface tier on hover; it
  does not scale or transform.
- **Spacing:** stay on the 4px scale. `1-2` for icon padding and tight inline gaps, `3-4` for control
  padding and gaps between related fields, `5-6` for card and panel padding, `8+` for section and
  page whitespace. No arbitrary values (`p-[13px]`) - pick the nearest step.
- **Motion:** the default is a plain `transition`/`transition-colors` of roughly 150ms for hover and
  pressed states. No bounce, no spring overshoot, no parallax. Motion indicates a state change; it is
  never decorative.
- **Typography:** one font stack, defined once. Body text and heading sizes come from a small set of
  steps, not per-component decisions.

## The accessibility floor

Not aspirational - this is the definition of done for any touch-operated UI.

- **Touch targets: minimum 44x44px** for every interactive element - button, link, nav item, icon
  button, select, toggle (`min-height: 44px; min-width: 44px`). 44 flat, no per-component exception:
  a smaller target is a miss on a phone, and "it looks fine on my desktop" is not evidence.
- **No iOS auto-zoom:** every `<select>`, `<input>` and `<textarea>` renders at 16px or larger
  (`font-size: max(var(--fs-base), 16px)`). Below that, Safari zooms the page on focus and the layout
  jumps.
- **Safe-area insets:** apply `env(safe-area-inset-*)` through `max()` to every fixed or sticky
  element that can touch a screen edge - top bars, bottom navigation, modals, overlays. Bottom
  navigation height must account for `env(safe-area-inset-bottom)` so the home indicator does not sit
  on top of it.
- **Visible focus, keyboard only:** every interactive element has a visible `:focus-visible` ring.
  Never style `:focus` alone for the visible state - that puts a ring on mouse and touch
  interactions too, which reads as a rendering bug and trains people to ignore it.
- **Reduced motion:** ship a `@media (prefers-reduced-motion: reduce)` block that sets transitions
  and animations to `none`, and never rely on motion alone to convey a state change.
- **Never colour alone.** Error, success, warning and selected states pair the colour with an icon,
  text or both. This is what the soft/border/solid triads exist for: the fill carries the tone, the
  icon and text carry the meaning.
- **Accessible names:** every interactive element has one, from visible text or `aria-label`.
  Icon-only controls always carry `aria-label`; a decorative icon next to a visible label is
  `aria-hidden`.
- **Form errors** surface as visible helper text tied to the field, announced via `role="alert"` or
  `aria-live="polite"` where the error can appear without a navigation.
- **Overlays** render above everything, dismiss on backdrop click and `Escape`, and trap focus while
  open.
- **Check the viewport range**, not one width: 375, 768, 1024 and 1440 as the minimum set.

## Review checklist

- [ ] No hex values, `rgb()` literals or raw palette classes outside the custom-property block
- [ ] Every colour used through a role class, and the role fits what it marks
- [ ] One accent per screen; status colours not used as accents
- [ ] `text-accent-on` (not a hardcoded white) on top of `bg-accent`
- [ ] Dark theme covers every token the light theme defines - no missing name
- [ ] Radius, elevation and spacing on the documented tiers; no arbitrary values
- [ ] Interactive elements at least 44x44px
- [ ] Inputs and selects at 16px or larger
- [ ] Fixed/sticky edge elements respect safe-area insets
- [ ] `:focus-visible` ring on every interactive element; `:focus` not styled alone
- [ ] `prefers-reduced-motion` block present and honoured
- [ ] No state conveyed by colour alone
- [ ] Icon-only controls carry an accessible name
