/**
 * Side-effect-only module: importing it brings in the mirrored launcher
 * stylesheet graph and the font packages the mirror's slide renderers need.
 *
 * `index.css` is the single entry point for the mirrored style graph — it
 * `@import`s `surfaces.css`, `controls-grid.css`, `config-syntax.css`,
 * `home-hero.css` and `dashboard.css` itself, so importing it here pulls in
 * every mirrored sheet in one go. This module is deliberately never imported
 * by the studio shell (`App.tsx`/`main.tsx`); only a standalone mirror render
 * root is meant to import it, so the launcher's `@layer base` resets and
 * design tokens never reach the studio's own chrome.
 *
 * The three Fontsource packages mirror the launcher's own `main.tsx`, which
 * imports all three regardless of which family a given mirrored sheet reads.
 * See `studio/README.md`'s "Third-party" section for their licence.
 */
import '../launcher-core/src/renderer/src/styles/index.css'
import '@fontsource-variable/inter'
import '@fontsource-variable/oswald'
import '@fontsource-variable/jetbrains-mono'
