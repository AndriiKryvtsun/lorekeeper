## ADDED Requirements

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
