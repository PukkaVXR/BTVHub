# Hub UI Components

Shared components for the BTV Hub UI overhaul live here. New hub screens should prefer these primitives over raw `.btn`, `.card`, and one-off status markup.

Keep these components small and accessible. Page-specific layout should stay in the page or a feature component, not inside the primitive.

## Current Primitives

- `Button` / `ButtonLink` / `ButtonAnchor`: primary, secondary, danger, and ghost actions.
- `Card` / `CardSection` / `CardHeader`: framed content and repeated panels.
- `PageHeader`: consistent route title, description, and primary action placement.
- `StatusPill`, `Callout`, `EmptyState`, `Skeleton`, `PageLoading`, and `ErrorBoundary`: common state surfaces.
- `FormField` and `CopyField`: labelled controls and copyable values.

During migration, legacy classes remain available for older screens. New pages and touched UI should move toward these primitives first, then retire the older global helpers as each route is cleaned up.
