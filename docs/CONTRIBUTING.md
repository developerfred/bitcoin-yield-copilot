# Contributing Guide

This guide covers how to contribute to Bitcoin Yield Copilot.

## Getting Started

1. Fork the repository
2. Clone your fork
3. Create a feature branch

```bash
git checkout -b feature/your-feature-name
```

## Development Workflow

### 1. Install Dependencies

```bash
npm install
```

### 2. Create Environment File

```bash
cp .env.example .env
```

### 3. Run Development Server

```bash
npm run dev
```

### 4. Make Changes

Follow the coding standards:

- Use TypeScript
- Follow existing code style
- Add comments for complex logic
- Write tests for new features

### 5. Commit Changes

We use Husky for git hooks:

```bash
git add .
git commit -m "feat: add new feature"
```

## Code Style

### TypeScript

- Use explicit types
- Prefer interfaces over types
- Use meaningful variable names

### Git Commits

Follow Conventional Commits:

```
feat: add new feature
fix: fix a bug
docs: update documentation
refactor: refactor code
test: add tests
chore: update dependencies
```

## Testing

### Run Tests

```bash
npm test
```

### Write Tests

Place tests in `tests/` directory:

```typescript
import { describe, it, expect } from 'vitest';

describe('example', () => {
  it('should work', () => {
    expect(true).toBe(true);
  });
});
```

## Documentation

- Update README.md for user-facing changes
- Add code comments for complex logic
- Update API docs for endpoint changes

## Pull Request Process

1. Update tests if needed
2. Ensure all tests pass
3. Update documentation
4. Submit pull request

## Code Review

- Be responsive to feedback
- Explain your changes
- Keep changes focused and small
