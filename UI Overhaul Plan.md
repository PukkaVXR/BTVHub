# BTV Hub — UI Overhaul Plan

A phased plan to redesign the hub for **readiness-first workflows**, a maintainable design system, and clearer information architecture. Target users are streamers preparing to go live under time pressure — clarity beats decoration.

**Related docs:** [README.md](README.md), [Roadmap Checklist.md](Roadmap Checklist.md), [Visual Alert Editor Plan.md](Visual Alert Editor Plan.md)

---

## North star

> **“Am I ready to stream, and what do I fix if not?”**

Every major screen should support one of:

| Pillar | User question |
|--------|----------------|
| **Readiness** | Are Twitch, OBS, and overlays connected and testable? |
| **Create** | Can I build or edit alerts, widgets, and overlay sources? |
| **Automate** | Are macros, rules, webhooks, and timers configured? |
| **Operate** | Can I panic-stop, switch layouts, and monitor live activity? |

---

## Current state (baseline)

Document these before changing UI so you can verify improvements:

- [ ] Flat sidebar with 11 equal-weight nav items (`App.tsx`)
- [ ] Minimal global status (Twitch + overlay URL only)
- [ ] `Dashboard.tsx` combines doctor, OBS tools, Stream Deck builder, sessions
- [ ] Single global `styles.css` (~2,100+ lines)
- [ ] No shared React component library under `src/ui/`
- [ ] Toast: single message, no queue or severity types
- [ ] Route confusion: `/alerts` = editor, `/alert-rules` separate, `/themes` not in nav
- [ ] `AlertEditorPage.tsx` ~3,100 lines, dense toolbar
- [ ] Inline styles mixed with utility classes on several pages

---

## Target information architecture

### Navigation groups

```
● Live
  └ Dashboard (readiness + quick actions)
  └ Activity
  └ Emergency (or global panic in top bar)

● Overlays
  └ Browser sources & URLs
  └ Widgets
  └ Themes (legacy — de-emphasized)

● Alerts
  └ Projects (list + editor)
  └ Test & routing (absorb /alert-rules)

● Automation
  └ Event rules
  └ Timers / scheduled automations
  └ Macros
  └ Webhooks
  └ Stream Deck tools (moved from Dashboard)

● Settings
  └ Integrations (Twitch, OBS, Spotify, Giphy)
  └ Setup wizard (first-run; link from Dashboard after)
```

### Route map (target)

| Path | Purpose |
|------|---------|
| `/` | Live Control (dashboard) |
| `/activity` | Live event feed |
| `/overlays` | OBS browser source URLs & packs |
| `/widgets` | Widget configuration |
| `/themes` | Legacy themes (secondary) |
| `/alerts` | Alert project list |
| `/alerts/:id` | Visual alert editor |
| `/alerts/routing` | Alert rules / routing (was `/alert-rules`) |
| `/automations` | Event automation rules |
| `/automations/scheduled` | Interval automations (if split) |
| `/macros` | Macros |
| `/webhooks` | Webhooks |
| `/stream-deck` | Stream Deck builder & docs |
| `/integrations` | OAuth & OBS WebSocket |
| `/setup` | First-run wizard |

- [ ] Document final route table in this file when locked
- [ ] Add redirects from old paths (`/alert-rules` → `/alerts/routing`, `/alert-editor` → `/alerts`)

---

## Design system specification

### Design tokens (`styles.css` or `tokens.css`)

- [ ] **Color — semantic**
  - [ ] `--color-bg-canvas`
  - [ ] `--color-bg-surface-1`, `-2`, `-3`
  - [ ] `--color-border-subtle`, `--color-border-strong`
  - [ ] `--color-text-primary`, `-secondary`, `-disabled`
  - [ ] `--color-status-success`, `-warning`, `-danger`, `-info`
  - [ ] `--color-focus-ring`
  - [ ] Keep `--accent` for chrome; use Twitch purple `#9147ff` only for Twitch-specific CTAs
- [ ] **Spacing scale:** 4, 8, 12, 16, 24, 32, 48 px
- [ ] **Radius:** sm (6), md (10), lg (14)
- [ ] **Typography roles:** display, title, body, caption, mono (map to font-size / weight / line-height)
- [ ] **Motion:** `--duration-fast` (120ms), `--ease-standard`; respect `prefers-reduced-motion`
- [ ] Migrate existing `:root` vars without breaking overlay pages (hub only)

### Core UI components (`apps/hub/src/ui/`)

| Component | Responsibility |
|-----------|----------------|
| `Button` | primary, secondary, danger, ghost, sm; disabled, loading |
| `Card`, `CardSection` | surface, header, footer slots |
| `PageHeader` | title, description, breadcrumbs slot, primary action |
| `StatusPill` / `StatusDot` | connected / offline / warning + icon + label |
| `Callout` | info, success, warning, danger (replace one-off bordered cards) |
| `EmptyState` | illustration/icon, title, description, CTA |
| `CopyField` | read-only URL/text + copy button + optional “open external” |
| `FormField` | label, control, hint, error (`aria-describedby`) |
| `SplitPane` | resizable or fixed ratio columns |
| `Tabs` | accessible tab list (consider Radix Tabs) |
| `Dialog` / `Drawer` | modals (consider Radix Dialog) |
| `Toast` | queue, success/error/info, `aria-live` |
| `Skeleton` | loading placeholders for cards and lists |
| `Breadcrumbs` | wayfinding in deep editors |

- [x] Create `src/ui/index.ts` barrel export
- [ ] Rule: new page code uses `src/ui` — no raw `.btn` in pages after migration phase

### Optional dependencies (decide in Phase 0)

- [ ] Evaluate **Radix UI** primitives (Dialog, Tabs, Tooltip, Switch) for a11y
- [ ] Evaluate **Lucide** (or similar) for nav/status icons
- [ ] Decide: CSS Modules per component vs. continued global CSS with BEM-like prefixes
- [ ] Decide against full MUI/Chakra unless team grows (document rationale)

---

## Phase 0 — Foundation & decisions (Week 1)

### Planning

- [ ] Review this document with stakeholders (even if solo — note decisions in changelog below)
- [ ] Screenshot current UI (Dashboard, Setup, Integrations, Alert editor, Automations) for before/after
- [ ] List breaking UX changes (nav moves, route renames) for release notes
- [x] Create tracking issue or branch: `codex/ui-overhaul-foundation`

### Technical setup

- [x] Add `apps/hub/src/ui/` directory
- [x] Add `apps/hub/src/context/AppHealthContext.tsx` (or similar) for shared health/preflight
- [x] Add route-level `ErrorBoundary` component
- [x] Add `PageLoading` skeleton variant (replace generic “Loading” card)
- [x] Document component API in short comments or `src/ui/README.md`

### Accessibility baseline audit

- [x] Verify focus visible on buttons, links, inputs (`:focus-visible`)
- [ ] Check contrast: `--muted` on `--surface` (target WCAG AA)
- [ ] Add `aria-current="page"` on active nav links
- [x] Audit: status not conveyed by color alone (add icons/labels)
- [x] Plan `prefers-reduced-motion` overrides for button hover transform and alert preview animations

---

## Phase 1 — App shell & information architecture (Weeks 2–3)

### 1.1 Global status bar

- [x] Replace minimal `status-bar` with **Live Status Bar** in `App.tsx` (or `LiveStatusBar.tsx`)
- [x] Show: Twitch (connected / offline / error)
- [x] Show: OBS WebSocket (connected / offline)
- [x] Show: Overlay clients (e.g. `2/5 sources connected` from health/preflight)
- [x] Show: Alert queue hint if API exposes queued/playing (optional)
- [x] Poll health on interval (keep 15s or tune); expose via context to avoid duplicate fetches
- [x] Click pill -> navigate to relevant fix (Integrations, Overlays, Dashboard)

### 1.2 Emergency access

- [x] Add **Emergency** icon/button in top bar (always visible)
- [x] Dropdown or drawer: stop sounds, hide overlays, reset overlays, disable automations, etc. (wire to existing `/api/emergency/*`)
- [x] Confirm destructive actions with dialog
- [x] Keyboard shortcut (e.g. `Ctrl+Shift+E`) - document in UI

### 1.3 Sidebar navigation regroup

- [x] Implement grouped nav sections (Live, Overlays, Alerts, Automation, Settings)
- [x] Collapsible sections (remember state in `localStorage`)
- [ ] Icons per item (if icon set chosen)
- [x] Hide or de-emphasize **Themes** under Overlays with Legacy badge
- [x] Move **Setup** under Settings or show only when preflight incomplete
- [x] Update `nav` config to data structure: `{ section, items: [{ path, label, badge? }] }`

### 1.4 Routing cleanup

- [x] Add `/alerts` list view (if currently only editor at `/alerts`)
- [x] Route `/alerts/:id` to editor
- [x] Add `/alerts/routing` and migrate `AlertsPage` content
- [x] Redirect `/alert-rules` -> `/alerts/routing`
- [x] Redirect `/alert-editor` -> `/alerts`
- [x] Add `/stream-deck` route; prepare to move builder from Dashboard
- [x] Update internal `Link` components across pages

### 1.5 App shell layout

- [x] Structure: sidebar + main column with top status bar
- [x] `PageHeader` on every route (consistent title area)
- [x] Optional: command palette stub (`Ctrl+K`) - MVP navigation/actions shipped
- [x] Global dirty/save indicator in header when any editor has unsaved changes (stretch)

### 1.6 Shell verification checklist

- [x] All old URLs redirect correctly
- [x] Active nav highlights correct on nested routes (`/alerts/:id` -> Alerts section active)
- [ ] Status bar updates after connecting Twitch in Integrations
- [x] Emergency actions work from new entry point
- [x] Responsive: sidebar collapses or top nav on narrow width (review `@media` breakpoints)

---

## Phase 2 — Design system rollout (Weeks 3–4)

### 2.1 Token migration

- [x] Introduce semantic tokens alongside legacy vars (alias old → new during transition)
- [ ] Replace hardcoded hex in inline styles with tokens (grep `style={{` in `pages/`) - in progress
- [x] Add reduced-motion media query block

### 2.2 Build core components

- [x] `Button` + variants
- [x] `Card` / `CardSection`
- [x] `PageHeader`
- [x] `StatusPill`
- [x] `Callout`
- [x] `FormField`
- [x] `CopyField`
- [x] `EmptyState`
- [x] `Skeleton`
- [x] Upgrade `ToastProvider` → queue + variants + a11y roles

### 2.3 Migrate shell to components

- [x] Refactor `App.tsx` to use `StatusPill`, `Button`, etc.
- [x] Refactor `PageLoading` / `ErrorBoundary` presentation

### 2.4 CSS hygiene

- [x] Mark deprecated global classes in `styles.css` comment block
- [ ] For each new component, move styles from global file to colocated `*.module.css` (if using modules)
- [ ] Target: no growth in global CSS line count; shrink over time

---

## Phase 3 — Live Control (Dashboard redesign) (Weeks 4–5)

### 3.1 Split Dashboard

- [x] Create `pages/live/Dashboard.tsx` (or `LiveControlPage.tsx`)
- [x] Create `components/live/ReadinessStrip.tsx`
- [x] Create `components/live/GoLiveChecklist.tsx`
- [x] Create `components/live/SessionPanel.tsx`
- [x] Create `components/live/QuickShortcuts.tsx` (favorite macros / source groups)
- [x] Create `components/live/HealthPanel.tsx` (doctor / preflight checks)
- [x] Move Stream Deck builder → `pages/stream-deck/StreamDeckPage.tsx`

### 3.2 Readiness strip

- [x] Aggregate preflight + integrations + overlay snapshot into 4–5 pills
- [x] Overall score: “4/5 ready” with link to first failing check
- [x] Use `Callout` for blocking issues (red/yellow)

### 3.3 Go live checklist

- [x] Short list: Test alert, Repair browser sources, Copy alerts URL, Open Integrations
- [x] Each item: done / todo with one-click action
- [x] Reuse logic from `SetupPage` where overlap exists

### 3.4 Session panel

- [x] Start/stop session prominent
- [x] Duration + key totals (from session API)
- [x] Link to Activity for detail

### 3.5 Quick shortcuts

- [x] Configurable favorites (localStorage): macros, source groups
- [x] Run macro / apply source group without opening full Macros page

### 3.6 Stream Deck page

- [x] Move builder UI from Dashboard
- [x] Add link to `tutorials/stream-deck-setup.md`
- [x] PageHeader + CopyField for generated URLs

### 3.7 Dashboard verification

- [x] Dashboard load time acceptable (parallel API calls, consider context)
- [x] No duplicate health polling vs. App shell
- [x] Stream Deck still generates valid requests
- [x] OBS repair browser sources still works from checklist

---

## Phase 4 — Setup & Integrations (Week 5)

### 4.1 Setup wizard

- [x] First-run detection (localStorage `btv.setup.completed` or preflight state)
- [ ] Optional full-screen wizard layout on first visit
- [x] Stepper UI with progress ring (enhance existing `SetupPage`)
- [x] Click step → jump to action (Integrations, Overlays, test alert)
- [x] On completion → mark complete; show Setup as link under Settings only
- [ ] Merge completed checklist into Dashboard `HealthPanel`

### 4.2 Integrations page

- [x] One card per service: Twitch, OBS, Spotify, Giphy
- [x] Large status + single primary CTA per card
- [x] `CopyField` for OAuth redirect URIs
- [x] External link buttons (“Open Twitch Developer Console”)
- [x] Replace inline error cards with `Callout` (redirect mismatch, chat EventSub)
- [x] Secret fields: show “Configured” vs. empty; avoid confusing `••••` in editable inputs
- [x] Use `FormField` for all inputs

### 4.3 Verification

- [ ] OAuth success/error query params still show toasts / callouts
- [ ] Copy redirect URI works
- [ ] Connect Twitch / OBS flows unchanged functionally

---

## Phase 5 — Alerts experience (Weeks 6–8)

### 5.1 Alert project list (`/alerts`)

- [x] New list page: cards or table with name, event type, updated_at, tags
- [x] Actions: New project, Duplicate, Delete, Open editor
- [x] `EmptyState` when no projects
- [x] Link to routing tab and legacy themes (de-emphasized)

### 5.2 Editor shell (extract from `AlertEditorPage.tsx`)

- [ ] Create `pages/alerts/AlertEditorPage.tsx` (thin orchestrator)
- [ ] Create `components/alerts/AlertEditorLayout.tsx` (3-column + optional timeline dock)
- [ ] Create `components/alerts/ProjectListPanel.tsx`
- [ ] Create `components/alerts/CanvasPanel.tsx`
- [ ] Create `components/alerts/InspectorPanel.tsx`
- [x] Create `components/alerts/EditorToolbar.tsx`
- [ ] Create `components/alerts/TimelineDock.tsx` (optional bottom)
- [x] `Breadcrumbs`: Alerts / {project name} / Layers

### 5.3 Toolbar regroup

- [x] **File:** Save, Export JSON, Import
- [x] **Edit:** Undo, Redo, Duplicate, Delete
- [x] **Test:** Primary “Test in OBS” (+ variation selector)
- [x] **OBS:** Copy browser source URL
- [x] Overflow menu (⋯): Sample pack, Save as template, Legacy links
- [x] Save status indicator adjacent to Save (saved / saving / unsaved)

### 5.4 Inspector UX

- [x] Inspector shows only selected layer properties
- [x] Empty selection → project/canvas settings
- [x] Collapsible sections: Transform, Text, Media, Audio, Reactive, Timing

### 5.5 Test payload & preview

- [x] Move test payload JSON to **Drawer** or right-panel tab “Test”
- [x] Validate JSON with inline error (keep existing validation logic)
- [x] Template gallery as **Dialog** with larger previews
- [x] Keep `AlertPreviewErrorBoundary` around canvas

### 5.6 Keyboard shortcuts

- [x] `Ctrl+S` — save
- [x] `Ctrl+Z` / `Ctrl+Y` — undo / redo
- [x] Document shortcuts in help tooltip or `?` popover

### 5.7 Alert routing page

- [x] Migrate `AlertsPage` → `/alerts/routing`
- [x] Tabs on Alerts section: Projects | Routing | Legacy themes
- [x] Clear copy: visual projects vs. legacy theme rules

### 5.8 Alert editor verification

- [x] Create, save, reload project
- [x] Test alert fires to OBS browser-source bus (live OBS window smoke pending)
- [x] Undo/redo still works after extract
- [x] Responsive breakpoints at 1500px / 1120px / 860px still usable
- [x] No regression in variation / chaos / audio test flows

---

## Phase 6 — Overlays & Widgets (Week 9)

### 6.1 Overlays page

- [x] `PageHeader` with primary “Repair browser sources”
- [x] `CopyField` per overlay URL
- [x] Status per overlay (reachable / not) from preflight
- [x] Overlay packs in card grid with `EmptyState`
- [ ] Preview thumbnails if available (optional)

### 6.2 Widgets page

- [x] Master–detail layout: widget list left, config right
- [x] Reduce vertical scroll; group settings by widget type
- [x] Widget theme cards use `Card` component
- [x] Test/preview buttons visible per widget type

### 6.3 Themes (legacy)

- [x] Move under Overlays or Alerts with “Legacy” badge
- [x] Callout: prefer Visual Alert Projects for new work
- [x] Link migration path in copy

---

## Phase 7 — Automation surfaces (Week 10)

### 7.1 Automations (event rules)

- [x] Master–detail: rule list + editor
- [x] Visual rule builder: Trigger → Conditions → Actions blocks
- [x] Move raw JSON test payload to **Advanced** collapsible
- [x] Test rule button prominent with result `Callout`
- [x] Run history link or inline recent runs

### 7.2 Scheduled automations

- [x] Separate sub-route or tab under Automation
- [x] List view with enabled toggle, interval, last run status

### 7.3 Macros

- [x] Master–detail layout
- [x] Step list as ordered cards (drag reorder if feasible)
- [x] Step type picker instead of JSON-only editing
- [x] Validate steps client-side (keep existing validation); show `FormField` errors
- [x] Link to Stream Deck page for HTTP trigger URLs

### 7.4 Webhooks

- [x] Webhook list + detail
- [x] `CopyField` for hook URL
- [x] Secret: configured indicator + regenerate hint
- [x] Log viewer: formatted JSON, truncate long bodies

---

## Phase 8 — Activity & polish (Weeks 11–12)

### 8.1 Activity feed

- [x] Feed layout: avatar/icon, user, event type chip, message, time ago
- [x] Filter chips: All, Follow, Sub, Cheer, Chat, Webhook, etc.
- [x] Row actions: “Test similar”, “Open alert project” (where applicable)
- [x] Empty state when no activity

### 8.2 Command palette (optional MVP)

- [x] `Ctrl+K` opens palette
- [x] Actions: Test follow alert, Copy alerts URL, Go to Integrations, Emergency stop sounds, etc.
- [x] Fuzzy search commands by label

### 8.3 Micro-celebrations (optional)

- [x] Brief success animation when setup completes (respect reduced motion)
- [x] Toast on first successful OBS test alert

### 8.4 Typography & brand

- [x] Load display font for logo and page titles only
- [x] Update `index.html` title and meta description
- [x] Favicon / app icon if assets exist

### 8.5 Final accessibility pass

- [x] Tab order logical in editor and modals
- [x] Dialog focus trap (if using Radix, built-in)
- [x] Screen reader labels on icon-only buttons
- [x] Toasts announced via `aria-live`

### 8.6 Final QA checklist

- [ ] Full setup flow: install → wizard → connect Twitch → OBS → test alert
- [x] Every nav item reachable and highlights correctly
- [x] All redirects from old routes work
- [ ] No console errors on primary paths
- [x] `pnpm typecheck` passes
- [ ] Spot-check responsive at 1280px, 1024px, 860px widths
- [ ] Update README screenshots section (if screenshots added)

---

## Component migration tracker (pages → design system)

Mark when each page uses `src/ui` components and `PageHeader`:

| Page | PageHeader | Core components | Master–detail / notes |
|------|------------|-----------------|------------------------|
| `App.tsx` | n/a | StatusBar, nav | Shell |
| `Dashboard` → Live Control | [x] | [x] | Split panels |
| `SetupPage` | [x] | [x] | Stepper |
| `IntegrationsPage` | [x] | [x] | Service cards |
| `OverlaysPage` | [x] | [x] | CopyField |
| `WidgetsPage` | [x] | [x] | Master–detail |
| `ThemesPage` | [x] | [x] | Legacy badge |
| `AlertsPage` → routing | [x] | [x] | Tabs under Alerts |
| `AlertEditorPage` | [ ] | [ ] | Editor shell |
| `InteractivePage` | [ ] | [ ] | |
| `MacrosPage` | [x] | [x] | Master–detail |
| `AutomationsPage` | [x] | [x] | Rule builder |
| `WebhooksPage` | [x] | [x] | List/detail |
| `ActivityPage` | [x] | [x] | Feed |
| `StreamDeckPage` (new) | [x] | [x] | Moved from Dashboard |

---

## Success metrics

Define “done” for the overhaul:

| Metric | Target |
|--------|--------|
| Time to first test alert (new user) | ≤ 15 minutes with wizard |
| Clicks from dashboard to test alert | ≤ 2 |
| Nav items at top level | ≤ 5 groups, ~12 leaves |
| `AlertEditorPage.tsx` line count | < 800 in page file (logic extracted) |
| Global `styles.css` | Shrinking or stable; hub-specific in modules |
| Accessibility | No critical axe violations on Dashboard, Integrations, Alerts list |
| User-reported confusion | Track: routing, setup, “where is test alert” |

---

## Risks & mitigations

| Risk | Mitigation |
|------|------------|
| Large bang refactor breaks flows | Phase by phase; keep redirects; feature flags per section |
| Alert editor regression | Extract layout only first; don’t rewrite canvas logic in same PR |
| Duplicate API polling | Centralize health/preflight in React context |
| Scope creep (command palette, animations) | Mark optional; ship MVP shell first |
| Breaking bookmarks | Permanent redirects for renamed routes |

---

## Suggested PR order (merge sequence)

1. `ui/phase-0` — context, ErrorBoundary, tokens scaffold, `src/ui` Button/Card
2. `ui/phase-1` — shell: grouped nav, status bar, emergency, routes
3. `ui/phase-2` — Toast, FormField, Callout; migrate Integrations + Setup
4. `ui/phase-3` — Live Control dashboard split + Stream Deck page
5. `ui/phase-4` — Alerts list + editor shell (no canvas logic change)
6. `ui/phase-5` — Editor toolbar/inspector/test drawer
7. `ui/phase-6` — Widgets/Overlays/Automations/Macros master–detail
8. `ui/phase-7` — Activity feed + a11y + docs

---

## Changelog

| Date | Author | Notes |
|------|--------|-------|
| 2026-05-25 | — | Initial plan created from UI overhaul review |
| 2026-05-25 | Codex | Started Phase 0 foundation: UI primitives, shared health context, route error boundary, loading skeleton, toast queue, semantic token scaffold, grouped shell nav/status pills. |
| 2026-05-25 | Codex | Continued Phase 1 shell work: added global emergency menu, wired existing emergency endpoints, documented `Ctrl+Shift+E`, and clarified current Alerts nav label. |
| 2026-05-25 | Codex | Added remembered collapsible sidebar groups and made live status pills navigate to their repair screens. |
| 2026-05-25 | Codex | Cleaned alert routes: `/alerts` now lists projects, `/alerts/:id` opens the editor, `/alerts/routing` owns rules, old routes redirect, and `/stream-deck` has its own shell route. |
| 2026-05-25 | Codex | Added a `Ctrl+K` command palette for fast navigation plus initial emergency actions. |
| 2026-05-25 | Codex | Migrated route page titles to shared `PageHeader` for a consistent shell-level title area. |
| 2026-05-25 | Codex | Verified shell responsiveness at narrow width and smoke-tested the global emergency Stop sounds action. |
| 2026-05-25 | Codex | Added a shared save-status registry and global shell indicator for saving, saved, dirty, and error states. |

---

## Quick reference — file touch list

**New files (expected)**

- `apps/hub/src/ui/*`
- `apps/hub/src/context/AppHealthContext.tsx`
- `apps/hub/src/components/live/*`
- `apps/hub/src/components/alerts/*`
- `apps/hub/src/pages/stream-deck/StreamDeckPage.tsx`
- `apps/hub/src/pages/alerts/AlertListPage.tsx` (if split)

**Major edits (expected)**

- `apps/hub/src/App.tsx`
- `apps/hub/src/styles.css` (tokens; shrink over time)
- `apps/hub/src/pages/Dashboard.tsx` (shrink or replace)
- `apps/hub/src/pages/AlertEditorPage.tsx` (extract layout)
- `apps/hub/src/hooks/useToast.tsx`
- `apps/hub/index.html` (fonts/meta)

**Docs**

- [x] `UI Overhaul Plan.md` (this file)
- [ ] Update `README.md` with link to this plan (optional)
- [ ] Add before/after screenshots under `docs/screenshots/` (optional)







