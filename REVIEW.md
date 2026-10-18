# Code Review Guidelines

## Always check

- **Security**: credentials and tokens must not appear in console logs or error messages.
- **Components**: Mantine components should be preferred over HTML elements. Use `<Box>` instead of `<div>`.
- **Icons and components**: icons come from `~/icons` (one name per concept, drawn by `~/components/Icon`), pictograms from `~/pictograms`, code display from `~/components/CodeBlock`. Nothing imports an icon library directly. The inherited UI kit remains only for the theme and font links until sprint 009 Slice C2 replaces them; do not add imports from it — `pnpm check:identity` allows the inherited vendor's name only as a declared dependency's identifier. Usage of the "dimmed" color should be avoided in favor of "slate" or "obsidian" colors.
- **Light theme**: hardcoded "slate" or "obsidian" colors that aren't neutral (shade 5) should define distinct light and dark variants using `const isLight = useIsLight()` and for example `isLight ? "obsidian.2" : "obsidian.7"`.
- **Release Changelogs**: version bumps on release branches should be accompanied by a changelog entry in the `src/assets/changelogs` directory. The changelog should feature a title, date, and a list of changes.
- **Dependency changes**: new external packages require justification. Prefer replacing small utility packages with helper functions in the codebase.

## Skip

- Formatting and linting errors (enforced by `bun run qau`)