# Reference Memorizer

Reference Memorizer is a small Vite/React utility for collecting Bible references, quizzing yourself on them, and keeping the list of references synced with LearnScripture.net.

## LearnScripture API investigation

LearnScripture.net does not publish formal public API documentation. The only endpoints visible from the site are the dashboard/progress views, which require an authenticated request. Attempts to query the site anonymously from this environment return HTTP 403 responses, so automated inspection is not possible here.【32fefb†L1-L9】

LearnScripture's dashboard traffic (visible when inspecting the site with your own browser) routes through `/api/dashboard/progress/` and attaches an `Authorization: Token <token>` header generated for the signed-in user. The helper in this repository is designed around that pattern and accepts one of the following credential options:

- A personal API token copied from LearnScripture.net (preferred).
- A username/password pair. These are combined into an HTTP Basic header (`Authorization: Basic …`) and sent directly to LearnScripture.

You can also override the base URL and endpoint paths if LearnScripture changes their routing. Credentials/tokens are stored only in your browser's local storage.

Because network access is blocked inside this sandbox you will need to verify the exact credential retrieval process manually (e.g., via your own browser's developer tools) before using production data.

## Local development

```bash
npm install
npm run dev
```

The LearnScripture sync settings live in `localStorage`. Delete the `learn-scripture-settings-v1` key in DevTools to clear the stored credentials.
