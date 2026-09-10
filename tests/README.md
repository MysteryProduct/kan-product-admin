# Admin auth regression checks

Run `npm test` (or `node --test tests/*.test.mjs`) from the Admin root. Tests load the actual TypeScript source with the installed TypeScript compiler and use Axios adapters with isolated cookie/window doubles. They cover 400/401/403, stale request responses, network failures, permission matching, profile restoration and missing Settings response data. These tests do not contact the real API or database.

For browser checks, start `node tests/browser-api-fixture.mjs`, then start Next with `NEXT_PUBLIC_API_URL=http://127.0.0.1:3041/` and `node node_modules/next/dist/bin/next dev --webpack --hostname 127.0.0.1 --port 3030`. Set the environment variable using the syntax of your shell. Open `http://127.0.0.1:3030/login`.

The disposable fixture accepts username `worker` and password `123`, demonstrating that the Admin no longer invents a six-character login restriction. It runs only on localhost, keeps state in memory, and never writes business records. Its token is a fixture identifier, not a JWT accepted by the real API.

Browser scenarios:

- A wrong password displays an error without reloading or clearing the login form.
- A successful login shows the employee username and enables mixed-case permission keys.
- Reload restores the session through `/auth/status`.
- Open `/admin/bank-account`, fill a draft and submit. The default 403 response keeps the session and draft.
- POST JSON to `http://127.0.0.1:3041/__test/control` to select `writeStatus: 400` for multiline validation errors, `statusMode: "unavailable"` for session-check retry, `statusMode: "expired"` for 401, or `allowMenus: false` for permission denial. These controls affect the fixture only.
- After restoring `statusMode: "normal"`, retry the failed session check with the keyboard.
- With `allowMenus: false`, direct navigation to `/admin/job-orders` or `/admin/license` shows the permission-denied state.
- Check affected error states at desktop/mobile sizes and in light/dark themes.

Stop both local processes after testing. No real employee credentials or production data are needed.
