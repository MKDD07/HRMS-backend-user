# Project Instructions

These rules apply throughout this repository. Follow them whenever making UI changes.

# UI Consistency Guidelines

## Reuse the existing design system

- Use `workspace-grid` as the standard page grid: 12 equal tracks, one column below 901px. Define it only in `src/styles/components.scss`; page styles may set column spans and `--workspace-grid-gap`.
- Use `MetricOverview` with `MetricCard` for every summary section. Pass `label`, `icon`, `value`, and `caption`; use `onClick` for real actions. Do not write custom metric-card markup or page-specific appearance overrides.
- Reuse `EmployeeDirectory` for employee lists and selection panels. It owns its `card` surface, shared header, search, rows, selection, loading, and pagination. Page styles should control placement and height, not add another sidebar skin.
- Use the shared `card` class and `TenantPanel` component for cards.
- Use the existing `card-head` structure for card headings.
- Use established card color classes such as `card--amber` and `card--purple`.
- Reuse existing row, action, spacing, typography, and icon patterns before creating new ones.
- When a reference points to another section of this app, use its existing components and classes.

## Avoid duplicate styling

- Inspect the shared components and styles before editing a section.
- Do not create page-specific replacements for existing shared designs.
- Do not stack CSS overrides to fix earlier overrides. Correct or remove the conflicting rule.
- Keep page-specific CSS focused on layout that the shared system does not provide.
- Use existing design tokens for colors, spacing, borders, and radii.
- Keep changes scoped to the requested section unless an app-wide change is requested.

## Interaction behavior

- Keep resource rows flat, with no background change, shadow, movement, or animation on hover.
- Preserve visible keyboard focus, accessible names, and disabled states.
- Use the same shared circular arrow action for View all buttons across the app.
- Do not apply pill-button styling to content rows or action tiles.

## Before finishing

- Remove redundant rules introduced by the change.
- Check that the result matches the referenced component and remains usable on small screens.
- Run the relevant build or syntax checks.
- State clearly whether the result was visually verified or only checked through code.

