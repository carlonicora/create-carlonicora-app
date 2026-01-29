# Template Comparison Checklist

**Generated:** 2026-01-29T22:31:15.376Z
**Template:** /Users/carlo/Development/create-carlonicora-app/template
**Target:** /Users/carlo/Development/only35
**Project Name:** only35

---

## Instructions

Mark the files you want to analyze with `[x]`:

- `[ ]` = Skip this file
- `[x]` = Analyze this file

When done, return to Claude and confirm you're ready to continue.

---

## Config Drift (16 files)

Configuration files modified from template baseline.

- [x] `.env.example`
- [x] `.gitignore`
- [x] `.npmrc`
- [ ] `AGENTS.md`
- [ ] `apps/api/package.json`
- [ ] `apps/api/vitest.config.ts`
- [ ] `apps/web/components.json`
- [ ] `apps/web/mdx-components.tsx`
- [ ] `apps/web/package.json`
- [ ] `apps/web/tsconfig.json`
- [ ] `CONTRIBUTING.md`
- [ ] `docker-compose.yml`
- [ ] `Dockerfile`
- [x] `EXTEND-USER.md`
- [ ] `package.json`
- [ ] `scripts/update.sh`

---

## Version Drift (0 files)

Package.json files with only dependency version changes.

(none)

---

## Custom Code (16 files)

Application source code that differs from template.

- [ ] `apps/web/src/app/[locale]/(admin)/layout.tsx`
- [ ] `apps/web/src/app/[locale]/(auth)/oauth/authorize/OAuthAuthorizeClient.tsx`
- [ ] `apps/web/src/app/[locale]/(main)/layout.tsx`
- [ ] `apps/web/src/app/[locale]/(main)/page.tsx`
- [ ] `apps/web/src/app/[locale]/layout.tsx`
- [ ] `apps/web/src/config/Bootstrapper.ts`
- [ ] `apps/web/src/config/waitlist.config.ts`
- [ ] `apps/web/src/enums/feature.ids.ts`
- [ ] `apps/web/src/features/common/components/containers/IndexContainer.tsx`
- [ ] `apps/web/src/features/common/components/details/LayoutDetails.tsx`
- [ ] `apps/web/src/features/common/components/navigations/CommonSidebar.tsx`
- [ ] `apps/web/src/features/common/components/navigations/sidebar.items.tsx`
- [ ] `apps/web/src/features/common/components/navigations/UserSidebarFooter.tsx`
- [ ] `apps/web/src/i18n/useDateFnsLocale.ts`
- [ ] `apps/web/src/proxy.ts`
- [ ] `apps/web/src/utils/metadata.ts`

---

## Additions (20 files)

Files in target that don't exist in template.

- [x] `.gitattributes`
- [x] `apps/api/CLAUDE.md`
- [x] `apps/web/CLAUDE.md`
- [ ] `apps/web/src/app/api/contact/route.ts`
- [ ] `apps/web/src/app/api/optimiseImage/route.ts`
- [ ] `apps/web/src/app/api/persons/[personId]/photographs/[photographId]/image/route.ts`
- [ ] `apps/web/src/features/common/adapters/EntityServiceAdapter.ts`
- [ ] `apps/web/src/features/common/components/cards/EntityCard.tsx`
- [ ] `apps/web/src/features/common/components/cards/index.ts`
- [ ] `apps/web/src/features/common/components/dialogs/AddToEntityDialog.tsx`
- [ ] `apps/web/src/features/common/components/forms/VisibilityToggle.tsx`
- [ ] `apps/web/src/features/common/components/overlays/UnifiedFloatingActionBar.tsx`
- [ ] `apps/web/src/features/common/components/timeline/index.ts`
- [ ] `apps/web/src/features/common/components/timeline/TimelineContainer.tsx`
- [ ] `apps/web/src/features/common/components/timeline/TimelineItem.tsx`
- [ ] `apps/web/src/features/common/components/timeline/TimelineMonthHeader.tsx`
- [ ] `apps/web/src/features/common/contexts/SelectionContext.tsx`
- [ ] `apps/web/src/features/common/hooks/useAddToEntity.ts`
- [ ] `apps/web/src/utils/getPersonEmails.ts`
- [ ] `packages/shared/CLAUDE.md`

---

## Missing from Target (3 files)

Files in template that don't exist in target.

- [ ] `.github/workflows/check-library-updates.yml`
- [ ] `apps/api/jest.config.js`
- [ ] `gitattributes`
