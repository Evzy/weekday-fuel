# Spec-driven workflow for Weekday Fuel — design

**Status:** approved 2026-10-14
**Scope:** process scaffolding only (no product features)

## Goal

Every change to Weekday Fuel goes through **brainstorm → spec → plan → implement**, so ideas are written down and agreed before code, and any agent (or the owner) can pick up a piece of work with full context.

Work is done mostly by the owner, with Cursor agents taking individual tasks or whole plans. Changes are committed straight to `main`.

## Approach

Use the installed **superpowers** skills as the engine (`brainstorming`, `writing-plans`, `executing-plans` / `subagent-driven-development`, `verification-before-completion`). The repo adds only what the skills don't know: where the backlog lives, project guardrails, and a definition of done.

`AGENTS.md` describes the flow in plain words, so an agent without the superpowers plugin (e.g. a cloud agent) can still follow it by hand.

Rejected alternatives:

- **Self-contained templates + custom Cursor commands:** duplicates what superpowers already does and would drift.
- **GitHub Issues as specs:** specs would live outside the repo, agents would need `gh` to read them, and it adds overhead to a commit-to-`main` loop.

## Files

| Path | Purpose |
| --- | --- |
| `AGENTS.md` | Entry point for any agent: project guardrails, the flow, definition of done, release step. |
| `.cursor/rules/spec-driven.mdc` | Always-applied Cursor rule (about 10 lines): read `AGENTS.md`, use the superpowers flow. |
| `docs/superpowers/README.md` | Human-facing explanation of the flow in this repo. |
| `docs/superpowers/INDEX.md` | Backlog and status board: one row per feature. |
| `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md` | Specs, written by `brainstorming`. |
| `docs/superpowers/plans/YYYY-MM-DD-<topic>.md` | Implementation plans, written by `writing-plans`. |

Spec and plan locations are the skills' defaults, so no overrides are needed. No custom spec or plan templates; the skills define those formats.

`README.md` (repo root) gets a row pointing at `docs/superpowers/`.

## Lifecycle

Statuses in `INDEX.md`: `idea` → `specced` → `planned` → `in progress` → `done`, or `dropped`.

1. **Idea.** Add a row to `INDEX.md` with a one-line what and why. Ideas need no spec.
2. **Spec.** Run `brainstorming` on the idea. The spec is committed to `main`; the row becomes `specced` and links to it.
3. **Plan.** Run `writing-plans` on the approved spec. The plan (bite-sized tasks with checkboxes) is committed; the row becomes `planned` and links to it.
4. **Build.** Work through the plan's tasks: by hand, or by handing single tasks or the whole plan to an agent (`executing-plans` in a separate session, `subagent-driven-development` in the same one). Tick each task in the plan and commit straight to `main` with the topic in the message, e.g. `shop-builder: add serves stepper`. CI runs on every push and must stay green. The row becomes `in progress`.
5. **Done.** CI is green, every plan task is ticked, and the spec's phone checklist has passed. The row becomes `done` with the landing commit hash.
6. **Release** is a separate, deliberate commit that bumps `versionCode` / `versionName` (message `release: vX.Y.Z`). Only that ships to phones. Several finished features can share one release.

Rules:

- A spec may be edited while its feature is `in progress`. If building shows the spec was wrong, fix the spec in the same commit as the code.
- Once `done`, a spec is frozen. Changing a shipped feature means a new spec that links to the old one.

## Guardrails (in `AGENTS.md`)

Constraints every spec must respect:

- **No backend.** All data stays on the phone. The only network traffic is the GitHub Releases check, Google Fonts, and links the user taps.
- **The phone holds the only copy of the user's data**, and uninstalling wipes it:
  - Never change the WebView page address (`https://appassets.androidplatform.net/assets/weekday_fuel/Weekday_Fuel.html`), the `applicationId` (`dev.weekdayfuel.app`), or the signing key.
  - Any change to the shape of data saved in `localStorage` must include code that reads the old shape and converts it.
- **The HTML is the app.** The Kotlin host stays thin; native code is added only when the page genuinely cannot do something.
- **Decisions in `docs/seed/TRANSCRIPT_NOTES.md` stand** unless a spec explicitly overrides one (exact product links, no generic search buttons, product names that match the meal list).
- **The first spec that changes the HTML also removes the CI step** "Shipped HTML matches frozen seed". The seed copy in `docs/seed/` stays as the historical v0.

Every spec must include, in addition to the skill's standard sections:

- **Data impact:** does saved data change shape? If so, how is old data converted?
- **Verification:** automated tests where possible, plus a short checklist of things to try on the phone.
- **Release note:** one user-facing line.

## Initial `INDEX.md` rows (status `idea`)

1. **Verify v0 on a phone:** install v0.1.0, check tabs, saved data, and store links; bump to 0.1.1 and confirm the cold-start update prompt installs over it.
2. **Scoped publishing token:** replace `WEEKDAY_FUEL_RELEASES_TOKEN` (currently the owner's `gh` CLI token with full `repo` scope) with a fine-grained PAT limited to Contents: write on `weekday-fuel-releases`.
3. **Automated tests for the HTML:** a way to test `Weekday_Fuel.html` behaviour in CI, so UI specs are not verified only by hand.

## Out of scope

- Any product feature or HTML change.
- Branch/PR workflow (changes go straight to `main`).
- Changes to the CI workflow.

## Data impact

None. No app code or saved data changes.

## Verification

- `AGENTS.md`, the Cursor rule, `docs/superpowers/README.md`, and `INDEX.md` exist, and their links resolve.
- A fresh agent in this repo, asked to "add a feature", starts by reading `AGENTS.md` and offers to brainstorm instead of writing code.
- CI stays green after the scaffolding commit (docs only, so the APK is unchanged and no release is published).

## Release note

None (no app change).
