import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createLearnScriptureClient, DEFAULT_BASE_URL } from "./learnScriptureClient";

function canonicalizeRef(s) {
  return (s || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\./g, "")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*;\s*/g, ";")
    .replace(/\s*\-\s*/g, "-")
    .replace(/\s/g, " ");
}

function canonicalizeRefInitial(s) {
  const norm = canonicalizeRef(s);
  const m = norm.match(/^([1-3]?\s*[a-z]+)(.*)$/i);
  if (!m) return norm;
  const book = m[1].trim();
  const rest = m[2] || "";
  return (book[0] || "") + rest;
}

function refsMatch(userGuess, actualRef, useInitialMode) {
  const g = useInitialMode ? canonicalizeRefInitial(userGuess) : canonicalizeRef(userGuess);
  const a = useInitialMode ? canonicalizeRefInitial(actualRef) : canonicalizeRef(actualRef);
  return g === a;
}

function getBookFromRef(ref) {
  const s = String(ref || "").trim();
  if (!s) return "";
  const parts = s.split(" ").filter(Boolean);
  const hasAnyDigit = (str) => Array.from(str).some((ch) => ch >= "0" && ch <= "9");
  const isOneTwoThree = (t) => t === "1" || t === "2" || t === "3";
  let bookParts = [];
  let i = 0;
  if (parts[0] && isOneTwoThree(parts[0]) && parts[1] && !hasAnyDigit(parts[1])) {
    bookParts.push(parts[0], parts[1]);
    i = 2;
  } else if (parts[0]) {
    bookParts.push(parts[0]);
    i = 1;
  }
  while (i < parts.length && !hasAnyDigit(parts[i])) {
    bookParts.push(parts[i]);
    i++;
  }
  return bookParts.join(" ");
}

function parseTarget(currentRef) {
  const book = getBookFromRef(currentRef);
  const s = String(currentRef || "");
  if (!book) return { book: "", cStr: "", vStr: "", eStr: "" };
  const bookPrefix = book + " ";
  let startIdx = s.toLowerCase().indexOf(bookPrefix.toLowerCase());
  if (startIdx < 0) startIdx = s.toLowerCase().indexOf(book.toLowerCase());
  let scan = startIdx >= 0 ? startIdx + book.length : 0;
  while (scan < s.length && s.charCodeAt(scan) === 32) scan++;
  let i = scan;
  const n = s.length;
  while (i < n) {
    const cc = s.charCodeAt(i);
    if (!(cc >= 48 && cc <= 57)) break;
    i++;
  }
  const cStr = s.slice(scan, i);
  let vStr = "";
  let eStr = "";
  if (i < n && s[i] === ":") {
    let j = i + 1;
    while (j < n) {
      const ccj = s.charCodeAt(j);
      if (!(ccj >= 48 && ccj <= 57)) break;
      j++;
    }
    vStr = s.slice(i + 1, j);
    if (j < n && s[j] === "-") {
      let k = j + 1;
      while (k < n) {
        const cck = s.charCodeAt(k);
        if (!(cck >= 48 && cck <= 57)) break;
        k++;
      }
      eStr = s.slice(j + 1, k);
    }
  }
  return { book, cStr, vStr, eStr };
}

function smartFormatInput(raw, currentRef, modeInitial, inQuiz) {
  let val = String(raw == null ? "" : raw);
  if (!inQuiz) return val;
  const { book, cStr, vStr, eStr } = parseTarget(currentRef);
  if (!book) return val;
  let prefix = book + " ";
  let hasPrefix = val.toLowerCase().indexOf(prefix.toLowerCase()) === 0;
  let lead = 0;
  while (lead < val.length && val.charAt(lead) === " ") lead++;
  const trimmed = val.slice(lead);
  if (modeInitial && !hasPrefix && trimmed.length === 1) {
    const firstChar = trimmed[0].toLowerCase();
    const bookFirst = book[0].toLowerCase();
    if (firstChar === bookFirst) {
      val = new Array(lead + 1).join(" ") + book + " ";
      hasPrefix = true;
    }
  }
  if (!modeInitial && !hasPrefix && trimmed.length >= 1) {
    const firstChar2 = trimmed[0].toLowerCase();
    const bookFirst2 = book[0].toLowerCase();
    const rest2 = trimmed.slice(1);
    const restDigitsOnly2 = rest2.split("").every((ch) => {
      const c = ch.charCodeAt(0);
      return !(ch && (c < 48 || c > 57));
    });
    if (firstChar2 === bookFirst2 && restDigitsOnly2) {
      val = new Array(lead + 1).join(" ") + book + " " + rest2;
      hasPrefix = true;
    }
  }
  prefix = book + " ";
  if (val.toLowerCase().indexOf(prefix.toLowerCase()) === 0) {
    const after = val.slice(prefix.length);
    if (after.indexOf(" ") === -1 && after.indexOf("\t") === -1) {
      const digits = after
        .split("")
        .filter((ch) => {
          const c = ch.charCodeAt(0);
          return c >= 48 && c <= 57;
        })
        .join("");
      if (digits.length > 0 && cStr) {
        const cLen = cStr.length;
        if (digits.length <= cLen) {
          const chapTyped = digits;
          const chapOkPrefix = cStr.slice(0, chapTyped.length) === chapTyped;
          if (!chapOkPrefix) return prefix + digits;
          if (digits.length === cLen) {
            if (!vStr) return prefix + cStr;
            return prefix + cStr + ":";
          }
          return prefix + digits;
        }
        const chap = digits.slice(0, cLen);
        if (chap !== cStr) return prefix + digits;
        const rest1 = digits.slice(cLen);
        if (!vStr) return prefix + cStr + rest1;
        const vLen = vStr.length;
        if (rest1.length <= vLen) {
          const verseTyped = rest1;
          const verseOkPrefix = vStr.slice(0, verseTyped.length) === verseTyped;
          if (!verseOkPrefix) return prefix + cStr + ":" + rest1;
          if (rest1.length === vLen) {
            if (eStr) return prefix + cStr + ":" + vStr + "-";
            return prefix + cStr + ":" + vStr;
          }
          return prefix + cStr + ":" + rest1;
        }
        const rest2 = rest1.slice(vLen);
        if (rest1.slice(0, vLen) !== vStr) {
          return prefix + cStr + ":" + rest1;
        }
        if (eStr) {
          const endTyped = rest2;
          const endOkPrefix = eStr.slice(0, endTyped.length) === endTyped;
          if (!endOkPrefix) return prefix + cStr + ":" + vStr + "-" + endTyped;
          if (endTyped.length === eStr.length) return prefix + cStr + ":" + vStr + "-" + eStr;
          return prefix + cStr + ":" + vStr + "-" + endTyped;
        }
        return prefix + cStr + ":" + vStr + rest2;
      }
    }
    const toks = after.trim().split(/\s+/).filter(Boolean);
    const isDigits = (s2) =>
      s2 &&
      s2.split("").every((ch) => {
        const c = ch.charCodeAt(0);
        return c >= 48 && c <= 57;
      });
    if (toks.length === 2 && isDigits(toks[0]) && isDigits(toks[1])) return prefix + toks[0] + ":" + toks[1];
    if (toks.length === 3 && isDigits(toks[0]) && isDigits(toks[1]) && isDigits(toks[2]))
      return prefix + toks[0] + ":" + toks[1] + "-" + toks[2];
  }
  return val;
}

const BOOKS = [
  { n: "Genesis", t: "OT" },
  { n: "Exodus", t: "OT" },
  { n: "Leviticus", t: "OT" },
  { n: "Numbers", t: "OT" },
  { n: "Deuteronomy", t: "OT" },
  { n: "Joshua", t: "OT" },
  { n: "Judges", t: "OT" },
  { n: "Ruth", t: "OT" },
  { n: "1 Samuel", t: "OT" },
  { n: "2 Samuel", t: "OT" },
  { n: "1 Kings", t: "OT" },
  { n: "2 Kings", t: "OT" },
  { n: "1 Chronicles", t: "OT" },
  { n: "2 Chronicles", t: "OT" },
  { n: "Ezra", t: "OT" },
  { n: "Nehemiah", t: "OT" },
  { n: "Esther", t: "OT" },
  { n: "Job", t: "OT" },
  { n: "Psalm", t: "OT" },
  { n: "Psalms", t: "OT" },
  { n: "Proverbs", t: "OT" },
  { n: "Ecclesiastes", t: "OT" },
  { n: "Song of Solomon", t: "OT" },
  { n: "Isaiah", t: "OT" },
  { n: "Jeremiah", t: "OT" },
  { n: "Lamentations", t: "OT" },
  { n: "Ezekiel", t: "OT" },
  { n: "Daniel", t: "OT" },
  { n: "Hosea", t: "OT" },
  { n: "Joel", t: "OT" },
  { n: "Amos", t: "OT" },
  { n: "Obadiah", t: "OT" },
  { n: "Jonah", t: "OT" },
  { n: "Micah", t: "OT" },
  { n: "Nahum", t: "OT" },
  { n: "Habakkuk", t: "OT" },
  { n: "Zephaniah", t: "OT" },
  { n: "Haggai", t: "OT" },
  { n: "Zechariah", t: "OT" },
  { n: "Malachi", t: "OT" },
  { n: "Matthew", t: "NT" },
  { n: "Mark", t: "NT" },
  { n: "Luke", t: "NT" },
  { n: "John", t: "NT" },
  { n: "Acts", t: "NT" },
  { n: "Romans", t: "NT" },
  { n: "1 Corinthians", t: "NT" },
  { n: "2 Corinthians", t: "NT" },
  { n: "Galatians", t: "NT" },
  { n: "Ephesians", t: "NT" },
  { n: "Philippians", t: "NT" },
  { n: "Colossians", t: "NT" },
  { n: "1 Thessalonians", t: "NT" },
  { n: "2 Thessalonians", t: "NT" },
  { n: "1 Timothy", t: "NT" },
  { n: "2 Timothy", t: "NT" },
  { n: "Titus", t: "NT" },
  { n: "Philemon", t: "NT" },
  { n: "Hebrews", t: "NT" },
  { n: "James", t: "NT" },
  { n: "1 Peter", t: "NT" },
  { n: "2 Peter", t: "NT" },
  { n: "1 John", t: "NT" },
  { n: "2 John", t: "NT" },
  { n: "3 John", t: "NT" },
  { n: "Jude", t: "NT" },
  { n: "Revelation", t: "NT" }
];
const BOOK_TO_TESTAMENT = Object.fromEntries(BOOKS.map((b) => [b.n.toLowerCase(), b.t]));
function whichTestament(ref) {
  const book = (ref || "").match(/^[1-3]?\s*[A-Za-z ]+/);
  if (!book) return "UNK";
  const k = book[0].replace(/\s+/g, " ").trim().toLowerCase();
  return BOOK_TO_TESTAMENT[k] || "UNK";
}

const LS_KEY = "bible-quiz-references-v1";
const LS_SYNC_KEY = "reference-memorizer-learnscripture-settings-v1";



const loadRefs = () => {
  try {
    const stored = JSON.parse(localStorage.getItem(LS_KEY) || "[]");
    if (stored.length > 0) return stored;
  } catch {}
  return [
    "Deuteronomy 32:4",
    "Psalm 1:1-3",
    "Psalm 5:4",
    "Psalm 14:1-3",
    "Psalm 16:8-11",
    "Psalm 27:1",
    "Psalm 27:4",
    "Psalm 33:5",
    "Psalm 34:1",
    "Psalm 37:8",
    "Psalm 41:12",
    "Psalm 55:22",
    "Psalm 66:7",
    "Psalm 96:4",
    "Psalm 100:5",
    "Psalm 101:3-4",
    "Psalm 102:27",
    "Psalm 103:8",
    "Psalm 103:9-10",
    "Psalm 104:33-34",
    "Psalm 105:4-5",
    "Psalm 117",
    "Proverbs 3:5-7",
    "Proverbs 4:23",
    "Proverbs 8:13",
    "Proverbs 13:20",
    "Proverbs 16:17-18",
    "Isaiah 6:3",
    "Isaiah 64:6",
    "Daniel 4:34",
    "Malachi 3:6",
    "Matthew 4:4",
    "Matthew 5:43-44",
    "Matthew 6:31-34",
    "John 6:44",
    "John 14:6",
    "Romans 11:33",
    "Romans 13:14",
    "Romans 15:4",
    "1 Corinthians 6:17-20",
    "1 Corinthians 10:13",
    "1 Corinthians 10:31",
    "1 Corinthians 13:1-3",
    "1 Corinthians 13:4-7",
    "2 Corinthians 12:9",
    "Galatians 1:9-10",
    "Galatians 2:20",
    "Galatians 5:16-17",
    "Galatians 6:7-9",
    "Ephesians 1:11",
    "Ephesians 2:1-3",
    "Ephesians 2:4-7",
    "Ephesians 2:8-10",
    "Ephesians 4:1-3",
    "Ephesians 4:4-6",
    "Ephesians 5:18",
    "Philippians 1:21",
    "Philippians 4:4-7",
    "Philippians 4:8-9",
    "Colossians 1:13-16",
    "Colossians 1:17-20",
    "Colossians 3:1-3",
    "Colossians 3:4-7",
    "Colossians 3:8-11",
    "Colossians 3:12-14",
    "Colossians 3:15-17",
    "Colossians 4:6",
    "1 Thessalonians 5:16-18",
    "1 Thessalonians 5:19-22",
    "Hebrews 4:15-16",
    "Hebrews 12:1-2",
    "James 1:2-4",
    "James 1:19-20",
    "1 Peter 3:15-16",
    "1 Peter 4:16",
    "1 Peter 5:8",
    "1 John 2:5",
    "1 John 3:23-24",
    "1 John 4:7-8"
  ];
};
const saveRefs = (arr) => localStorage.setItem(LS_KEY, JSON.stringify(arr));

const DEFAULT_LS_SETTINGS = {
  enabled: false,
  baseUrl: DEFAULT_BASE_URL,
  apiToken: "",
  username: "",
  password: "",
  csrfToken: "",
};

const loadLearnSettings = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(LS_SYNC_KEY) || "{}") || {};
    return { ...DEFAULT_LS_SETTINGS, ...raw };
  } catch {
    return { ...DEFAULT_LS_SETTINGS };
  }
};

const saveLearnSettings = (settings) => {
  localStorage.setItem(LS_SYNC_KEY, JSON.stringify(settings));
};

function stripHtml(html) {
  const tmp = document.createElement("div");
  tmp.innerHTML = html || "";
  return tmp.textContent || tmp.innerText || "";
}

async function fetchNASB(reference, apiKey, bibleId) {
  const base = "https://api.scripture.api.bible/v1";
  const headers = { "api-key": apiKey };
  const searchUrl = `${base}/bibles/${bibleId}/search?query=${encodeURIComponent(reference)}&limit=1`;
  const sRes = await fetch(searchUrl, { headers });
  if (!sRes.ok) throw new Error("NASB search failed");
  const sData = await sRes.json();
  const match = sData?.data?.verses?.[0] || sData?.data?.passages?.[0];
  if (!match?.id) throw new Error("NASB verse not found");
  const verseId = match.id;
  const vUrl = `${base}/bibles/${bibleId}/verses/${verseId}?content-type=text&include-verse-numbers=false&include-headings=false&include-footnotes=false`;
  const vRes = await fetch(vUrl, { headers });
  if (!vRes.ok) throw new Error("NASB verse fetch failed");
  const vData = await vRes.json();
  const content = vData?.data?.content || "";
  return stripHtml(content).replace(/\s+/g, " ").trim();
}

async function fetchVerseText(reference, translation = "kjv", apiBible) {
  if (translation === "nasb") {
    const apiKey = apiBible?.apiKey;
    const bibleId = apiBible?.bibleId;
    if (!apiKey || !bibleId) return "NASB requires an API.Bible key and Bible ID. Open Settings and provide them.";
    try {
      return await fetchNASB(reference, apiKey, bibleId);
    } catch {
      return "Couldn't fetch NASB text (API error). Check Settings and the reference format.";
    }
  }
  const url = `https://bible-api.com/${encodeURIComponent(reference)}?translation=${translation}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Unable to fetch verse text");
  const data = await res.json();
  if (Array.isArray(data.verses)) {
    return data.verses.map((v) => v.text.trim()).join(" ").replace(/\s+/g, " ").trim();
  }
  return data.text || "";
}

function Tag({ children }) {
  return <span className="px-2 py-0.5 rounded-full text-xs bg-gray-100 border border-gray-200">{children}</span>;
}
function SectionTitle({ children }) {
  return <h2 className="text-lg font-semibold mb-2">{children}</h2>;
}
function Stat({ label, value }) {
  return (
    <div className="p-3 rounded-2xl bg-white shadow border">
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    document.title = "Reference Memorizer";
  }, []);
  const [modeInitial, setModeInitial] = useState(true);
  const [refs, setRefs] = useState(loadRefs());
  const [learnSettings, setLearnSettings] = useState(loadLearnSettings);
  const [syncState, setSyncState] = useState({ status: "idle", message: "", timestamp: null });
  const [pushState, setPushState] = useState({ status: "idle", message: "", timestamp: null });
  const [syncing, setSyncing] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [newRef, setNewRef] = useState("");
  const [translation, setTranslation] = useState("kjv");
  const [filter, setFilter] = useState("ALL");
  const [showSettings, setShowSettings] = useState(false);
  
  
  const [quizOrder, setQuizOrder] = useState([]);
  const [idx, setIdx] = useState(0);
  const [verseText, setVerseText] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState("");
  const [attemptsLeft, setAttemptsLeft] = useState(2);
  const [feedback, setFeedback] = useState(null);
  const [showManager, setShowManager] = useState(true);
  const [revealRef, setRevealRef] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const answerRef = useRef(null);
  const initialSyncAttemptRef = useRef(false);
  useEffect(() => {
    saveRefs(refs);
  }, [refs]);
  useEffect(() => {
    saveLearnSettings(learnSettings);
  }, [learnSettings]);

  const hasLearnCredentials = useMemo(() => {
    return Boolean(learnSettings.apiToken || (learnSettings.username && learnSettings.password));
  }, [learnSettings]);
  const canSyncLearnScripture = learnSettings.enabled && hasLearnCredentials;

  const updateLearnSettings = useCallback((patch) => {
    setLearnSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const formatTimestamp = (ts) => {
    if (!ts) return "";
    const date = new Date(ts);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleTimeString();
  };

  const redactSecrets = useCallback(
    (message) => {
      if (!message) return "";
      const secrets = [learnSettings.apiToken, learnSettings.password, learnSettings.csrfToken];
      let safe = message;
      secrets.forEach((secret) => {
        if (!secret) return;
        const escaped = secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        safe = safe.replace(new RegExp(escaped, "g"), "[redacted]");
      });
      return safe;
    },
    [learnSettings.apiToken, learnSettings.password, learnSettings.csrfToken],
  );

  const importFromLearnScripture = useCallback(
    async ({ silent } = {}) => {
      if (!learnSettings.enabled) {
        if (!silent) {
          setSyncState({ status: "disabled", message: "LearnScripture sync is disabled.", timestamp: Date.now() });
        }
        return;
      }
      if (!hasLearnCredentials) {
        setSyncState({
          status: "error",
          message: "Provide a token or username/password before syncing with LearnScripture.",
          timestamp: Date.now(),
        });
        return;
      }
      setSyncing(true);
      setSyncState({ status: "pending", message: "Syncing with LearnScripture…", timestamp: Date.now() });
      try {
        const client = createLearnScriptureClient(learnSettings);
        const remoteRefs = await client.fetchCurrentVerses();
        const safeRefs = Array.isArray(remoteRefs) ? remoteRefs : [];
        let newCount = 0;
        setRefs((prev) => {
          const nextSet = new Set(prev);
          safeRefs.forEach((ref) => {
            const clean = String(ref || "").trim();
            if (!clean) return;
            if (!nextSet.has(clean)) {
              newCount += 1;
              nextSet.add(clean);
            }
          });
          return Array.from(nextSet);
        });
        const successMessage =
          newCount > 0 ? `Imported ${newCount} new references.` : "No new references found on LearnScripture.";
        setSyncState({ status: "success", message: successMessage, timestamp: Date.now() });
      } catch (error) {
        setSyncState({
          status: "error",
          message: redactSecrets(error?.message) || "Sync failed. Check your LearnScripture credentials.",
          timestamp: Date.now(),
        });
      } finally {
        setSyncing(false);
      }
    },
    [learnSettings, hasLearnCredentials],
  );

  const pushToLearnScripture = useCallback(async () => {
    if (!learnSettings.enabled) {
      setPushState({ status: "disabled", message: "Enable LearnScripture sync before exporting.", timestamp: Date.now() });
      return;
    }
    if (!hasLearnCredentials) {
      setPushState({
        status: "error",
        message: "Provide a token or username/password before exporting to LearnScripture.",
        timestamp: Date.now(),
      });
      return;
    }
    if (!refs.length) {
      setPushState({ status: "error", message: "No references to export.", timestamp: Date.now() });
      return;
    }
    setPushing(true);
    setPushState({ status: "pending", message: "Uploading references to LearnScripture…", timestamp: Date.now() });
    try {
      const client = createLearnScriptureClient(learnSettings);
      const uniqueRefs = Array.from(new Set(refs));
      await client.postVerses(uniqueRefs);
      const message = `Exported ${uniqueRefs.length} references to LearnScripture.`;
      setPushState({ status: "success", message, timestamp: Date.now() });
      await importFromLearnScripture({ silent: true });
    } catch (error) {
      setPushState({
        status: "error",
        message: redactSecrets(error?.message) || "Export failed. Check your LearnScripture credentials.",
        timestamp: Date.now(),
      });
    } finally {
      setPushing(false);
    }
  }, [learnSettings, hasLearnCredentials, refs, importFromLearnScripture]);

  useEffect(() => {
    if (initialSyncAttemptRef.current) return;
    if (!canSyncLearnScripture) return;
    initialSyncAttemptRef.current = true;
    importFromLearnScripture();
  }, [canSyncLearnScripture, importFromLearnScripture]);


  const filteredRefs = useMemo(() => {
    if (filter === "ALL") return refs;
    return refs.filter((r) => whichTestament(r) === filter);
  }, [refs, filter]);
  function addRef() {
    const clean = newRef.trim();
    if (!clean) return;
    setRefs((prev) => Array.from(new Set([...prev, clean])));
    setNewRef("");
  }
  function removeRef(rm) {
    setRefs((prev) => prev.filter((r) => r !== rm));
  }
  function shuffle(array) {
    const a = array.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }
  async function startQuiz() {
    if (filteredRefs.length === 0) return;
    const order = shuffle([...Array(filteredRefs.length).keys()]);
    setQuizOrder(order);
    setIdx(0);
    setAttemptsLeft(2);
    setFeedback(null);
    setAnswer("");
    setRevealRef(false);
    setShowSolution(false);
    setShowManager(false);
    await loadCurrentVerse(order[0]);
    setTimeout(() => answerRef.current?.focus(), 0);
  }
  async function loadCurrentVerse(orderIndex) {
    const ref = filteredRefs[orderIndex];
    if (!ref) return;
    setLoading(true);
    try {
      const txt = await fetchVerseText(ref, translation);
      setVerseText(txt);
    } catch {
      setVerseText("Error fetching verse. Check your reference format.");
    } finally {
      setLoading(false);
    }
  }
  async function nextItem() {
    const next = idx + 1;
    if (next >= quizOrder.length) {
      setFeedback(null);
      setShowManager(true);
      return;
    }
    setIdx(next);
    setAttemptsLeft(2);
    setFeedback(null);
    setAnswer("");
    setRevealRef(false);
    setShowSolution(false);
    await loadCurrentVerse(quizOrder[next]);
    setTimeout(() => answerRef.current?.focus(), 0);
  }
  function checkAnswer() {
    const currentRef = filteredRefs[quizOrder[idx]] || "";
    const guess = answer;
    if (!guess) return;
    if (refsMatch(guess, currentRef, modeInitial)) {
      setFeedback("correct");
      setTimeout(() => nextItem(), 700);
    } else {
      if (attemptsLeft > 1) {
        setAttemptsLeft(attemptsLeft - 1);
        setFeedback("wrong");
        setTimeout(() => setFeedback(null), 600);
      } else {
        setAttemptsLeft(0);
        setFeedback("wrong");
        setShowSolution(true);
        setRevealRef(true);
      }
    }
  }
  const inQuiz = quizOrder.length > 0 && !showManager;
  function handleAnswerChange(e) {
    const currentRef = filteredRefs[quizOrder[idx]] || "";
    const newVal = smartFormatInput(e.target.value, currentRef, modeInitial, inQuiz);
    setAnswer(newVal);
  }
  function handleAnswerKeyDown(e) {
    const currentRef = filteredRefs[quizOrder[idx]] || "";
    const { book, cStr, vStr } = parseTarget(currentRef);
    if (!inQuiz || !book) return;
    const prefix = book + " ";
    const val = answer || "";
    const lowerVal = val.toLowerCase();
    if (lowerVal.indexOf(prefix.toLowerCase()) !== 0) return;
    let lock = prefix.length;
    if (cStr) {
      const chapDone = prefix + cStr + ":";
      if (lowerVal.startsWith(chapDone.toLowerCase())) {
        lock = Math.max(lock, chapDone.length);
      } else {
        const justChap = prefix + cStr;
        if (lowerVal.startsWith(justChap.toLowerCase())) lock = Math.max(lock, justChap.length);
      }
    }
    if (vStr) {
      const verseDone = prefix + cStr + ":" + vStr;
      if (lowerVal.startsWith(verseDone.toLowerCase())) {
        lock = Math.max(lock, verseDone.length);
      }
    }
    const start = e.currentTarget.selectionStart ?? 0;
    const end = e.currentTarget.selectionEnd ?? 0;
    const key = e.key;
    if ((key === "Backspace" && start <= lock && end <= lock) || (key === "Delete" && start < lock)) {
      e.preventDefault();
      requestAnimationFrame(() => {
        try {
          e.currentTarget.setSelectionRange(lock, lock);
        } catch {}
      });
      return;
    }
    if (key.length === 1 && start < lock) {
      e.preventDefault();
      const next = val.slice(0, lock) + key + val.slice(lock);
      setAnswer(next);
      requestAnimationFrame(() => {
        try {
          e.currentTarget.setSelectionRange(lock + 1, lock + 1);
        } catch {}
      });
    }
  }
  const progress = inQuiz ? Math.round((idx / quizOrder.length) * 100) : 0;
  useEffect(() => {
    try {
      console.groupCollapsed("Reference Memorizer – Dev tests");
      console.assert(refsMatch("j 3:16", "John 3:16", true) === true, "Initial: j 3:16 vs John 3:16 should match");
      console.assert(refsMatch("john 3:16", "John 3:16", false) === true, "Full: john 3:16 vs John 3:16 should match");
      console.assert(refsMatch("1 10:13", "1 Corinthians 10:13", true) === true, "Initial: 1 10:13 vs 1 Corinthians 10:13 should match");
      console.assert(getBookFromRef("1 Corinthians 10:13") === "1 Corinthians", "Book extraction (numbered)");
      console.assert(getBookFromRef("John 3:16") === "John", "Book extraction (simple)");
      console.assert(smartFormatInput("j", "John 3:16", true, true) === "John ", "Type 'j' expands to 'John '");
      console.assert(smartFormatInput("John 3 16", "John 3:16", false, true) === "John 3:16", "Auto colon");
      console.assert(smartFormatInput("John 3 16 18", "John 3:16-18", false, true) === "John 3:16-18", "Auto hyphen span");
      console.assert(smartFormatInput("1", "1 Corinthians 10:13", true, true) === "1 Corinthians ", "Type '1' expands to '1 Corinthians '");
      console.assert(smartFormatInput("p103", "Psalm 103:8", true, true) === "Psalm 103:", "Colon only when chapter matches");
      console.assert(smartFormatInput("p102", "Psalm 103:8", true, true) === "Psalm 102", "No colon on wrong chapter");
      console.assert(smartFormatInput("p1038", "Psalm 103:8-11", true, true) === "Psalm 103:8-", "Hyphen only after exact verse");
      console.assert(smartFormatInput("2", "2 Corinthians 12:9", true, true) === "2 Corinthians ", "2 expands to numbered book");
      console.assert(smartFormatInput("129", "2 Corinthians 12:9", true, true) === "2 Corinthians 12:9", "Digits map (129) → 12:9");
      console.assert(whichTestament("Romans 8:28") === "NT", "Testament detection NT");
      console.log("All dev tests queued. If no assertion errors appear, helpers are OK.");
    } catch (e) {
      console.error("Dev tests error:", e);
    } finally {
      console.groupEnd();
    }
  }, []);
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="sticky top-0 z-10 backdrop-blur bg-white/80 border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white grid place-items-center font-bold">RM</div>
          <div className="flex-1">
            <h1 className="text-lg font-semibold leading-tight">Reference Memorizer</h1>
            <div className="text-xs text-gray-500">Add references → study by verse → type the reference. Two tries each.</div>
          </div>
          <div className="flex items-center gap-2">
            <select className="border rounded-xl px-2 py-1 text-sm" value={translation} onChange={(e) => setTranslation(e.target.value)}>
              <option value="kjv">KJV</option>
              <option value="web">WEB</option>
              <option value="asv">ASV</option>
                          </select>
            <select className="border rounded-xl px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="ALL">All</option>
              <option value="OT">Old Testament</option>
              <option value="NT">New Testament</option>
            </select>
            <button className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm" onClick={() => setShowSettings((v) => !v)}>
              Settings
            </button>
            {inQuiz ? (
              <button
                className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm"
                onClick={() => {
                  setShowManager(true);
                  setQuizOrder([]);
                }}
              >
                End
              </button>
            ) : (
              <button className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm" onClick={startQuiz} disabled={filteredRefs.length === 0}>
                Start Quiz
              </button>
            )}
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto p-4">
        {showSettings && (
          <div className="mb-4 p-4 bg-white rounded-2xl shadow border">
            <SectionTitle>Settings</SectionTitle>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Mode</div>
                <select className="w-full border rounded-xl px-3 py-2" value={modeInitial ? "initial" : "full"} onChange={(e) => setModeInitial(e.target.value === "initial")}>
                  <option value="initial">First Letter Mode (default)</option>
                  <option value="full">Full Reference Mode</option>
                </select>
              </label>
            </div>
            <div className="border-t border-gray-200 pt-3 mt-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-3">
                <div>
                  <div className="text-sm font-medium">LearnScripture Sync</div>
                  <div className="text-xs text-gray-500">Import and export references with your LearnScripture account.</div>
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Enabled</span>
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={learnSettings.enabled}
                    onChange={(e) => updateLearnSettings({ enabled: e.target.checked })}
                  />
                </label>
              </div>
              <div className="grid md:grid-cols-2 gap-3">
                <label className="text-sm">
                  <div className="text-gray-600 mb-1">Base URL</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    type="url"
                    value={learnSettings.baseUrl}
                    onChange={(e) => updateLearnSettings({ baseUrl: e.target.value })}
                    disabled={!learnSettings.enabled}
                    placeholder="https://learnscripture.net"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-gray-600 mb-1">API Token</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    type="password"
                    value={learnSettings.apiToken}
                    onChange={(e) => updateLearnSettings({ apiToken: e.target.value })}
                    disabled={!learnSettings.enabled}
                    placeholder="Token from browser developer tools"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-gray-600 mb-1">Username (optional)</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    value={learnSettings.username}
                    onChange={(e) => updateLearnSettings({ username: e.target.value })}
                    disabled={!learnSettings.enabled}
                    placeholder="your username"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-gray-600 mb-1">Password (optional)</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    type="password"
                    value={learnSettings.password}
                    onChange={(e) => updateLearnSettings({ password: e.target.value })}
                    disabled={!learnSettings.enabled}
                    placeholder="password"
                  />
                </label>
                <label className="text-sm">
                  <div className="text-gray-600 mb-1">CSRF Token (optional)</div>
                  <input
                    className="w-full border rounded-xl px-3 py-2"
                    value={learnSettings.csrfToken}
                    onChange={(e) => updateLearnSettings({ csrfToken: e.target.value })}
                    disabled={!learnSettings.enabled}
                    placeholder="e.g., from csrftoken cookie"
                  />
                </label>
              </div>
              <div className="flex flex-wrap gap-2 mt-3">
                <button
                  className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={() => importFromLearnScripture()}
                  disabled={!canSyncLearnScripture || syncing}
                >
                  {syncing ? "Syncing…" : "Import from LearnScripture"}
                </button>
                <button
                  className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={pushToLearnScripture}
                  disabled={!canSyncLearnScripture || pushing}
                >
                  {pushing ? "Uploading…" : "Export to LearnScripture"}
                </button>
              </div>
              <div className="mt-2 text-xs space-y-1">
                {syncState.message && (
                  <div
                    className={
                      syncState.status === "error"
                        ? "text-red-600"
                        : syncState.status === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }
                  >
                    Sync: {syncState.message}
                    {syncState.timestamp && (
                      <span className="ml-1 text-[10px] text-gray-400">({formatTimestamp(syncState.timestamp)})</span>
                    )}
                  </div>
                )}
                {pushState.message && (
                  <div
                    className={
                      pushState.status === "error"
                        ? "text-red-600"
                        : pushState.status === "success"
                        ? "text-green-600"
                        : "text-gray-600"
                    }
                  >
                    Export: {pushState.message}
                    {pushState.timestamp && (
                      <span className="ml-1 text-[10px] text-gray-400">({formatTimestamp(pushState.timestamp)})</span>
                    )}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-3">Credentials stay in this browser. They are never sent anywhere else.</p>
            </div>
            <p className="text-xs text-gray-500">We store settings in your browser only.</p>
          </div>
        )}
        {showManager && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 bg-white rounded-2xl shadow border">
              <SectionTitle>Reference List</SectionTitle>
              <div className="flex gap-2 mb-3">
                <input
                  className="flex-1 border rounded-xl px-3 py-2"
                  placeholder="e.g., John 3:16-17"
                  value={newRef}
                  onChange={(e) => setNewRef(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addRef()}
                />
                <button className="px-4 py-2 rounded-xl bg-gray-900 text-white" onClick={addRef}>
                  Add
                </button>
              </div>
              <div className="flex items-center gap-2 mb-2">
                <Tag>Total: {refs.length}</Tag>
                <Tag>
                  Showing: {filteredRefs.length} ({filter})
                </Tag>
              </div>
              <ul className="divide-y">
                {filteredRefs.length === 0 && (
                  <li className="py-10 text-center text-gray-500 text-sm">No references yet. Add one above, then click Start Quiz.</li>
                )}
                {filteredRefs.map((r) => (
                  <li key={r} className="py-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Tag>{whichTestament(r)}</Tag>
                      <span className="font-medium">{r}</span>
                    </div>
                    <button className="text-sm text-red-600 hover:underline" onClick={() => removeRef(r)}>
                      Remove
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="grid gap-3 content-start">
              <Stat label="Saved references" value={refs.length} />
              <Stat label="Filter" value={filter} />
              <div className="p-3 rounded-2xl bg-white shadow border">
                <div className="text-xs text-gray-500 mb-1">Tips</div>
                <ul className="text-sm list-disc pl-4 space-y-1">
                  <li>Use formats like "John 3:16" or "Psalm 23:1-3".</li>
                  <li>Version options: KJV, WEB, ASV.</li>
                  <li>Data persists locally in your browser.</li>
                </ul>
              </div>
            </div>
          </div>
        )}
        {inQuiz && (
          <div className="grid md:grid-cols-3 gap-4">
            <div className="md:col-span-2 p-4 bg-white rounded-2xl shadow border">
              <div className="mb-3">
                <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                  <div className="h-full bg-gray-900" style={{ width: `${progress}%` }} />
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <div>Item {idx + 1} of {quizOrder.length}</div>
                  <div>Version: {translation.toUpperCase()} • Mode: {modeInitial ? "Initial" : "Full"}</div>
                </div>
              </div>
              <SectionTitle>Verse</SectionTitle>
              <div className="min-h-[140px] p-3 rounded-xl bg-gray-50 border">
                {loading ? (
                  <div className="animate-pulse text-sm text-gray-500">Loading verse…</div>
                ) : (
                  <p className="text-base leading-7">{verseText || "(No text)"}</p>
                )}
              </div>
              <div className="mt-4 flex gap-2">
                <input
                  ref={answerRef}
                  className={`flex-1 border rounded-xl px-3 py-2 ${feedback === "correct" ? "border-green-500" : feedback === "wrong" ? "border-red-500" : ""}`}
                  placeholder={modeInitial ? "Type first letter/number + digits (e.g., p16811 → Psalm 16:8-11, 129 → 2 Corinthians 12:9)" : "Type the reference (e.g., John 3:16)"}
                  value={answer}
                  onChange={handleAnswerChange}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      if (showSolution) nextItem();
                      else checkAnswer();
                      return;
                    }
                    handleAnswerKeyDown(e);
                  }}
                />
                <button className="px-4 py-2 rounded-xl bg-gray-900 text-white" onClick={showSolution ? nextItem : checkAnswer}>
                  {showSolution ? "Next" : "Check"}
                </button>
              </div>
              <div className="mt-2 text-sm flex items-center gap-3">
                <span className="text-gray-500">Attempts left: {attemptsLeft}</span>
                {feedback === "correct" && <span className="text-green-700">Correct! → Next…</span>}
                {feedback === "wrong" && attemptsLeft === 0 && (
                  <span className="text-red-700">
                    Incorrect. Correct reference: <span className="font-medium">{filteredRefs[quizOrder[idx]]}</span>
                  </span>
                )}
              </div>
            </div>
            <div className="grid gap-3 content-start">
              <Stat label="Filter" value={filter} />
              <Stat label="Attempts left" value={attemptsLeft} />
              <div className="p-3 rounded-2xl bg-white shadow border text-sm">
                <div className="font-medium mb-1">Current Reference</div>
                <div className="relative">
                  <div className={`${revealRef ? "" : "blur-md"} select-none whitespace-nowrap overflow-hidden text-ellipsis`}>
                    {filteredRefs[quizOrder[idx]] || "—"}
                  </div>
                  {!revealRef && (
                    <div className="pointer-events-none absolute inset-0 grid place-items-center text-xs text-gray-500">Hidden during quiz</div>
                  )}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white shadow border text-sm">
                <div className="font-medium mb-1">Controls</div>
                <div className="flex flex-wrap gap-2">
                  <button className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300" onClick={() => loadCurrentVerse(quizOrder[idx])}>
                    Reload
                  </button>
                  <button className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300" onClick={nextItem}>
                    Skip
                  </button>
                  <button className="px-3 py-1.5 rounded-xl bg-gray-900 text-white" onClick={() => setRevealRef((v) => !v)}>
                    {revealRef ? "Hide" : "Reveal"}
                  </button>
                </div>
                
              </div>
            </div>
          </div>
        )}
      </main>
      <footer className="max-w-5xl mx-auto p-4 text-center text-xs text-gray-500">
        Built for memorization practice. Scripture text is fetched on-demand from public APIs.
      </footer>
    </div>
  );
}
