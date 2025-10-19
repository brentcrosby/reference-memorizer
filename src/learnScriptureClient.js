const DEFAULT_BASE_URL = "https://learnscripture.net";

export const DEFAULT_LEARNSCRIPTURE_SETTINGS = Object.freeze({
  enabled: false,
  baseUrl: DEFAULT_BASE_URL,
  progressPath: "/api/dashboard/progress/",
  addVersePath: "/api/dashboard/progress/",
  apiToken: "",
  username: "",
  password: "",
});

function normaliseBaseUrl(baseUrl) {
  const url = (baseUrl || DEFAULT_BASE_URL).trim();
  if (!url) return DEFAULT_BASE_URL;
  return url.replace(/\/+$/, "");
}

function normalisePath(path, fallback) {
  const raw = (path || fallback || "").trim();
  if (!raw) return fallback;
  return raw.startsWith("/") ? raw : `/${raw}`;
}

function buildUrl(baseUrl, path, fallback) {
  const normalisedBase = normaliseBaseUrl(baseUrl);
  const normalisedPath = normalisePath(path, fallback);
  try {
    return new URL(normalisedPath, normalisedBase).toString();
  } catch {
    return `${normalisedBase}${normalisedPath}`;
  }
}

function createAuthHeader({ apiToken, username, password }) {
  const headers = {};
  const token = (apiToken || "").trim();
  const user = (username || "").trim();
  const pass = (password || "").trim();
  if (token) {
    headers["Authorization"] = `Token ${token}`;
  } else if (user && pass) {
    if (typeof btoa === "function") {
      headers["Authorization"] = `Basic ${btoa(`${user}:${pass}`)}`;
    }
  }
  return headers;
}

function coerceArray(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return [value];
}

function extractReferenceCandidates(payload) {
  const collected = new Set();
  const pushMaybe = (val) => {
    if (typeof val !== "string") return;
    const trimmed = val.trim();
    if (trimmed) collected.add(trimmed);
  };
  const inspectItem = (item) => {
    if (!item) return;
    if (typeof item === "string") {
      pushMaybe(item);
      return;
    }
    if (typeof item === "object") {
      const keys = ["reference", "ref", "verse", "name", "title"];
      for (const key of keys) {
        if (typeof item[key] === "string") pushMaybe(item[key]);
      }
      if (Array.isArray(item.references)) {
        item.references.forEach((ref) => pushMaybe(ref));
      }
    }
  };
  if (Array.isArray(payload)) {
    payload.forEach(inspectItem);
  } else if (payload && typeof payload === "object") {
    const keys = ["results", "data", "items", "verses", "passages", "progress"];
    for (const key of keys) {
      coerceArray(payload[key]).forEach(inspectItem);
    }
    if (payload.current) inspectItem(payload.current);
  }
  return Array.from(collected);
}

async function parseJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("LearnScripture response was not valid JSON.");
  }
}

export function createLearnScriptureClient(settings = {}) {
  const merged = {
    ...DEFAULT_LEARNSCRIPTURE_SETTINGS,
    ...settings,
  };
  const progressUrl = buildUrl(merged.baseUrl, merged.progressPath, DEFAULT_LEARNSCRIPTURE_SETTINGS.progressPath);
  const addVerseUrl = buildUrl(merged.baseUrl, merged.addVersePath, merged.progressPath);
  const authHeaders = createAuthHeader(merged);
  const hasAuth = Boolean(authHeaders.Authorization);

  async function performRequest(url, options = {}) {
    const headers = {
      Accept: "application/json",
      ...authHeaders,
      ...options.headers,
    };
    const response = await fetch(url, {
      credentials: "omit",
      cache: "no-store",
      ...options,
      headers,
    });
    if (response.status === 401 || response.status === 403) {
      throw new Error("LearnScripture authentication failed (401/403).");
    }
    if (!response.ok) {
      throw new Error(`LearnScripture request failed (${response.status}).`);
    }
    return response;
  }

  async function fetchCurrentVerses() {
    if (!hasAuth) throw new Error("LearnScripture credentials or token are missing.");
    const response = await performRequest(progressUrl, {
      method: "GET",
    });
    const json = await parseJsonResponse(response);
    return extractReferenceCandidates(json);
  }

  async function addVerse(reference) {
    if (!hasAuth) throw new Error("LearnScripture credentials or token are missing.");
    const clean = String(reference || "").trim();
    if (!clean) throw new Error("No reference provided to send to LearnScripture.");
    await performRequest(addVerseUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference: clean }),
    });
    return true;
  }

  return {
    isConfigured: Boolean(merged.enabled && hasAuth),
    fetchCurrentVerses,
    addVerse,
  };
}

