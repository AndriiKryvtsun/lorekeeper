# design-system

## Purpose

Defines the shared visual foundation for the app: centralized design tokens, light/dark
theming, and a consistent set of accessible UI primitives with documented variants, so
features compose from shared, token-driven, accessible components rather than one-off
markup.

## Requirements

### Requirement: Centralized design tokens
The system SHALL define design tokens for color, spacing, radius, typography, and shadow
as CSS variables exposed to Tailwind through the theme, so components reference tokens
rather than hard-coded values.

#### Scenario: Components consume tokens, not literals
- **WHEN** a primitive renders
- **THEN** its color, radius, spacing, and shadow derive from the design tokens (CSS variables / Tailwind theme), not hard-coded literals

### Requirement: Light and dark theming
The system SHALL support light and dark themes via CSS variables. The theme SHALL follow
`prefers-color-scheme` by default and SHALL also be switchable explicitly (e.g. a `.dark`
class) without changing component markup.

#### Scenario: System preference selects the theme
- **WHEN** the OS is set to dark mode and no explicit override is applied
- **THEN** the app renders with the dark token values

#### Scenario: Explicit toggle overrides via tokens
- **WHEN** the explicit dark class/attribute is applied to the document
- **THEN** token values switch to dark and components restyle without markup changes

### Requirement: Consistent primitive set with documented variants
The system SHALL provide a consistent set of shadcn/ui primitives — Button, Input,
Textarea, Select, Dialog, Card, Toast, Skeleton — plus `EmptyState` and `ErrorState`
components. Each SHALL expose a small, documented set of variants so usage stays uniform
across the app.

#### Scenario: Primitives are available with documented variants
- **WHEN** a feature needs a UI element from the set
- **THEN** it imports the shared primitive and selects a documented variant rather than building a one-off

#### Scenario: EmptyState and ErrorState are reusable
- **WHEN** a view has no data or hits a recoverable error
- **THEN** it renders the shared `EmptyState` or `ErrorState` component

### Requirement: Accessible primitive markup
Primitives SHALL render accessible markup: interactive elements are keyboard-operable and
expose correct roles/names; form controls (Input, Textarea, Select) are associated with a
label and, when invalid, with error text via `aria-describedby`.

#### Scenario: Form control is labelled and links its error
- **WHEN** a labelled form control renders in an invalid state with error text
- **THEN** the control is associated with its label and references the error via `aria-describedby` / `aria-invalid`

#### Scenario: Dialog exposes an accessible name and role
- **WHEN** a Dialog opens
- **THEN** it has a dialog role and an accessible name and moves focus into the dialog

### Requirement: Visible focus and keyboard navigation
The system SHALL provide visible `focus-visible` styles on all interactive elements and
SHALL support full keyboard navigation (tab order, activation, and dialog focus
trapping/restoration).

#### Scenario: Keyboard focus is visible
- **WHEN** a user moves focus to an interactive element with the keyboard
- **THEN** a visible focus indicator is shown

### Requirement: aria-live toasts
Toast notifications SHALL be announced to assistive technology via an `aria-live` region.

#### Scenario: Toast is announced
- **WHEN** a toast is shown
- **THEN** it is rendered in an `aria-live` region so screen readers announce it

### Requirement: Reduced motion handling
The system SHALL honor `prefers-reduced-motion` by removing or minimizing non-essential
animation and transition when the user requests reduced motion.

#### Scenario: Reduced motion disables non-essential animation
- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** non-essential animations/transitions are removed or minimized

### Requirement: Token-driven visual identity
The system SHALL express a cohesive dark-fantasy/arcane visual identity ENTIRELY through
the centralized design tokens — extending the token layer with a refined type scale,
spacing rhythm, elevation/shadow scale, radius scale, and accent colors and gradients.
Features SHALL consume these tokens; one-off styles outside the token layer SHALL NOT be
introduced.

#### Scenario: Identity is applied via tokens, not one-off styles
- **WHEN** the refined aesthetic is applied to a screen
- **THEN** its typography, spacing, elevation, radius, accent colors, and gradients derive from design tokens (CSS variables / Tailwind theme), and no component introduces a one-off style outside the token layer

#### Scenario: Accent and gradient tokens are available
- **WHEN** a component needs an accent color or gradient
- **THEN** it references an accent/gradient token rather than a hard-coded value

### Requirement: First-class dark theme with accessible contrast
The system SHALL treat dark mode as a first-class, tuned theme (not merely inverted
light values). Text and essential UI SHALL meet WCAG AA contrast on the new palette in
both themes, including text rendered over gradients or imagery. Meaning SHALL NEVER be
conveyed by color alone.

#### Scenario: Dark theme meets AA contrast
- **WHEN** the dark theme renders text and essential controls, including text over a gradient or image
- **THEN** the contrast ratios meet WCAG AA

#### Scenario: Color is not the sole signal
- **WHEN** a state or meaning is communicated in the UI
- **THEN** it is conveyed by more than color alone (e.g. icon, text, or shape in addition to color)

### Requirement: Subtle motion layer
The system SHALL provide a subtle, fast motion layer for page/section transitions,
list-item entrance, dialog/widget open, and hover/press micro-interactions, using at
most one small animation dependency or CSS. Animations SHALL use transform and opacity
only (no layout shift) and SHALL keep durations short. Every animation SHALL have a
reduced or none variant that takes effect under `prefers-reduced-motion: reduce`.

#### Scenario: Animations use cheap, non-shifting properties
- **WHEN** any motion-layer animation runs
- **THEN** it animates only transform and/or opacity and causes no layout shift

#### Scenario: Reduced motion disables the motion layer
- **WHEN** the user has `prefers-reduced-motion: reduce` set
- **THEN** every motion-layer animation falls back to its reduced/none variant

#### Scenario: At most one animation dependency
- **WHEN** the motion layer is implemented
- **THEN** it adds at most one small animation dependency (or uses CSS), avoiding a Core Web Vitals regression

### Requirement: Elevated empty and loading states
The shared `EmptyState` component SHALL present light iconography or illustration, and
skeleton/loading states SHALL be refined and consistent. Decorative visuals SHALL be
marked `aria-hidden`.

#### Scenario: Empty state shows supportive iconography
- **WHEN** a view renders the shared `EmptyState`
- **THEN** it shows light iconography/illustration with accessible text, and any purely decorative visual is `aria-hidden`

#### Scenario: Skeletons are consistent
- **WHEN** content is loading
- **THEN** a refined, consistent skeleton placeholder is shown using the shared primitive

### Requirement: Consistent interactive states and iconography
Interactive primitives SHALL expose consistent hover, active, and `focus-visible`
styling driven by tokens, and SHALL use lucide iconography for icons. Visible
`focus-visible` rings SHALL be preserved.

#### Scenario: Interactive elements have consistent states
- **WHEN** a user hovers, presses, or keyboard-focuses an interactive primitive
- **THEN** consistent token-driven hover/active styling is shown and a visible `focus-visible` ring appears on keyboard focus

#### Scenario: Icons come from the shared icon set
- **WHEN** a primitive renders an icon
- **THEN** it uses lucide iconography rather than an ad-hoc icon
