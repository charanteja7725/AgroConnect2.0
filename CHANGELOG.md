# Changelog

All notable project-level changes documented here refer to the current AgroConnect repository implementation.

## 2026-08-19

### Added

- Manual farmer verification workflow using Aadhaar front/back images, farm photo, farming video, GPS location and farm address.
- `verification_employee` role with admin-managed state/district assignments.
- Verification employee dashboard route at `/verification-employee`.
- Admin verification employee management route at `/admin/verification-employees`.
- Backend area restriction so verification employees can only review farmers in assigned areas.
- Private/authenticated Cloudinary handling for farmer verification evidence.
- Dedicated verification upload endpoints.
- SPA rewrite configuration in `client/vercel.json` for Vercel deep-link routing.
- Expanded automated verification/security tests.
- Production health information for Cloudinary configuration.
- Repository documentation files: architecture, API, environment, security, roles/flows, database schema and contributing guidance.

### Changed

- Farmer dashboard verification actions now route to the full `/verification` page instead of the old notes-only verification UI.
- Farmer product publishing now requires approved verification.
- Suspended/deactivated users are rechecked from MongoDB on protected requests and blocked even when holding an unexpired JWT.
- Public user and seller responses were reduced to safe public profile fields.
- Admin routes are mounted consistently at `/api/admin`.
- Order delivery address rendering was made safe for object-based addresses.
- Order creation now fills missing buyer contact fields from the authenticated account where appropriate.
- Order checkout re-checks live inventory and uses guarded stock updates.
- Delivery jobs can be claimed atomically by delivery partners.
- Payment confirmation creates seller-specific delivery jobs while preventing duplicates.
- GitHub Actions uses Node `20.19.0` and runs backend Jest tests plus the frontend Vite build.
- Root Node version was pinned through `.node-version`.

### Fixed

- React object-rendering crash on the farmer Orders section.
- Vercel direct-route `404: NOT_FOUND` for React Router pages such as `/login`.
- Frontend API base URL requirement so production requests include `/api`.
- Duplicate/import/context issues that prevented frontend builds.
- Missing Razorpay package required by backend payment routes.
- Jest startup failures caused by production validation running during module import.
- CI test mismatches for Stripe webhook configuration behavior.
- Inventory race-condition test so it represents a real stale-cart checkout race.
- Cloudinary preview warnings during tests when Cloudinary is intentionally not configured.

### Security

- Public profile data no longer includes bank data, verification evidence or private contact details.
- Farmer identity evidence is separated from normal public product uploads.
- Verification employee approval is constrained by area in the backend.
- Farmer reactivation does not automatically restore verified status.
- Production startup validates JWT, MongoDB, CORS frontend origin and Cloudinary verification-storage configuration.

## Notes

This changelog intentionally describes repository behavior rather than deployment-provider availability. Vercel/Render rate limits or provider outages are operational conditions and are not treated as source-code changes.
