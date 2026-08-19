# Contributing to AgroConnect

## Development baseline

AgroConnect currently targets Node.js `20.19.0` through `.node-version` and GitHub Actions.

Repository layout:

```text
client/  -> React + Vite frontend
server/  -> Express + MongoDB backend
```

## Branch workflow

The CI workflow runs for pushes and pull requests targeting both `main` and `charan`.

Before changing code:

```bash
git pull
```

Before pushing:

```bash
git status
git add .
git commit -m "Describe the change"
git push
```

Avoid force-pushing shared branches unless there is a specific recovery reason.

## Backend setup

```bash
cd server
npm install
cp .env.example .env
npm run dev
```

Backend default port: `5001`.

## Frontend setup

```bash
cd client
npm install
cp .env.example .env
npm run dev
```

Vite is configured on port `5003`.

## Required checks before pushing

Backend:

```bash
cd server
npm ci
npm test -- --runInBand
```

Frontend:

```bash
cd client
npm ci
npm run build
npm run lint
```

The CI pipeline currently runs backend Jest tests and the frontend production build. Linting is still useful locally even though it is not currently a CI job.

## Coding rules

### Authentication and authorization

- Do not rely only on `ProtectedRoute` in the frontend.
- Every sensitive backend route must use `protect`.
- Role-specific backend routes must also use `authorize(...)` or equivalent ownership checks.
- Do not return private user documents directly from public endpoints.

### User privacy

Public user/seller responses must not expose:

- bank details
- exact private address
- Aadhaar/verification documents
- admin review information
- reset tokens
- password hashes

Use `getPublicProfile()` or explicit safe fields for public responses.

### Farmer verification

Farmer verification is manual in the current application. Do not add an automatic government-ID API without a separate product/security decision.

The verified selling rule is:

```text
farmer.verificationStatus === "verified"
```

Verification employee area restrictions must be enforced in the backend, not only hidden in the UI.

### Products

- Farmers create `produce` only.
- Fertilizer sellers create `fertilizer` only.
- A product needs valid GPS coordinates to be published as active.
- Keep seller ownership checks on update/delete routes.

### Orders and cart

- Never trust cart stock as final inventory state.
- Checkout must re-check stock.
- Restore stock when a cancellable order is cancelled.
- Keep farmer shopping limited to fertilizer products.

### Payments

- Never accept payment amount supplied only by the frontend; derive payable amount from the stored order.
- Never expose payment-provider secret keys to browser code.
- Production must reject development/mock payment paths.

### Uploads

- Normal product images use the product upload endpoint.
- Verification evidence uses the dedicated protected verification upload endpoints.
- Keep image/video MIME checks and file-size limits.

## Environment variables

Do not commit `.env` files.

Use placeholders in `.env.example`.

See `ENVIRONMENT_VARIABLES.md` for the current variable list.

## Tests

Current test suites:

```text
server/__tests__/integration.test.js
server/__tests__/verification.test.js
```

When adding a security or business rule, add a regression test where practical.

Examples of behavior already covered include:

- auth and product API behavior
- cart/order flow
- delivery claim/update behavior
- notification behavior
- unverified farmer selling restriction
- forged farmer verification evidence rejection
- area verification employee restrictions
- suspension with an unexpired JWT
- public profile privacy
- admin API mounting/employee creation

## Documentation changes

When routes, environment variables, roles or deployment configuration change, update the matching documentation:

- `README.md`
- `API_DOCUMENTATION.md`
- `ARCHITECTURE.md`
- `ENVIRONMENT_VARIABLES.md`
- `USER_ROLES_AND_FLOWS.md`
- `DATABASE_SCHEMA.md`
- `CHANGELOG.md`

## Commit guidance

Prefer focused commit messages such as:

```text
Fix farmer verification route
Add delivery claim race-condition test
Document Render environment variables
Restrict public seller fields
```

Do not include secrets or personal identity data in commit messages, screenshots, test fixtures or documentation.
