# Security Policy

## Supported versions
This is a pre-1.0 prototype. Only the latest commit on the default branch receives fixes.

## Reporting a vulnerability
Please report privately using GitHub's **Security → Report a vulnerability** (private vulnerability reporting)
on this repository. Do not open a public issue or pull request for security problems.

Include: what is affected, steps to reproduce, impact, and a suggested fix if you have one.
We aim to acknowledge reports within 7 days. This is a volunteer project, so timelines are best-effort.

## Scope and guidance for deployers
- The app has **no built-in 2FA/SSO**. Run it behind HTTPS and your own access controls.
- Set `CART3R_API_KEY` to a long random value, a strong admin password, and `CART3R_SIMULATOR=off` in production.
- **Never send card numbers, CVV or other payment secrets** to the service.
- Back up the SQLite database and restrict who can read it: it contains customer identifiers and alert data.
- Keep Node.js and dependencies up to date.
