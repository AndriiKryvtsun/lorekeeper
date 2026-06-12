## ADDED Requirements

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
