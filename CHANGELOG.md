## [1.15.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.15.0...v1.15.1) (2026-09-02)

### 🐛 Bug Fixes

* **template:** drop the duplicate header on the user detail page ([8605a68](https://github.com/carlonicora/create-carlonicora-app/commit/8605a682b6b3a4aead244a516c520a598825c32d))

### 📦 Code Refactoring

* **template:** drop the bundled {{name}}-architecture skill ([7d0da89](https://github.com/carlonicora/create-carlonicora-app/commit/7d0da8943cca2fa5bb925ac26de2515a4015af41))

### ♻️ Chores

* **template:** add sync:versions and align deps with wyrdli/a360ai ([9fbbe1b](https://github.com/carlonicora/create-carlonicora-app/commit/9fbbe1bb616739efd970be2f98ee8f44fba1638c))

## [1.15.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.14.0...v1.15.0) (2026-08-31)

### 🚀 Features

* add E2E dashboard and unit tests for parsers ([b4f4c6c](https://github.com/carlonicora/create-carlonicora-app/commit/b4f4c6c574d635e60d1fe1727c4059296ae6911f))

### 📚 Documentation

* e2e dashboard template port design spec ([5bbb26a](https://github.com/carlonicora/create-carlonicora-app/commit/5bbb26ae79a4a42f1040198221b1d5b2a5f1b022))

## [1.14.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.13.1...v1.14.0) (2026-08-31)

### 🚀 Features

* **template:** scaffold NestJS 12 + TypeScript 6 apps, drop ts-node ([01a1bef](https://github.com/carlonicora/create-carlonicora-app/commit/01a1befdf142d22376ac9b6b44b5325cf41ec29b))
* update service worker implementation and add development-only push worker ([4a15f12](https://github.com/carlonicora/create-carlonicora-app/commit/4a15f12586ba68b2c17c40bae30702b3bc08f19d))

## [1.13.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.13.0...v1.13.1) (2026-08-24)

### 🐛 Bug Fixes

* **template:** set oxc:false in the api vitest configs and drop jest leftovers ([ec4f2aa](https://github.com/carlonicora/create-carlonicora-app/commit/ec4f2aa8442ddb69d33c5aa05397173342bd851a))

## [1.13.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.12.0...v1.13.0) (2026-08-24)

### 🚀 Features

* **template:** administration surface, settings rail, e2e harness, repairs ([dd8d594](https://github.com/carlonicora/create-carlonicora-app/commit/dd8d594b3ce180e4b3b08c24a400ebe19a5d6466))
* **tooling:** integrity harness, multi-target drift report, template-sync skill ([520661c](https://github.com/carlonicora/create-carlonicora-app/commit/520661cd8147ecfe3c57ae518f60f0821123a34e))

### 🐛 Bug Fixes

* **ci:** resync package-lock.json with package.json ([b8bb1af](https://github.com/carlonicora/create-carlonicora-app/commit/b8bb1afcbee4259a315bb889cdf75bf66644da44))
* **compare:** generalize declared donor domains; strip donor branding from the template ([b3c08d6](https://github.com/carlonicora/create-carlonicora-app/commit/b3c08d605eaf195182837f9d622ff2aed90172d1))

### 📚 Documentation

* add template multi-source alignment design spec ([dbbf6fc](https://github.com/carlonicora/create-carlonicora-app/commit/dbbf6fc87d34ff8c2df479edc8e9e87f82b7c2cc))
* spec and implementation plans for the template alignment work ([3a1b4ad](https://github.com/carlonicora/create-carlonicora-app/commit/3a1b4ad8ff5683d79405575c61f8be348b2623bc))
* **template-sync:** make the skill produce a decision list, not a 400-row report ([4e159be](https://github.com/carlonicora/create-carlonicora-app/commit/4e159be6139abc5f4f5e1cfe73af42a33acd55d2))
* **template-sync:** stop the compare stage calling the report "for reading" ([850bf8e](https://github.com/carlonicora/create-carlonicora-app/commit/850bf8e228d32d070e1986da47bb015c7bcf2cea))

### ♻️ Chores

* **deps:** upgrade toolchain, adopt pnpm 11 workspace config, bump CI runtimes ([eddb266](https://github.com/carlonicora/create-carlonicora-app/commit/eddb2666499ef31c08187e0234d0850bb23be219)), closes [vercel/next.js#91768](https://github.com/vercel/next.js/issues/91768)
* **template:** pin production versions to nestjs-neo4jsonapi 3.2.0 ([4de1cfb](https://github.com/carlonicora/create-carlonicora-app/commit/4de1cfb9002cc7c31e70d58f7f70f30852e66769))

## [1.12.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.11.1...v1.12.0) (2026-08-03)

### 🚀 Features

* **template:** add generic framework-only ModuleId to shared package ([e738391](https://github.com/carlonicora/create-carlonicora-app/commit/e738391c417b063262642eebd12364f6ba178f84))
* **template:** add generic framework-only RBAC matrix, id-map, and user-paths ([012cafe](https://github.com/carlonicora/create-carlonicora-app/commit/012cafef08597b41438b75ac7b068f16cb47cadd))
* **template:** register RbacModule in the feature registry ([1f1558c](https://github.com/carlonicora/create-carlonicora-app/commit/1f1558c67aac03c980a10152d338952206272e06))
* update environment configuration and add public hostname for Next.js image optimizer ([92f12cf](https://github.com/carlonicora/create-carlonicora-app/commit/92f12cf81fe2efb658abbb4805c7f454ae09afa6))

### 🐛 Bug Fixes

* remove old files ([b016966](https://github.com/carlonicora/create-carlonicora-app/commit/b016966871a2f04a0a2268cd896f3944731e3ce2))

### 📚 Documentation

* add RBAC template baseline design spec ([ef5483c](https://github.com/carlonicora/create-carlonicora-app/commit/ef5483cedd05e9329bd542f0f20d9667afdf2636))
* add RBAC template baseline implementation plan ([2543da6](https://github.com/carlonicora/create-carlonicora-app/commit/2543da60eadf9a64548b52ab8b8502e386fdc1a9))

### 🛠 Build System

* **sync:** protect generic RBAC baseline, sync admin RBAC UI + validate script ([78f3962](https://github.com/carlonicora/create-carlonicora-app/commit/78f3962533e15e3a41c546f67689725829d3440b))

## [1.11.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.11.0...v1.11.1) (2026-02-15)

### 🐛 Bug Fixes

* correct initial internationalisation ([0a2ea8b](https://github.com/carlonicora/create-carlonicora-app/commit/0a2ea8bcb31e86f0c004cdeedabd53c121f5e741))

## [1.11.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.10.0...v1.11.0) (2026-02-15)

### 🚀 Features

* implement OAuth settings and client management pages ([72da887](https://github.com/carlonicora/create-carlonicora-app/commit/72da887a630f1354c32cf999bfe3912b7fc332e4))
* update packages versions ([438ad98](https://github.com/carlonicora/create-carlonicora-app/commit/438ad980194c5972657d08ca459c49052bd2e03c))

## [1.10.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.9.0...v1.10.0) (2026-01-31)

### 🚀 Features

* add translation validation to web lint script ([2602997](https://github.com/carlonicora/create-carlonicora-app/commit/2602997522237751adbbc944fa49f41a9d12310c))

### 🐛 Bug Fixes

* correct internationalisation ([6ecd829](https://github.com/carlonicora/create-carlonicora-app/commit/6ecd82920c4addcffc4f0b18a515b3fa92479191))

## [1.9.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.8.1...v1.9.0) (2026-01-31)

### 🚀 Features

* add email templates for account activation, registration notifications, waitlist confirmations, and invitations ([1caed40](https://github.com/carlonicora/create-carlonicora-app/commit/1caed40b9153c8409f116422366dcf7baf0abf90))

## [1.8.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.8.0...v1.8.1) (2026-01-31)

### 🐛 Bug Fixes

* remove isCore from modules ([db3e415](https://github.com/carlonicora/create-carlonicora-app/commit/db3e4157abbf5a8229d6e3614c469daf45279e7f))

## [1.8.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.7.0...v1.8.0) (2026-01-30)

### 🚀 Features

* implement core update workflow with manifest management, patch generation, and application ([61d5f4e](https://github.com/carlonicora/create-carlonicora-app/commit/61d5f4e0b825bc29bcd36abf3e152b37a3fd5853))

## [1.7.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.6.0...v1.7.0) (2026-01-30)

### 🚀 Features

* add VSCode settings template with i18n-ally and formatter config ([9547ea3](https://github.com/carlonicora/create-carlonicora-app/commit/9547ea34440573a8ad9eac3a8568e89444571a93))

## [1.6.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.5.0...v1.6.0) (2026-01-29)

### 🚀 Features

* add template checklist command and reporting functionality ([06e5f60](https://github.com/carlonicora/create-carlonicora-app/commit/06e5f6067e6d1be866028412ce99b0b766e25c94))

## [1.5.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.4.0...v1.5.0) (2026-01-29)

### 🚀 Features

* add compare template script ([67d67b5](https://github.com/carlonicora/create-carlonicora-app/commit/67d67b59b7ddb1271d131b63242997cbbdb159a9))
* update structure to latest version ([08b0f2d](https://github.com/carlonicora/create-carlonicora-app/commit/08b0f2d8c71f92f3ad309cd4f6cb2d8d5b0e3652))
* update to latest nextjs-jsonapi and nestjs-neo4jsonapi versions ([063c33c](https://github.com/carlonicora/create-carlonicora-app/commit/063c33ce79e9734b5c7b3fda8239fb0b1956614a))

### 🐛 Bug Fixes

* ensure permissions checks are awaited in company, role, and user pages ([d0fff26](https://github.com/carlonicora/create-carlonicora-app/commit/d0fff2675df96f023e1e0e4aee031e480d64dabd))
* sync package-lock.json with package.json ([ad5462c](https://github.com/carlonicora/create-carlonicora-app/commit/ad5462cacdcc6a3d24afc7466710b68ce9d8a1b8))

## [1.4.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.9...v1.4.0) (2025-12-21)

### 🚀 Features

* add owner field with validation to the form ([2db8bb9](https://github.com/carlonicora/create-carlonicora-app/commit/2db8bb9045ecc845713b0aa279841b9d8f6df7bb))

## [1.3.9](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.8...v1.3.9) (2025-12-18)

### 🐛 Bug Fixes

* update feature query to use isCore instead of isProduction ([d6a6324](https://github.com/carlonicora/create-carlonicora-app/commit/d6a6324eb216aaa384b22a8c380b03aa81f9dc27))

## [1.3.8](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.7...v1.3.8) (2025-12-18)

### 🐛 Bug Fixes

* update featureId in migration queries to ensure proper access control ([cf6b386](https://github.com/carlonicora/create-carlonicora-app/commit/cf6b386421f5db854f656997f2ebb93ebf0d79b8))

## [1.3.7](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.6...v1.3.7) (2025-12-18)

### 🐛 Bug Fixes

* update logo path in service worker and CommonSidebar component ([d88c6f7](https://github.com/carlonicora/create-carlonicora-app/commit/d88c6f7646a968939029a649858f3249504d88b7))

## [1.3.6](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.5...v1.3.6) (2025-12-18)

### 🐛 Bug Fixes

* add page prop to Cookies component in AuthPage ([8433194](https://github.com/carlonicora/create-carlonicora-app/commit/843319408e6610f4dc8275ac6b48e9059306192c))
* remove content from default bootstrapper ([ab5b300](https://github.com/carlonicora/create-carlonicora-app/commit/ab5b3006b68f4fe151c7dac0611daf809cc1047e))

## [1.3.5](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.4...v1.3.5) (2025-12-18)

### 🐛 Bug Fixes

* add tslib as a dependency in package.json ([12e3fe5](https://github.com/carlonicora/create-carlonicora-app/commit/12e3fe54f6cd47e72823b081f5445a61170fecd8))

## [1.3.4](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.3...v1.3.4) (2025-12-17)

### 🐛 Bug Fixes

* correct npm release ([98d1bc4](https://github.com/carlonicora/create-carlonicora-app/commit/98d1bc4be66ef8154a1a5cb7bc2f40b7d03cbdcc))

## [1.3.3](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.2...v1.3.3) (2025-12-17)

### 🐛 Bug Fixes

* correct imports ([ba23a5d](https://github.com/carlonicora/create-carlonicora-app/commit/ba23a5de84682be31a500243def3643eda2966ee))

## [1.3.2](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.1...v1.3.2) (2025-12-17)

### 🐛 Bug Fixes

* correct npm release ([a78ec47](https://github.com/carlonicora/create-carlonicora-app/commit/a78ec47a626655696b8946718412a399a0c2c486))

## [1.3.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.3.0...v1.3.1) (2025-12-17)

### 🐛 Bug Fixes

* correct imports ([1257662](https://github.com/carlonicora/create-carlonicora-app/commit/1257662fb0443632286a8225b5dd25a0a423f139))
* correct npm release ([e02a04a](https://github.com/carlonicora/create-carlonicora-app/commit/e02a04a50c81ed0e44db44e7362a848883282166))

## [1.3.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.2.0...v1.3.0) (2025-12-17)

### 🚀 Features

* add generation scripts in package ([d65eb9e](https://github.com/carlonicora/create-carlonicora-app/commit/d65eb9ede03ffbb3ddd134d05d1227b9656fc3df))

## [1.2.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.1.2...v1.2.0) (2025-12-15)

### 🚀 Features

* update to latest version of nextjs-jsonapi ([088a289](https://github.com/carlonicora/create-carlonicora-app/commit/088a289d6f1731e1cc4b99667c5cf8d010cc1fef))

## [1.1.2](https://github.com/carlonicora/create-carlonicora-app/compare/v1.1.1...v1.1.2) (2025-12-15)

### 🐛 Bug Fixes

* correct apply-production-version ([50b3d5f](https://github.com/carlonicora/create-carlonicora-app/commit/50b3d5f438b0f92f6d9b68ae3e5118abf7a79c82))

## [1.1.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.1.0...v1.1.1) (2025-12-13)

### 🐛 Bug Fixes

* trigger publish workflow on tag creation instead of master push ([e2d6bdd](https://github.com/carlonicora/create-carlonicora-app/commit/e2d6bdde334caa9ceb9f356000a5b99c73a6c823))

## [1.1.0](https://github.com/carlonicora/create-carlonicora-app/compare/v1.0.0...v1.1.0) (2025-12-13)

### 🚀 Features

* add workflow_dispatch to master for manual release trigger ([34ec8e7](https://github.com/carlonicora/create-carlonicora-app/commit/34ec8e7522dc5ef984add5f992f06f9b94be902d))

### 🐛 Bug Fixes

* exclude REST.http from template (contains test tokens) ([7291c80](https://github.com/carlonicora/create-carlonicora-app/commit/7291c80653aae1dc7ca77c744c827c39f7d32ac2))
* rename dotfiles for npm compatibility ([782db18](https://github.com/carlonicora/create-carlonicora-app/commit/782db18edd7e40dfdfac98fa6cbe23f66ac71460))
* use .releaserc.cjs for ESM compatibility ([40b0498](https://github.com/carlonicora/create-carlonicora-app/commit/40b049805d1700db84231386e77cb08dec0dc17e))

### 📦 Code Refactoring

* simplify release workflow ([6e8a82a](https://github.com/carlonicora/create-carlonicora-app/commit/6e8a82a4e8f3003b0b4353965df7eade41c1c868))

### ♻️ Chores

* **release:** 1.0.1-dev.1 [skip ci] ([6bb14aa](https://github.com/carlonicora/create-carlonicora-app/commit/6bb14aaaa0cd2a7790249ebdde95f5d263bfdab4))
* **release:** 1.1.0-dev.1 [skip ci] ([7fa7f2f](https://github.com/carlonicora/create-carlonicora-app/commit/7fa7f2f4a078b5cb36b83acefd2a6507147bf14a))

## [1.1.0-dev.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.0.1-dev.1...v1.1.0-dev.1) (2025-12-13)

### 🚀 Features

* add workflow_dispatch to master for manual release trigger ([34ec8e7](https://github.com/carlonicora/create-carlonicora-app/commit/34ec8e7522dc5ef984add5f992f06f9b94be902d))

## [1.0.1-dev.1](https://github.com/carlonicora/create-carlonicora-app/compare/v1.0.0...v1.0.1-dev.1) (2025-12-13)

### 🐛 Bug Fixes

* exclude REST.http from template (contains test tokens) ([7291c80](https://github.com/carlonicora/create-carlonicora-app/commit/7291c80653aae1dc7ca77c744c827c39f7d32ac2))
* rename dotfiles for npm compatibility ([782db18](https://github.com/carlonicora/create-carlonicora-app/commit/782db18edd7e40dfdfac98fa6cbe23f66ac71460))
* use .releaserc.cjs for ESM compatibility ([40b0498](https://github.com/carlonicora/create-carlonicora-app/commit/40b049805d1700db84231386e77cb08dec0dc17e))
