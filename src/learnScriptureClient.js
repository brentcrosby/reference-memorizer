const DEFAULT_BASE_URL = "https://learnscripture.net";
const PROGRESS_ENDPOINT = "/api/dashboard/progress/";
const VERSES_ENDPOINT = "/api/dashboard/verses/";

const redact = (value) => (value ? "[redacted]" : "");

function normaliseBaseUrl(url) {
  if (!url) return DEFAULT_BASE_URL;
  return url.replace(/\/+$/, "");
}

function encodeBasicAuth(username, password) {
  if (!username && !password) return null;
  const raw = `${username || ""}:${password || ""}`;
  if (typeof btoa === "function") {
    return btoa(raw);
  }
  if (typeof Buffer !== "undefined") {
    return Buffer.from(raw, "utf8").toString("base64");
  }
  throw new Error("Unable to encode credentials");
}

function buildHeaders(config) {
  const headers = { Accept: "application/json" };
  if (config.apiToken) {
    headers.Authorization = `Token ${config.apiToken.trim()}`;
  } else if (config.username || config.password) {
    const encoded = encodeBasicAuth(config.username, config.password);
    if (encoded) headers.Authorization = `Basic ${encoded}`;
  }
  headers["Content-Type"] = "application/json";
  if (config.csrfToken) {
    headers["X-CSRFToken"] = config.csrfToken;
  }
  return headers;
}

async function request(config, path, options = {}) {
  const baseUrl = normaliseBaseUrl(config.baseUrl || DEFAULT_BASE_URL);
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    method: options.method || "GET",
    headers: { ...buildHeaders(config), ...(options.headers || {}) },
    credentials: "include",
    body: options.body ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });
  if (!response.ok) {
    const text = await response.text();
    const error = new Error(
      `LearnScripture request failed (${response.status}). ${text ? "Response: " + text : ""}`.trim(),
    );
    error.status = response.status;
    throw error;
  }
  const contentType = response.headers.get("content-type") || "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return null;
}

function extractReferences(payload) {
  if (!payload) return [];
  if (Array.isArray(payload)) {
    return payload.map((item) => item.reference || item.ref || item).filter(Boolean);
  }
  const collections = [payload.results, payload.items, payload.verses, payload.progress_items];
  const refs = [];
  collections.forEach((collection) => {
    if (Array.isArray(collection)) {
      collection.forEach((item) => {
        const ref = item?.reference || item?.ref || (typeof item === "string" ? item : null);
        if (ref) refs.push(ref);
      });
    }
  });
  if (payload.reference) refs.push(payload.reference);
  return Array.from(new Set(refs));
}

export function createLearnScriptureClient(rawConfig = {}) {
  const config = {
    baseUrl: normaliseBaseUrl(rawConfig.baseUrl || DEFAULT_BASE_URL),
    apiToken: rawConfig.apiToken?.trim() || "",
    username: rawConfig.username?.trim() || "",
    password: rawConfig.password || "",
    csrfToken: rawConfig.csrfToken?.trim() || "",
  };

  const hasAuth = Boolean(config.apiToken || (config.username && config.password));
  if (!hasAuth) {
    throw new Error("LearnScripture credentials are missing. Provide a token or username/password.");
  }

  return {
    async fetchCurrentVerses(options = {}) {
      const data = await request(config, PROGRESS_ENDPOINT, options);
      return extractReferences(data);
    },
    async postVerses(references, options = {}) {
      if (!Array.isArray(references) || references.length === 0) {
        throw new Error("No references provided to post to LearnScripture.");
      }
      const uniqueRefs = Array.from(new Set(references.filter(Boolean)));
      const payload = { references: uniqueRefs };
      const data = await request(config, VERSES_ENDPOINT, { method: "POST", body: payload, ...options });
      return data;
    },
  };
}

export function redactedSettings(settings = {}) {
  return {
    ...settings,
    apiToken: redact(settings.apiToken),
    password: redact(settings.password),
  };
}

export { DEFAULT_BASE_URL };
