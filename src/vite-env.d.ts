/**
 * Ambient module declarations for non-code assets.
 *
 * The popup entry (src/popup/main.tsx) imports stylesheets for their side
 * effects (`import './styles/tokens.css'`). Under this project's strict
 * `tsc --noEmit` — which pins `types` to chrome/react and omits `vite/client` —
 * those imports have no declared module shape and would fail typechecking.
 * Declaring them here keeps the type surface self-contained (no dependency on
 * Vite's ambient types resolving) while the bundler handles the real asset.
 */

declare module '*.css';
declare module '*.svg' {
  const src: string;
  export default src;
}
declare module '*.png' {
  const src: string;
  export default src;
}
