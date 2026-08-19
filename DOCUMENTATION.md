# AgroConnect Documentation Index

This repository's documentation is organized around the code that currently exists on the `charan` branch.

## Start here

- [README.md](README.md) - project overview, local setup and deployment summary
- [ARCHITECTURE.md](ARCHITECTURE.md) - frontend/backend architecture and major data flows
- [USER_ROLES_AND_FLOWS.md](USER_ROLES_AND_FLOWS.md) - buyer, farmer, fertilizer seller, delivery, verification employee and admin workflows

## Development reference

- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) - REST API endpoints and access rules
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) - Mongoose models, fields and relationships
- [ENVIRONMENT_VARIABLES.md](ENVIRONMENT_VARIABLES.md) - client/server environment variables
- [IMPLEMENTATION_GUIDE.md](IMPLEMENTATION_GUIDE.md) - how the current features are implemented
- [TESTING_GUIDE.md](TESTING_GUIDE.md) - automated tests and manual QA scenarios
- [CONTRIBUTING.md](CONTRIBUTING.md) - development and contribution workflow

## Deployment and security

- [SETUP_AND_DEPLOYMENT.md](SETUP_AND_DEPLOYMENT.md) - local, Render, Vercel and provider setup
- [SECURITY.md](SECURITY.md) - authentication, privacy, verification evidence and secret-handling rules

## Project status/history

- [COMPLETION_REPORT.md](COMPLETION_REPORT.md) - current implemented status and known limitations
- [FIX_SUMMARY.md](FIX_SUMMARY.md) - major bug/security fixes and their purpose
- [CHANGELOG.md](CHANGELOG.md) - dated project changes

## Component-specific readmes

- [client/README.md](client/README.md) - React/Vite frontend
- [server/README.md](server/README.md) - Express/MongoDB backend

## Source-of-truth rule

If documentation and code ever disagree, treat the current code/tests as the implementation source of truth and update the documentation in the same change.
