# Contributing

## Scope

Keep changes targeted. Avoid mixing roadmap work, design experiments, and unrelated cleanup in the same patch.

## Prerequisites

- Node.js `22.5+`
- `pnpm 9+`
- OBS Studio if you need to validate browser-source overlays

Install dependencies from the repository root:

```bash
pnpm install
```

## Local Development

Use the shared startup helpers from the repository root:

```bash
pnpm start
```

Useful alternatives:

- `pnpm free-ports` clears ports `4781`-`4783` without starting the app.
- `scripts\start.cmd` and `scripts\start.ps1` remain available on Windows.

Default local endpoints:

- Hub: `http://127.0.0.1:4781`
- Overlay server: `http://127.0.0.1:4782`
- OAuth callback host: `https://127.0.0.1:4783`

## Verification

Run the relevant checks for the area you changed. For most changes, use:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

For Hub UI changes, also run a production build:

```bash
pnpm --filter @btv/hub build
```

If you touch overlay rendering, Stream Deck flows, or visual surfaces, add the smallest focused manual check you can describe in the PR.

## Pull Requests

- Explain the user-visible change and the risk area.
- Note any checklist item, issue, or roadmap task you completed.
- List the verification commands you ran.
- Call out anything that still needs manual review, especially OBS, Twitch, OAuth, or browser-source behavior.
