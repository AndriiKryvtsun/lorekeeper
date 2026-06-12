# app-shell

## Purpose

Defines the responsive, accessible application shell that wraps all authenticated pages —
header, primary navigation, and content region — together with semantic landmarks, a
skip-to-content link, a global error boundary, and a not-found page.

## Requirements

### Requirement: Responsive authenticated app shell
The system SHALL provide a responsive app shell — header, primary navigation, and a
content region — used by all authenticated pages. The layout SHALL adapt across small and
large viewports without loss of function.

#### Scenario: Shell wraps authenticated pages
- **WHEN** an authenticated page renders
- **THEN** it is composed within the shell's header, primary nav, and content region

#### Scenario: Shell is responsive
- **WHEN** the viewport is narrow
- **THEN** the shell adapts (e.g. collapsible/compact nav) while keeping navigation reachable

### Requirement: Semantic landmarks and skip-to-content
The shell SHALL use semantic landmarks (`header`/`banner`, `nav`, `main`) and SHALL
provide a skip-to-content link that moves focus to the main content region.

#### Scenario: Landmarks are present
- **WHEN** the shell renders
- **THEN** it exposes banner/header, navigation, and main landmarks

#### Scenario: Skip link jumps to main content
- **WHEN** a keyboard user activates the skip-to-content link
- **THEN** focus moves to the main content region

### Requirement: Global error boundary
The system SHALL provide a global error boundary that catches render errors in the app
tree and presents a recoverable error UI (using `ErrorState`) instead of a blank or
broken page.

#### Scenario: Render error is caught
- **WHEN** a descendant component throws during render
- **THEN** the error boundary renders the error UI and offers a way to recover (e.g. retry)

### Requirement: Not-found page
The system SHALL provide a not-found page for unmatched routes, rendered within the design
system.

#### Scenario: Unknown route shows the not-found page
- **WHEN** a user navigates to a route that does not exist
- **THEN** the not-found page is shown using the shared UI
