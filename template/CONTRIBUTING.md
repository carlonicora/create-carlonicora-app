# Contributing to {{name}}

Thank you for contributing to {{name}}! This guide will help you get started.

## Development Setup

1. **Prerequisites**
   - Node.js >= 22.0.0
   - pnpm >= 10.0.0

2. **Install dependencies**
   ```bash
   pnpm install
   ```

3. **Run development servers**
   ```bash
   pnpm dev
   ```

## Testing

### Running Tests Locally

Before pushing your changes, run the test suite locally:

```bash
# Run all tests
pnpm test

# Run tests with coverage report
pnpm test:cov

# Run tests in watch mode (useful during development)
pnpm test:watch

# Run tests for a specific package
pnpm --filter {{name}}-web test
pnpm --filter {{name}}-api test
```

### CI/CD Test Requirements

**All pull requests must pass the test suite before merging.**

When you open a pull request:
1. The CI pipeline automatically runs `pnpm test`
2. If any test fails, the PR **cannot be merged**
3. Fix failing tests and push again to re-run the checks

### Writing Tests

- Test files should be named `*.spec.ts` or `*.test.ts`
- Place tests near the code they test or in `__tests__` directories
- Use Vitest for all tests: `import { describe, it, expect, vi } from 'vitest'`

## Code Style

- Run `pnpm lint` to check for linting errors
- Run `pnpm format` to format code

## Pull Request Process

1. Create a feature branch from `dev`
2. Make your changes
3. Run tests locally: `pnpm test`
4. Push and open a PR
5. Wait for CI checks to pass
6. Request review

## Questions?

Open an issue if you have questions about contributing.
