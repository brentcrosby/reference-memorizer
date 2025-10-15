import React, { useEffect, useMemo, useRef, useState } from "react";

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
const LS_TRANSLATION_KEY = "bible-quiz-translation-v1";



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
  const [newRef, setNewRef] = useState("");
  const [translation, setTranslation] = useState(() => {
    if (typeof window === "undefined") return "kjv";
    try {
      return localStorage.getItem(LS_TRANSLATION_KEY) || "kjv";
    } catch {
      return "kjv";
    }
  });
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
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(min-width: 768px)").matches;
  });
  const verseBoxMinHeight = useMemo(() => {
    const baseMin = isDesktop ? 88 : 110;
    const lineHeight = isDesktop ? 26 : 24;
    const extraPadding = isDesktop ? 24 : 28;
    const charsPerLine = isDesktop ? 62 : 44;
    if (loading && !verseText) {
      return isDesktop ? 120 : 140;
    }
    const textLength = (verseText || "").replace(/\s+/g, " ").trim().length;
    if (!textLength) {
      return baseMin;
    }
    const approxLines = Math.max(1, Math.ceil(textLength / charsPerLine));
    const computed = approxLines * lineHeight + extraPadding;
    const capped = Math.min(computed, isDesktop ? 320 : 360);
    return Math.max(baseMin, Math.round(capped));
  }, [isDesktop, loading, verseText]);
  useEffect(() => {
    saveRefs(refs);
  }, [refs]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      localStorage.setItem(LS_TRANSLATION_KEY, translation);
    } catch {}
  }, [translation]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handleChange = (event) => setIsDesktop(event.matches);
    setIsDesktop(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", handleChange);
    else mq.addListener(handleChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener("change", handleChange);
      else mq.removeListener(handleChange);
    };
  }, []);
  
  
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
  function clearAllRefs() {
    if (refs.length === 0) return;
    if (!window.confirm("Remove all saved verses?")) return;
    setRefs([]);
    setQuizOrder([]);
    setIdx(0);
    setAttemptsLeft(2);
    setFeedback(null);
    setAnswer("");
    setRevealRef(false);
    setShowSolution(false);
    setShowManager(true);
    setVerseText("");
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
  useEffect(() => {
    if (!inQuiz) return;
    const currentOrderIdx = quizOrder[idx];
    if (currentOrderIdx == null) return;
    loadCurrentVerse(currentOrderIdx);
  }, [translation]);
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
      <header
        className={`sticky top-0 z-10 backdrop-blur bg-white/80 border-b ${inQuiz ? "hidden md:block" : ""}`}
      >
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-[220px]">
            <div className="w-9 h-9 rounded-2xl bg-gray-900 text-white grid place-items-center font-bold flex-shrink-0">RM</div>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight">Reference Memorizer</h1>
              <div className="text-xs text-gray-500">Add references → study by verse → type the reference. Two tries each.</div>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto sm:flex-nowrap sm:items-center sm:justify-end">
            <select
              className="border rounded-xl px-2 py-1 text-sm flex-1 min-w-[140px] sm:min-w-0 sm:flex-none"
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
            >
              <option value="kjv">KJV</option>
              <option value="web">WEB</option>
              <option value="asv">ASV</option>
            </select>
            <select
              className="border rounded-xl px-2 py-1 text-sm flex-1 min-w-[140px] sm:min-w-0 sm:flex-none"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
            >
              <option value="ALL">All</option>
              <option value="OT">Old Testament</option>
              <option value="NT">New Testament</option>
            </select>
            <button
              className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm flex-1 min-w-[120px] sm:min-w-0 sm:flex-none"
              onClick={() => setShowSettings((v) => !v)}
            >
              Settings
            </button>
            {inQuiz ? (
              <button
                className="px-3 py-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-sm flex-1 min-w-[120px] sm:min-w-0 sm:flex-none"
                onClick={() => {
                  setShowManager(true);
                  setQuizOrder([]);
                }}
              >
                End
              </button>
            ) : (
              <button
                className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm flex-1 min-w-[120px] sm:min-w-0 sm:flex-none"
                onClick={startQuiz}
                disabled={filteredRefs.length === 0}
              >
                Start Quiz
              </button>
            )}
          </div>
        </div>
      </header>
      <main className={`max-w-5xl mx-auto ${inQuiz ? "p-0 md:p-4" : "p-4"}`}>
        {showSettings && (
          <div className={`mb-4 p-4 bg-white rounded-2xl shadow border ${inQuiz ? "mx-4 md:mx-0" : ""}`}>
            <SectionTitle>Settings</SectionTitle>
            <div className="grid md:grid-cols-3 gap-3 mb-3">
              <label className="text-sm">
                <div className="text-gray-600 mb-1">Mode</div>
                <select className="w-full border rounded-xl px-3 py-2" value={modeInitial ? "initial" : "full"} onChange={(e) => setModeInitial(e.target.value === "initial")}>
                  <option value="initial">First Letter Mode (default)</option>
                  <option value="full">Full Reference Mode</option>
                </select>
              </label>
              <div className="md:col-span-2 flex items-end">
                <button
                  type="button"
                  className="w-full px-3 py-2 rounded-xl border border-red-200 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed"
                  onClick={clearAllRefs}
                  disabled={refs.length === 0}
                >
                  Clear all saved verses
                </button>
              </div>
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
          isDesktop ? (
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
                <div className="p-3 rounded-xl bg-gray-50 border" style={{ minHeight: verseBoxMinHeight }}>
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
          ) : (
            <div className="flex flex-col min-h-[100dvh] bg-gray-50">
              <div className="border-b bg-white shadow-sm px-4 py-3 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">Item {idx + 1} of {quizOrder.length}</div>
                  <div className="text-xs text-gray-500 truncate">Version: {translation.toUpperCase()} • Mode: {modeInitial ? "Initial" : "Full"}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <button
                    className="px-3 py-1.5 rounded-xl bg-gray-200 text-sm"
                    onClick={() => setShowSettings((v) => !v)}
                  >
                    Settings
                  </button>
                  <button
                    className="px-3 py-1.5 rounded-xl bg-gray-900 text-white text-sm"
                    onClick={() => {
                      setShowManager(true);
                      setQuizOrder([]);
                    }}
                  >
                    End
                  </button>
                </div>
              </div>
              <div className="px-4 pt-3">
                <div className="h-2 w-full rounded-full bg-gray-200 overflow-hidden">
                  <div className="h-full bg-gray-900" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <div className="flex-1 flex flex-col px-4 py-3 overflow-hidden">
                <div
                  className="flex-1 bg-white border shadow rounded-2xl px-4 py-3 flex flex-col gap-3 overflow-hidden"
                  style={{ paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)" }}
                >
                  <div className="flex gap-2">
                    <input
                      ref={answerRef}
                      className={`flex-1 border rounded-xl px-3 py-3 text-base ${feedback === "correct" ? "border-green-500" : feedback === "wrong" ? "border-red-500" : ""}`}
                      placeholder={modeInitial ? "Type book initial + numbers" : "Type the reference"}
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
                    <button className="px-4 py-3 rounded-xl bg-gray-900 text-white" onClick={showSolution ? nextItem : checkAnswer}>
                      {showSolution ? "Next" : "Check"}
                    </button>
                  </div>
                  <div
                    className="flex-none p-3 rounded-xl bg-gray-50 border overflow-y-auto"
                    style={{ minHeight: verseBoxMinHeight }}
                  >
                    {loading ? (
                      <div className="animate-pulse text-sm text-gray-500">Loading verse…</div>
                    ) : (
                      <p className="text-[15px] leading-6 whitespace-pre-wrap">{verseText || "(No text)"}</p>
                    )}
                  </div>
                  <div className="text-sm flex flex-wrap items-center gap-3">
                    <span className="text-gray-500">Attempts left: {attemptsLeft}</span>
                    {feedback === "correct" && <span className="text-green-700">Correct! → Next…</span>}
                    {feedback === "wrong" && attemptsLeft === 0 && (
                      <span className="text-red-700">
                        Incorrect. Correct reference: <span className="font-medium">{filteredRefs[quizOrder[idx]]}</span>
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <button className="px-3 py-2 rounded-xl bg-gray-200" onClick={() => loadCurrentVerse(quizOrder[idx])}>
                      Reload
                    </button>
                    <button className="px-3 py-2 rounded-xl bg-gray-200" onClick={nextItem}>
                      Skip
                    </button>
                    <button className="px-3 py-2 rounded-xl bg-gray-900 text-white" onClick={() => setRevealRef((v) => !v)}>
                      {revealRef ? "Hide" : "Reveal"}
                    </button>
                  </div>
                  <div className="text-xs text-gray-500">
                    <div className="font-medium text-gray-700 mb-1">Current Reference</div>
                    <div className="relative">
                      <div className={`${revealRef ? "" : "blur-sm"} select-none text-base font-medium`}>{filteredRefs[quizOrder[idx]] || "—"}</div>
                      {!revealRef && (
                        <div className="pointer-events-none absolute inset-0 grid place-items-center text-[11px] text-gray-500">Hidden during quiz</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )
        )}
      </main>
      <footer className="max-w-5xl mx-auto p-4 text-center text-xs text-gray-500">
        Built for memorization practice. Scripture text is fetched on-demand from public APIs.
      </footer>
    </div>
  );
}
