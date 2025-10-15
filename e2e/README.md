# End-to-End Tests

This directory contains Playwright e2e tests for the real-time collaborative code editor.

## Setup

1. Install dependencies from the root:

   ```bash
   npm install
   ```

2. Install Playwright browsers:
   ```bash
   npx playwright install
   ```

## Running Tests

From the **root directory** of the monorepo:

### Run all e2e tests (headless)

```bash
npm run test:e2e
```

### Run tests with UI mode (interactive)

```bash
npm run test:e2e:ui
```

### Run tests in headed mode (see the browser)

```bash
npm run test:e2e:headed
```

### Run tests in debug mode

```bash
npm run test:e2e:debug
```

### Run specific test file

```bash
npx playwright test e2e/tests/collaboration.spec.ts
```

## How It Works

- The Playwright config is at the root level (`playwright.config.ts`)
- When you run tests, Playwright automatically starts all required servers using `npm run dev:all`
- This starts the Next.js app, Socket.io server, and Yjs server
- Tests run against `http://localhost:3000`
- Servers are stopped automatically after tests complete

## Test Structure

```
e2e/
└── tests/
    └── collaboration.spec.ts  # Authentication and collaboration tests
```

## Adding New Tests

Create new `.spec.ts` files in the `e2e/tests/` directory. They will be automatically discovered and run.

## CI/CD

In CI environments, tests will:

- Run with 2 retries on failure
- Use a single worker
- Not reuse existing servers
- Generate HTML reports

## Troubleshooting

### Tests fail to start

- Ensure all dependencies are installed: `npm install`
- Check that ports 3000, 4000, 4444 are available
- Increase timeout in `playwright.config.ts` if servers take long to start

### Tests time out

- Check server logs to ensure they started correctly
- Verify database connection is working
- Check that all environment variables are set correctly
