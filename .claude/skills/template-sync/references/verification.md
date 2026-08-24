# Verification — the scaffold-and-boot gate

**Lint, build and test all pass on a NestJS graph that cannot start. Only booting proves it.**

Every one of the four defects that shipped in the template — the ungated admin layout, the
`ProductsAdminContainer` import that existed in neither `dist` nor `src`, the schemeless
`metadataBase`, and the unregistered `Modules.*` entries — survived every static gate the repo
had. Three of the four were only ever going to be caught by starting the app.

This gate is **non-optional** and it runs after every sync, no matter how small the adoption.
It lives inside this skill rather than in a separate one precisely so it cannot be dropped under
time pressure.

Work in a temp directory. Never scaffold into the repo, and never write anything into
`../wyrdli`, `../neural-erp`, or any other configured target.

---

## 1. Static gates

```bash
pnpm check:template --strict
pnpm test
```

Both must exit 0. `--strict` is required — see `integrity.md` for why a `SKIP` is not a pass.

## 2. Build the generator

```bash
pnpm build
```

Exit 0. This proves the CLI's own TypeScript graph still compiles — the template being fine says
nothing about the tool that copies it.

## 3. Scaffold fast, for the cheap assertions

```bash
node bin/cli.js <name> --skip-git --skip-install
```

Then assert, on the generated tree:

- **No junk copied.** No `.DS_Store`, `Thumbs.db` or `*.log` anywhere.
- **No unsubstituted placeholders.** No literal `{{name}}` or `{{display}}` survives in any
  generated file.
- **Placeholder consistency.** Where both appear, `{{name}}` rendered kebab-case and machine-facing,
  `{{display}}` rendered human-readable. Mixing them inside one rendered file is visible to the
  end user.
- **No brand leak.** No literal `wyrdli` or `neural-erp` in the generated tree.

This run is for these assertions only. It cannot go further: `--skip-git` leaves `.gitkeep`
placeholders where the submodules should be, so nothing installs.

## 4. Scaffold a second app, WITH git

```bash
node bin/cli.js <name2>
```

Steps 5–7 need the submodules cloned and built, and only a git-enabled scaffold produces them.
Do not try to shortcut this by reusing the step-3 tree — it does not have the libraries.

## 5. Install and typecheck

```bash
pnpm install
pnpm --filter <name2>-web exec tsc --noEmit
```

Exit 0, no errors. This is the step that catches an import of a symbol the library does not
actually export, and it is the reason `precedence.md` rule 5 ("prefer library containers") is
safe to follow.

## 6. Boot the API

```bash
pnpm dev:api
```

**The gate is that the DI graph builds** — no `UnknownDependenciesException`, no module
resolution failure at startup.

"Cannot reach Neo4j" is a **different and acceptable result**: it means Nest constructed the
graph and then failed to reach infrastructure you did not start. Do not treat it as a failure,
and do not stand up a database just to get past it.

## 7. Boot the web app and request `/`

```bash
pnpm dev:web
```

Then request `/` and **assert HTTP 200**.

**A 200 is the gate, not "Ready".** The server/client boundary crash that motivated this step
happened *during instrumentation*, after the process had already printed that it was ready — the
`tokenUsageModules` import from `/core` rather than the server-safe `/tokenusage` subpath. It
resolved, it typechecked, it passed its own check, and it killed the dev server on first request.

If admin or settings routes were part of the adoption, log in and open `/administration`, each
admin sub-route, and `/settings` as well. A route that 200s empty is not a pass — the i18n key
set is not checked by anything automatic (see `integrity.md`), and missing keys show up as
visible placeholder text.

## 8. Stopping the servers — kill by PID or by port, NEVER by name pattern

**NEVER stop a process with a name-pattern kill.** Not `pkill -f "next dev"`, not
`pkill -f "nest start"`, not `pkill -f "turbo run dev"`, not `pkill -f node`, not `killall node`,
not any variation of them.

Several projects run concurrently on this machine with **identical command lines** — a pattern
kill cannot tell them apart and destroys work in repositories that have nothing to do with this
one. This has already happened once. It is a hard prohibition, not a preference.

The sanctioned forms:

```bash
lsof -ti :<port> -sTCP:LISTEN | xargs -r kill      # kill only what listens on THIS project's port
```

or capture the PID when you start the process yourself and kill exactly that PID or process
group.

Before killing, verify the target belongs to this verification run:

```bash
lsof -i :<port>
ps -o args= -p <pid>
```

**Never widen a pattern "to be sure it's dead."** A process that survives is a nuisance; a
pattern kill is data loss in someone else's repository. If a port-scoped kill does not work,
find the right PID — do not fall back to a name.

---

## Reporting the gate

State which steps ran and what each returned, including the HTTP status from step 7. "Verified"
without those numbers is not a verification. If a step was skipped, say which and why — an
unreported skip in this gate is how all four original defects shipped.

Then stop. **Do not commit.** The user commits after their own manual verification.
