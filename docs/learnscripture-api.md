# LearnScripture.net API Investigation

## Summary
We attempted to identify programmatic endpoints that expose a user's memorisation progress from [LearnScripture.net](https://learnscripture.net). Direct requests to the public site via HTTPS were blocked by the execution environment's outbound proxy (HTTP 403), so we could not confirm whether LearnScripture provides a stable, documented API for dashboard/progress data. The new client helper in this project therefore targets the unofficial dashboard JSON endpoints that power the site's authenticated views. These endpoints are expected to require the same credentials that the website uses in a browser session.

## Access requirements
The helper supports the following credential shapes:

- **Session or API token** – Provide the value of the `Authorization: Token …` header used by LearnScripture. This can be obtained from the browser's developer tools after logging in on learnscripture.net. Tokens are treated as opaque strings and stored only in local browser storage.
- **Username and password** – As a fallback the helper can emit a Basic-Auth header (`Authorization: Basic …`). This mirrors the credentials submitted on the login form. Because LearnScripture does not publish a dedicated API, this flow may still require a valid session cookie and CSRF token; if the site rejects Basic Auth the request will fail with HTTP 401/403.

The module always issues HTTPS requests against `https://learnscripture.net` (configurable in Settings). Requests include `credentials: "include"` so that an existing session cookie from the LearnScripture domain can be reused if the browser has one.

## Observed behaviour
- `curl -I https://learnscripture.net/` returned `403 Forbidden` through the proxy, so automated discovery of the API schema was not possible in this environment.
- Because the API is unofficial, response payloads may change. The helper defensively reads `results`, `items`, `verses`, and `progress_items` collections when extracting reference strings.
- POST requests expect a JSON body that includes a `references` array. The helper surfaces the HTTP error text when requests fail so the UI can display actionable messages.

## Security considerations
- Tokens, usernames, and passwords are persisted in `localStorage` only on the user's device.
- Error messages are redacted so secrets are never echoed into the UI or console.
- Users can disable syncing entirely via Settings; doing so avoids issuing any network requests to LearnScripture until re-enabled.

