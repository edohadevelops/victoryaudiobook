import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://qnkmneedjzdjnxmgavli.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua21uZWVkanpkam54bWdhdmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTA4MTUsImV4cCI6MjA5NjUyNjgxNX0.VQ32EH4ZPep3S3tyfViAOQaw3GIW_M_3icbHKm-SUEg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API_KEY = import.meta.env.VITE_GOOGLE_TTS_KEY || "";
const CHUNK_SIZE = 4000;

const CATEGORIES = ["Uncategorized","Fiction","Non-Fiction","Self-Help","Business","Biography","Science","History","Fantasy","Mystery","Thriller","Romance","Philosophy","Psychology","Spirituality","Health","Technology"];

const READING_QUOTES = [
  { text: "A reader lives a thousand lives before she dies.", author: "George R.R. Martin" },
  { text: "There is no friend as loyal as a book.", author: "Ernest Hemingway" },
  { text: "Books are a uniquely portable magic.", author: "Stephen King" },
  { text: "She is too fond of books, and it has turned her brain.", author: "Louisa May Alcott" },
  { text: "Reading is dreaming with open eyes.", author: "Anissa Trisdianty" },
  { text: "A book is a dream you hold in your hands.", author: "Neil Gaiman" },
  { text: "Not all those who wander are lost — some are just between chapters.", author: "Unknown" },
];

const VOICE_OPTIONS = [
  { id: "en-US-Neural2-F", label: "Naomi", desc: "Warm American female", lang: "en-US", gender: "FEMALE" },
  { id: "en-US-Neural2-H", label: "Serena", desc: "Clear American female", lang: "en-US", gender: "FEMALE" },
  { id: "en-GB-Wavenet-C", label: "Victoria", desc: "Elegant British female", lang: "en-GB", gender: "FEMALE" },
  { id: "en-US-Neural2-D", label: "Marcus", desc: "Warm American male", lang: "en-US", gender: "MALE" },
  { id: "en-US-Neural2-I", label: "DeShawn", desc: "Deep rich American male", lang: "en-US", gender: "MALE" },
  { id: "en-US-Neural2-J", label: "Jordan", desc: "Clear American male", lang: "en-US", gender: "MALE" },
  { id: "en-US-Wavenet-B", label: "Franklin", desc: "Authoritative American male", lang: "en-US", gender: "MALE" },
  { id: "en-US-Wavenet-I", label: "Isaiah", desc: "Rich deep American male", lang: "en-US", gender: "MALE" },
  { id: "en-GB-Wavenet-B", label: "Edmund", desc: "Deep British male", lang: "en-GB", gender: "MALE" },
  { id: "en-AU-Wavenet-B", label: "Bruce", desc: "Deep Australian male", lang: "en-AU", gender: "MALE" },
];

const COVER_PALETTES = [
  ["#4c1d95","#7c3aed"], ["#1e1b4b","#4338ca"], ["#0c4a6e","#0ea5e9"],
  ["#064e3b","#10b981"], ["#7f1d1d","#ef4444"], ["#78350f","#f59e0b"],
  ["#831843","#ec4899"], ["#1e3a5f","#3b82f6"], ["#3b0764","#a855f7"],
  ["#14532d","#22c55e"], ["#1c1917","#78716c"], ["#0f172a","#6366f1"],
];

const CONFETTI = Array.from({ length: 60 }, (_, i) => ({
  left: (i * 37 + 11) % 100,
  delay: (i * 0.13) % 3,
  dur: 2.5 + (i * 0.07) % 2,
  size: 5 + (i * 3) % 8,
  color: ["#c084fc","#7c3aed","#a78bfa","#e879f9","#f0abfc","#fbbf24","#34d399","#60a5fa"][i % 8],
  rotate: (i * 47) % 360,
  shape: i % 3,
}));

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

function bookGradient(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i) + ((h << 5) - h);
  return COVER_PALETTES[Math.abs(h) % COVER_PALETTES.length];
}

function chunkText(text) {
  const paras = text.split(/\n+/).filter(p => p.trim().length > 0);
  const chunks = [];
  let cur = "";
  for (const p of paras) {
    if ((cur + " " + p).trim().length > CHUNK_SIZE) {
      if (cur.trim()) chunks.push(cur.trim());
      cur = p;
    } else {
      cur = cur ? cur + "\n\n" + p : p;
    }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function extractTextFromPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const typedArray = new Uint8Array(e.target.result);
        const pdfjsLib = window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const pdf = await pdfjsLib.getDocument({ data: typedArray }).promise;
        let text = "";
        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const content = await page.getTextContent();
          text += content.items.map(it => it.str).join(" ") + "\n\n";
        }
        resolve(text.trim());
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

async function generateAndCacheAudio(text, bookId, chunkIndex, voice, force = false) {
  const voiceKey = voice.id;
  if (!force) {
    const { data: cached } = await supabase
      .from("audio_chunks").select("audio_path")
      .eq("book_id", bookId).eq("chunk_index", chunkIndex).eq("voice_id", voiceKey).single();
    if (cached?.audio_path) {
      const { data } = supabase.storage.from("audio").getPublicUrl(cached.audio_path);
      return data.publicUrl;
    }
  }
  const res = await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      input: { text },
      voice: { languageCode: voice.lang, name: voice.id, ssmlGender: voice.gender },
      audioConfig: { audioEncoding: "MP3", speakingRate: 0.95, pitch: -1.0 },
    }),
  });
  if (!res.ok) { const e = await res.json(); throw new Error(e.error?.message || "TTS error"); }
  const json = await res.json();
  const blob = new Blob([Uint8Array.from(atob(json.audioContent), c => c.charCodeAt(0))], { type: "audio/mp3" });
  const path = `${bookId}/${voiceKey}/chunk_${chunkIndex}.mp3`;
  await supabase.storage.from("audio").upload(path, blob, { contentType: "audio/mp3", upsert: true });
  await supabase.from("audio_chunks").upsert(
    { book_id: bookId, chunk_index: chunkIndex, audio_path: path, voice_id: voiceKey },
    { onConflict: "book_id,chunk_index,voice_id" }
  );
  const { data: urlData } = supabase.storage.from("audio").getPublicUrl(path);
  return urlData.publicUrl;
}

// ─── Components ──────────────────────────────────────────────────────────────

const WaveIcon = ({ playing }) => (
  <svg width="24" height="24" viewBox="0 0 28 28" fill="none">
    {[4,8,12,16,20,24].map((x, i) => {
      const h = playing ? [10,18,14,20,12,16][i] : 4;
      return <rect key={x} x={x} y={(28-h)/2} width="2.5" height={h} rx="1.25" fill="currentColor"
        style={playing ? { animation:`wave ${0.6+i*0.1}s ease-in-out ${i*0.08}s infinite alternate` } : {}} />;
    })}
  </svg>
);

const CircleProgress = ({ value, max, size = 150, stroke = 12 }) => {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - Math.min(value / max, 1) * circ;
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id="cg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#c084fc" />
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#1e1530" strokeWidth={stroke} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#cg)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{ transition: "stroke-dashoffset 1.2s ease" }} />
    </svg>
  );
};

const Stars = ({ value, onChange, readonly = false }) => (
  <div style={{ display:"flex", gap:4 }}>
    {[1,2,3,4,5].map(s => (
      <button key={s} onClick={() => !readonly && onChange?.(s)}
        style={{ background:"none", border:"none", cursor: readonly?"default":"pointer", padding:2, fontSize:22,
          color: s <= value ? "#c084fc" : "#2d1f4a", transition:"color 0.15s, filter 0.15s",
          filter: s <= value ? "drop-shadow(0 0 6px rgba(192,132,252,0.7))" : "none" }}>★</button>
    ))}
  </div>
);

const BookCover = ({ book, onClick, size = "md" }) => {
  const [c1, c2] = bookGradient(book.title);
  const w = size === "sm" ? 72 : size === "lg" ? 140 : 100;
  const h = size === "sm" ? 100 : size === "lg" ? 196 : 140;
  return (
    <div onClick={onClick}
      style={{ width:w, height:h, borderRadius:6, background:`linear-gradient(140deg,${c1},${c2})`,
        cursor:"pointer", position:"relative", flexShrink:0, overflow:"hidden",
        boxShadow:"0 8px 24px rgba(0,0,0,0.55), inset 3px 0 rgba(255,255,255,0.08)",
        transition:"transform 0.2s, box-shadow 0.2s", display:"flex", flexDirection:"column",
        justifyContent:"flex-end", padding:8 }}
      onMouseEnter={e => { e.currentTarget.style.transform="translateY(-5px) rotate(-1deg)"; e.currentTarget.style.boxShadow="0 20px 40px rgba(0,0,0,0.7), inset 3px 0 rgba(255,255,255,0.12)"; }}
      onMouseLeave={e => { e.currentTarget.style.transform=""; e.currentTarget.style.boxShadow="0 8px 24px rgba(0,0,0,0.55), inset 3px 0 rgba(255,255,255,0.08)"; }}>
      <div style={{ position:"absolute", top:0, left:0, right:0, bottom:0, background:"rgba(0,0,0,0.18)" }} />
      <p style={{ position:"relative", fontSize: size==="sm" ? 8 : 10, fontWeight:700, color:"rgba(255,255,255,0.92)",
        lineHeight:1.3, display:"-webkit-box", WebkitLineClamp:4, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
        {book.title}
      </p>
      {size !== "sm" && book.author && book.author !== "Unknown Author" &&
        <p style={{ position:"relative", fontSize:8, color:"rgba(255,255,255,0.55)", marginTop:3,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{book.author}</p>}
    </div>
  );
};

const Confetti = () => (
  <div style={{ position:"fixed", inset:0, pointerEvents:"none", zIndex:300 }}>
    {CONFETTI.map((p, i) => (
      <div key={i} style={{ position:"absolute", left:`${p.left}%`, top:"-20px",
        width: p.shape===1 ? p.size*2 : p.size, height:p.size,
        background:p.color, borderRadius: p.shape===0 ? "50%" : "2px",
        transform:`rotate(${p.rotate}deg)`,
        animation:`confettiFall ${p.dur}s ease ${p.delay}s forwards` }} />
    ))}
  </div>
);

const BottomNav = ({ screen, setScreen, finishedCount }) => {
  const tabs = [
    { id:"library", icon:"📚", label:"Library" },
    { id:"shelf",   icon:"🏛️", label:"Shelf", badge: finishedCount },
    { id:"goals",   icon:"🎯", label:"Goals" },
    { id:"wrapped", icon:"✦",  label:"Wrapped" },
  ];
  return (
    <nav style={{ position:"fixed", bottom:0, left:0, right:0, zIndex:100,
      background:"rgba(8,5,16,0.96)", backdropFilter:"blur(24px)",
      borderTop:"0.5px solid #2d1f4a", display:"flex" }}>
      {tabs.map(t => {
        const active = screen === t.id;
        return (
          <button key={t.id} onClick={() => setScreen(t.id)}
            style={{ flex:1, background:"none", border:"none", cursor:"pointer",
              padding:"12px 4px 10px", display:"flex", flexDirection:"column",
              alignItems:"center", gap:3, color: active ? "#c084fc" : "#4a3a68",
              transition:"color 0.2s", position:"relative" }}>
            <span style={{ fontSize:18 }}>{t.icon}</span>
            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, fontWeight: active ? 700 : 400 }}>{t.label}</span>
            {t.badge > 0 && !active && (
              <span style={{ position:"absolute", top:8, right:"20%", background:"#7c3aed", color:"#fff",
                fontSize:8, fontFamily:"'Space Mono',monospace", borderRadius:10, padding:"1px 5px",
                fontWeight:700 }}>{t.badge}</span>
            )}
            {active && <div style={{ width:18, height:2, background:"#c084fc", borderRadius:1 }} />}
          </button>
        );
      })}
    </nav>
  );
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  // Nav
  const [screen, setScreen] = useState("library");
  const [fromScreen, setFromScreen] = useState("library");

  // Books
  const [books, setBooks] = useState([]);
  const [loadingBooks, setLoadingBooks] = useState(true);
  const [activeBook, setActiveBook] = useState(null);

  // Upload
  const [uploadPending, setUploadPending] = useState(null);
  const [uploadForm, setUploadForm] = useState({ title:"", author:"", category:"Uncategorized" });
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Player
  const [chunks, setChunks] = useState([]);
  const [cachedChunks, setCachedChunks] = useState({});
  const [currentChunk, setCurrentChunk] = useState(0);
  const [audioUrls, setAudioUrls] = useState({});
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [pregenProgress, setPregenProgress] = useState(null);
  const [selectedVoice, setSelectedVoice] = useState(VOICE_OPTIONS.find(v => v.id === "en-US-Neural2-F"));
  const [showVoiceDropdown, setShowVoiceDropdown] = useState(false);
  const [showRegenConfirm, setShowRegenConfirm] = useState(false);
  const [showBookComplete, setShowBookComplete] = useState(false);

  // Journal
  const [journals, setJournals] = useState({});
  const [journalBook, setJournalBook] = useState(null);
  const [journalForm, setJournalForm] = useState({ learned:"", takeaways:"", actions:"", rating:0 });
  const [savingJournal, setSavingJournal] = useState(false);

  // Shelf
  const [shelfSort, setShelfSort] = useState("date");
  const [selectedShelfBook, setSelectedShelfBook] = useState(null);

  // Library filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterCategory, setFilterCategory] = useState("All");

  // Wrapped
  const [wrappedPeriod, setWrappedPeriod] = useState("year");

  // Quote (stable per session)
  const [quoteIdx] = useState(() => Math.floor((Date.now() / 86400000) % READING_QUOTES.length));

  // Refs
  const audioRef = useRef(null);
  const preloadRef = useRef(null); // hidden audio for pre-buffering
  const fileInputRef = useRef(null);
  const progressSaveRef = useRef(null);
  const dropdownRef = useRef(null);
  const chunksRef = useRef(chunks);
  const audioUrlsRef = useRef(audioUrls);
  const currentChunkRef = useRef(currentChunk);
  const activeBookRef = useRef(activeBook);
  const selectedVoiceRef = useRef(selectedVoice);
  const speedRef = useRef(speed);

  // Keep refs in sync
  useEffect(() => { chunksRef.current = chunks; }, [chunks]);
  useEffect(() => { audioUrlsRef.current = audioUrls; }, [audioUrls]);
  useEffect(() => { currentChunkRef.current = currentChunk; }, [currentChunk]);
  useEffect(() => { activeBookRef.current = activeBook; }, [activeBook]);
  useEffect(() => { selectedVoiceRef.current = selectedVoice; }, [selectedVoice]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  // ── Init
  useEffect(() => { fetchBooks(); fetchAllJournals(); }, []);

  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) setShowVoiceDropdown(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    setAudioUrls({});
    if (activeBook) refreshCachedChunks(activeBook.id, selectedVoice.id);
  }, [selectedVoice]);

  // ── Data

  const fetchBooks = async () => {
    setLoadingBooks(true);
    const { data } = await supabase.from("books").select("*, reading_progress(*)")
      .order("created_at", { ascending: false });
    setBooks(data || []);
    setLoadingBooks(false);
  };

  const fetchAllJournals = async () => {
    const { data } = await supabase.from("book_journals").select("*");
    const map = {};
    (data || []).forEach(j => { map[j.book_id] = j; });
    setJournals(map);
  };

  const refreshCachedChunks = async (bookId, voiceId) => {
    const { data } = await supabase.from("audio_chunks").select("chunk_index")
      .eq("book_id", bookId).eq("voice_id", voiceId);
    const cached = {};
    (data || []).forEach(ac => { cached[ac.chunk_index] = true; });
    setCachedChunks(cached);
  };

  // ── Upload

  const handleFilePicked = async (file) => {
    if (!file || file.type !== "application/pdf") { setError("Please upload a PDF file."); return; }
    setError("");
    setIsLoading(true);
    setLoadingMsg("Reading PDF…");
    try {
      const text = await extractTextFromPDF(file);
      if (!text) throw new Error("No readable text found. The PDF may be scanned.");
      const c = chunkText(text);
      setUploadPending({ file, text, chunks: c });
      setUploadForm({ title: file.name.replace(/\.pdf$/i, ""), author: "", category: "Uncategorized" });
    } catch (e) { setError(e.message); }
    setIsLoading(false);
    setLoadingMsg("");
  };

  const confirmUpload = async () => {
    if (!uploadPending) return;
    setUploading(true);
    setLoadingMsg("Adding to your collection…");
    try {
      const { file, text, chunks: c } = uploadPending;
      const filePath = `${Date.now()}_${file.name}`;
      const { error: ue } = await supabase.storage.from("books").upload(filePath, file);
      if (ue) throw ue;
      const { data: bookData, error: be } = await supabase.from("books").insert({
        title: uploadForm.title || file.name.replace(/\.pdf$/i, ""),
        author: uploadForm.author || "Unknown Author",
        category: uploadForm.category,
        file_path: filePath,
        word_count: text.split(/\s+/).filter(Boolean).length,
        chunk_count: c.length,
        status: "reading",
      }).select().single();
      if (be) throw be;
      await supabase.from("reading_progress").insert({ book_id: bookData.id, current_chunk: 0, current_position: 0 });
      await fetchBooks();
      setUploadPending(null);
      setUploading(false);
      setLoadingMsg("");
      openBook({ ...bookData, reading_progress: [{ current_chunk: 0, current_position: 0 }] }, c);
    } catch (e) { setError(e.message); setUploading(false); setLoadingMsg(""); }
  };

  // ── Book open / repeat

  const openBook = async (book, preloadedChunks = null) => {
    setError("");
    setAudioUrls({});
    setIsPlaying(false);
    setActiveBook(book);
    setPregenProgress(null);
    setShowRegenConfirm(false);
    setShowBookComplete(false);
    setFromScreen(screen);

    let c = preloadedChunks;
    if (!c) {
      setIsLoading(true);
      setLoadingMsg("Loading book…");
      try {
        const { data } = await supabase.storage.from("books").download(book.file_path);
        const file = new File([data], book.title + ".pdf", { type: "application/pdf" });
        const text = await extractTextFromPDF(file);
        c = chunkText(text);
      } catch (e) { setError(e.message); setIsLoading(false); return; }
      setIsLoading(false);
      setLoadingMsg("");
    }

    setChunks(c);
    await refreshCachedChunks(book.id, selectedVoice.id);
    const prog = book.reading_progress?.[0];
    const savedChunk = prog?.current_chunk || 0;
    setCurrentChunk(savedChunk);
    setProgress((savedChunk / c.length) * 100);
    setScreen("player");

    if (prog?.id) {
      await supabase.from("reading_progress").update({ last_opened: new Date().toISOString() }).eq("id", prog.id);
    }
  };

  const repeatBook = async (book) => {
    const prog = book.reading_progress?.[0];
    if (prog?.id) await supabase.from("reading_progress").update({ current_chunk: 0, current_position: 0 }).eq("id", prog.id);
    await supabase.from("books").update({ status: "reading", finished_at: null }).eq("id", book.id);
    await fetchBooks();
    openBook({ ...book, status: "reading", finished_at: null, reading_progress: [{ ...prog, current_chunk: 0, current_position: 0 }] });
  };

  const saveProgress = useCallback(async (chunk, position) => {
    const book = activeBookRef.current;
    if (!book) return;
    const prog = book.reading_progress?.[0];
    if (prog?.id) {
      await supabase.from("reading_progress")
        .update({ current_chunk: chunk, current_position: position, last_opened: new Date().toISOString() })
        .eq("id", prog.id);
    }
  }, []);

  // ── Audio — seamless playback
  // Strategy: pre-generate 3 chunks ahead + pre-buffer next audio into browser cache
  // so transitions are instant with zero gap.

  const prebufferUrl = useCallback((url) => {
    if (!url || !preloadRef.current) return;
    preloadRef.current.src = url;
    preloadRef.current.load(); // browser fetches & caches; doesn't play
  }, []);

  const preloadChunk = useCallback(async (idx) => {
    const c = chunksRef.current;
    const urls = audioUrlsRef.current;
    const book = activeBookRef.current;
    const voice = selectedVoiceRef.current;
    if (!API_KEY || !c[idx] || urls[idx] || !book) return;
    try {
      const url = await generateAndCacheAudio(c[idx], book.id, idx, voice);
      setAudioUrls(prev => ({ ...prev, [idx]: url }));
      setCachedChunks(prev => ({ ...prev, [idx]: true }));
      // Pre-buffer audio data into browser cache (eliminates network gap on playback)
      const hidden = new Audio();
      hidden.preload = "auto";
      hidden.src = url;
      hidden.load();
    } catch (e) {}
  }, []);

  const playChunk = useCallback(async (idx, force = false) => {
    const c = chunksRef.current;
    const book = activeBookRef.current;
    const voice = selectedVoiceRef.current;
    if (!c[idx]) return;
    setCurrentChunk(idx);
    setError("");

    let url = !force && audioUrlsRef.current[idx] ? audioUrlsRef.current[idx] : null;
    if (!url) {
      setIsLoading(true);
      setLoadingMsg(cachedChunks[idx] && !force
        ? `Loading part ${idx + 1}…`
        : `Generating part ${idx + 1} of ${c.length}…`);
      try {
        url = await generateAndCacheAudio(c[idx], book.id, idx, voice, force);
        setAudioUrls(prev => ({ ...prev, [idx]: url }));
        setCachedChunks(prev => ({ ...prev, [idx]: true }));
      } catch (e) { setError(e.message); setIsLoading(false); setIsPlaying(false); return; }
      setIsLoading(false);
      setLoadingMsg("");
    }

    if (audioRef.current) {
      audioRef.current.src = url; // likely already browser-cached → instant
      audioRef.current.playbackRate = speedRef.current;
      audioRef.current.play();
      setIsPlaying(true);
    }

    // Aggressively pre-generate next 3 chunks so they're ready before needed
    [1, 2, 3].forEach(offset => {
      const next = idx + offset;
      if (c[next] && !audioUrlsRef.current[next]) {
        setTimeout(() => preloadChunk(next), offset * 800);
      }
    });
  }, [cachedChunks, preloadChunk]);

  const handlePlay = async () => {
    if (!API_KEY) { setError("VITE_GOOGLE_TTS_KEY not set."); return; }
    if (!chunks.length) return;
    if (isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
      saveProgress(currentChunk, audioRef.current?.currentTime || 0);
    } else {
      if (audioRef.current?.src && audioRef.current.paused) {
        audioRef.current.playbackRate = speed;
        audioRef.current.play();
        setIsPlaying(true);
      } else {
        playChunk(currentChunk);
      }
    }
  };

  const handleEnded = useCallback(async () => {
    const idx = currentChunkRef.current;
    const c = chunksRef.current;
    const book = activeBookRef.current;
    if (idx < c.length - 1) {
      playChunk(idx + 1);
    } else {
      setIsPlaying(false);
      setProgress(100);
      saveProgress(0, 0);
      if (book) {
        await supabase.from("books").update({ status: "finished", finished_at: new Date().toISOString() }).eq("id", book.id);
        setActiveBook(prev => ({ ...prev, status: "finished", finished_at: new Date().toISOString() }));
        await fetchBooks();
        setShowBookComplete(true);
      }
    }
  }, [playChunk, saveProgress]);

  const handleTimeUpdate = () => {
    if (!audioRef.current) return;
    const pos = audioRef.current.currentTime;
    const dur = audioRef.current.duration || 0;
    setCurrentTime(pos);
    setDuration(dur);
    const chunkPct = dur ? pos / dur : 0;
    setProgress(((currentChunkRef.current + chunkPct) / (chunksRef.current.length || 1)) * 100);
    clearTimeout(progressSaveRef.current);
    progressSaveRef.current = setTimeout(() => saveProgress(currentChunkRef.current, pos), 10000);
  };

  const handleSkip = (s) => {
    if (!audioRef.current) return;
    audioRef.current.currentTime = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + s));
  };

  const handlePregenerate = async (force = false) => {
    if (!API_KEY || !chunks.length || !activeBook) return;
    setShowRegenConfirm(false);
    setPregenProgress({ done: 0, total: chunks.length });
    for (let i = 0; i < chunks.length; i++) {
      if (force || !cachedChunks[i]) {
        try {
          const url = await generateAndCacheAudio(chunks[i], activeBook.id, i, selectedVoice, force);
          setAudioUrls(prev => ({ ...prev, [i]: url }));
          setCachedChunks(prev => ({ ...prev, [i]: true }));
          // Also pre-buffer into browser
          const h = new Audio(); h.preload = "auto"; h.src = url; h.load();
        } catch (e) { setError(`Failed on part ${i+1}: ${e.message}`); setPregenProgress(null); return; }
      }
      setPregenProgress({ done: i + 1, total: chunks.length });
    }
    setPregenProgress(null);
    setAudioUrls(prev => ({ ...prev }));
  };

  const handleDownload = async () => {
    if (!activeBook) return;
    setLoadingMsg("Preparing download…"); setIsLoading(true);
    try {
      const { data: cd } = await supabase.from("audio_chunks").select("chunk_index,audio_path")
        .eq("book_id", activeBook.id).eq("voice_id", selectedVoice.id).order("chunk_index");
      if (!cd?.length) { setError("Generate audio first."); setIsLoading(false); setLoadingMsg(""); return; }
      const blobs = [];
      for (const ch of cd) { const { data } = await supabase.storage.from("audio").download(ch.audio_path); blobs.push(data); }
      const merged = new Blob(blobs, { type: "audio/mp3" });
      const url = URL.createObjectURL(merged);
      const a = document.createElement("a"); a.href = url; a.download = `${activeBook.title} — ${selectedVoice.label}.mp3`; a.click();
      URL.revokeObjectURL(url);
    } catch (e) { setError(e.message); }
    setIsLoading(false); setLoadingMsg("");
  };

  const deleteBook = async (e, bookId, filePath) => {
    e.stopPropagation();
    if (!confirm("Remove this book from your collection?")) return;
    const { data: cd } = await supabase.from("audio_chunks").select("audio_path").eq("book_id", bookId);
    if (cd?.length) await supabase.storage.from("audio").remove(cd.map(c => c.audio_path));
    await supabase.storage.from("books").remove([filePath]);
    await supabase.from("books").delete().eq("id", bookId);
    fetchBooks();
  };

  // ── Journal

  const openJournal = (book) => {
    setJournalBook(book);
    const j = journals[book.id];
    setJournalForm({ learned: j?.learned || "", takeaways: j?.takeaways || "", actions: j?.actions || "", rating: j?.rating || 0 });
    setFromScreen(screen);
    setScreen("journal");
  };

  const saveJournal = async () => {
    if (!journalBook) return;
    setSavingJournal(true);
    const payload = { book_id: journalBook.id, ...journalForm, updated_at: new Date().toISOString() };
    const existing = journals[journalBook.id];
    if (existing?.id) await supabase.from("book_journals").update(payload).eq("id", existing.id);
    else await supabase.from("book_journals").insert(payload);
    await fetchAllJournals();
    setSavingJournal(false);
  };

  // ── Helpers

  const fmt = (s) => {
    if (!s || isNaN(s)) return "0:00";
    return `${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;
  };

  // ── Derived data

  const finishedBooks = books.filter(b => b.status === "finished");
  const finishedCount = finishedBooks.length;
  const thisYear = new Date().getFullYear();
  const booksThisYear = finishedBooks.filter(b => b.finished_at && new Date(b.finished_at).getFullYear() === thisYear);
  const GOAL = 12;

  const filteredLibraryBooks = books.filter(b => {
    const q = searchQuery.toLowerCase();
    const matchQ = !q || b.title.toLowerCase().includes(q) || (b.author||"").toLowerCase().includes(q);
    const matchCat = filterCategory === "All" || b.category === filterCategory;
    return matchQ && matchCat;
  });

  const presentCategories = ["All", ...new Set(books.map(b => b.category).filter(Boolean))];

  const sortedShelf = [...finishedBooks].sort((a, b) => {
    if (shelfSort === "date") return new Date(b.finished_at||0) - new Date(a.finished_at||0);
    if (shelfSort === "rating") return (journals[b.id]?.rating||0) - (journals[a.id]?.rating||0);
    if (shelfSort === "author") return (a.author||"").localeCompare(b.author||"");
    if (shelfSort === "category") return (a.category||"").localeCompare(b.category||"");
    return 0;
  });

  const cachedCount = Object.keys(cachedChunks).length;
  const allCached = chunks.length > 0 && cachedCount >= chunks.length;
  const wordCount = activeBook?.word_count || 0;
  const estMinutes = Math.round(wordCount / 150);

  const now2 = new Date();
  const periodStart = {
    week: new Date(now2.getTime() - 7*24*60*60*1000),
    month: new Date(now2.getFullYear(), now2.getMonth(), 1),
    quarter: new Date(now2.getFullYear(), Math.floor(now2.getMonth()/3)*3, 1),
    year: new Date(now2.getFullYear(), 0, 1),
  }[wrappedPeriod];

  const periodBooks = finishedBooks.filter(b => b.finished_at && new Date(b.finished_at) >= periodStart);
  const periodHours = Math.round(periodBooks.reduce((s,b) => s+(b.word_count||0), 0)/150/60*10)/10;

  const catCount = {};
  periodBooks.forEach(b => { if (b.category) catCount[b.category] = (catCount[b.category]||0)+1; });
  const topCats = Object.entries(catCount).sort((a,b) => b[1]-a[1]);

  const authCount = {};
  periodBooks.forEach(b => { if (b.author && b.author !== "Unknown Author") authCount[b.author] = (authCount[b.author]||0)+1; });
  const topAuthors = Object.entries(authCount).sort((a,b) => b[1]-a[1]);

  const monthBreakdown = Array.from({length:12},(_,m) => ({
    label: MONTH_LABELS[m],
    count: booksThisYear.filter(b => new Date(b.finished_at).getMonth()===m).length,
  }));
  const maxMonth = Math.max(1, ...monthBreakdown.map(m => m.count));

  const totalHours = Math.round(finishedBooks.reduce((s,b)=>s+(b.word_count||0),0)/150/60*10)/10;
  const quote = READING_QUOTES[quoteIdx];

  const inProgress = books.filter(b => {
    const pct = b.chunk_count ? ((b.reading_progress?.[0]?.current_chunk||0)/b.chunk_count)*100 : 0;
    return pct > 0 && pct < 100;
  }).length;

  // ── CSS

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    body{background:#080510;overflow-x:hidden;}
    @keyframes wave{from{transform:scaleY(0.4);transform-origin:center}to{transform:scaleY(1.4);transform-origin:center}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.4}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
    @keyframes dropIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
    @keyframes shimmer{0%,100%{opacity:0.7}50%{opacity:1}}
    @keyframes floatOrb{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}
    @keyframes confettiFall{to{transform:translateY(105vh) rotate(720deg);opacity:0}}
    @keyframes glow{0%,100%{box-shadow:0 0 24px rgba(124,58,237,0.4)}50%{box-shadow:0 0 48px rgba(192,132,252,0.65)}}
    @keyframes slideIn{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:translateX(0)}}
    @keyframes popIn{from{opacity:0;transform:scale(0.85)}to{opacity:1;transform:scale(1)}}
    .fade-up{animation:fadeUp 0.35s ease forwards}
    .pop-in{animation:popIn 0.3s cubic-bezier(0.34,1.56,0.64,1) forwards}
    .card{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:16px;padding:1.5rem}
    .glass{background:rgba(17,13,26,0.85);backdrop-filter:blur(20px);border:0.5px solid rgba(192,132,252,0.12);border-radius:16px}
    .btn-purple{background:linear-gradient(135deg,#7c3aed,#9333ea);border:none;border-radius:50%;color:#f0ecf8;cursor:pointer;transition:transform 0.15s,box-shadow 0.2s;display:flex;align-items:center;justify-content:center;animation:glow 3s ease infinite}
    .btn-purple:hover{transform:scale(1.06)}
    .btn-purple:active{transform:scale(0.96)}
    .btn-purple:disabled{background:#2d1f4a;color:#555;cursor:not-allowed;animation:none;box-shadow:none}
    .btn-ghost{background:transparent;border:0.5px solid #2d1f4a;border-radius:8px;color:#7c6a9a;cursor:pointer;font-family:'Space Mono',monospace;font-size:11px;padding:6px 14px;transition:border-color 0.2s,color 0.2s}
    .btn-ghost:hover{border-color:#c084fc;color:#c084fc}
    .btn-ghost:disabled{opacity:0.3;cursor:not-allowed}
    .btn-icon{background:transparent;border:0.5px solid #2d1f4a;border-radius:8px;color:#7c6a9a;cursor:pointer;padding:8px 14px;font-family:'Space Mono',monospace;font-size:11px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:6px}
    .btn-icon:hover{border-color:#c084fc;color:#c084fc}
    .btn-icon:disabled{opacity:0.3;cursor:not-allowed}
    .btn-danger{background:transparent;border:0.5px solid #3a1a1a;border-radius:8px;color:#e06060;cursor:pointer;padding:8px 14px;font-family:'Space Mono',monospace;font-size:11px;transition:all 0.15s;display:flex;align-items:center;justify-content:center;gap:6px}
    .btn-danger:hover{border-color:#e06060;background:rgba(200,60,60,0.08)}
    .btn-danger:disabled{opacity:0.3;cursor:not-allowed}
    .speed-btn{background:transparent;border:0.5px solid #2d1f4a;border-radius:6px;color:#55446a;cursor:pointer;font-family:'Space Mono',monospace;font-size:10px;padding:4px 8px;transition:all 0.15s}
    .speed-btn:hover{border-color:#6d4fa0;color:#9b7cc8}
    .speed-btn.active{border-color:#c084fc;color:#c084fc;background:rgba(192,132,252,0.08)}
    .book-card{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:12px;padding:1.25rem;cursor:pointer;transition:border-color 0.2s,background 0.2s,box-shadow 0.2s;position:relative}
    .book-card:hover{border-color:#7c3aed;background:#160f26;box-shadow:0 0 20px rgba(124,58,237,0.14)}
    .drop-zone{border:1px dashed #2d1f4a;border-radius:12px;padding:2rem 1.5rem;text-align:center;cursor:pointer;transition:border-color 0.2s,background 0.2s}
    .drop-zone:hover,.drop-zone.active{border-color:#c084fc;background:rgba(192,132,252,0.04)}
    .progress-bar{height:3px;background:#1e1530;border-radius:2px;overflow:hidden;cursor:pointer}
    .progress-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#c084fc);border-radius:2px;transition:width 0.3s linear}
    .orb{position:fixed;border-radius:50%;filter:blur(80px);pointer-events:none;z-index:0}
    .delete-btn{position:absolute;top:10px;right:10px;background:transparent;border:none;color:#3d2f5c;cursor:pointer;font-size:14px;padding:4px;border-radius:4px;opacity:0;transition:opacity 0.2s,color 0.2s}
    .book-card:hover .delete-btn{opacity:1}
    .delete-btn:hover{color:#e06060}
    .voice-dropdown{position:absolute;top:calc(100% + 6px);left:0;right:0;background:#160f26;border:0.5px solid #3a2560;border-radius:10px;z-index:50;overflow:hidden;animation:dropIn 0.15s ease forwards;max-height:280px;overflow-y:auto}
    .voice-option{padding:10px 14px;cursor:pointer;transition:background 0.15s;border-bottom:0.5px solid #1e1530}
    .voice-option:last-child{border-bottom:none}
    .voice-option:hover{background:#1e1530}
    .voice-option.active{background:rgba(192,132,252,0.08)}
    .voice-dropdown::-webkit-scrollbar{width:4px}
    .voice-dropdown::-webkit-scrollbar-thumb{background:#3a2560;border-radius:2px}
    .confirm-box{background:rgba(192,132,252,0.05);border:0.5px solid rgba(192,132,252,0.2);border-radius:10px;padding:12px 14px;margin-bottom:10px}
    .stat-pill{background:rgba(124,58,237,0.12);border:0.5px solid rgba(124,58,237,0.25);border-radius:20px;padding:5px 14px;font-family:'Space Mono',monospace;font-size:10px;color:#9b7cc8;display:inline-flex;align-items:center;gap:5px}
    .chip{background:rgba(124,58,237,0.1);border:0.5px solid #3a2560;border-radius:20px;padding:5px 14px;font-family:'Space Mono',monospace;font-size:10px;color:#7c6a9a;cursor:pointer;transition:all 0.15s;white-space:nowrap}
    .chip:hover{border-color:#c084fc;color:#c084fc}
    .chip.active{background:rgba(192,132,252,0.15);border-color:#c084fc;color:#c084fc}
    .wrapped-card{border-radius:20px;padding:2rem;position:relative;overflow:hidden;margin-bottom:12px}
    .search-input{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:10px;padding:10px 14px 10px 38px;color:#f0ecf8;font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;transition:border-color 0.2s}
    .search-input:focus{border-color:#7c3aed}
    .search-input::placeholder{color:#4a3a68}
    .journal-textarea{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:10px;padding:12px 14px;color:#f0ecf8;font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;resize:vertical;min-height:100px;transition:border-color 0.2s;line-height:1.6}
    .journal-textarea:focus{border-color:#7c3aed}
    .journal-textarea::placeholder{color:#4a3a68}
    .modal-overlay{position:fixed;inset:0;background:rgba(8,5,16,0.88);backdrop-filter:blur(8px);z-index:200;display:flex;align-items:flex-end;justify-content:center}
    .modal-box{background:#110d1a;border:0.5px solid #3a2560;border-radius:20px 20px 0 0;padding:2rem;width:100%;max-width:600px;animation:slideUp 0.3s ease}
    @keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
    .select-input{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:10px;padding:10px 14px;color:#f0ecf8;font-family:'Space Mono',monospace;font-size:11px;width:100%;outline:none;cursor:pointer}
    .text-input{background:#110d1a;border:0.5px solid #2d1f4a;border-radius:10px;padding:10px 14px;color:#f0ecf8;font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;transition:border-color 0.2s}
    .text-input:focus{border-color:#7c3aed}
    .text-input::placeholder{color:#4a3a68}
    .shelf-empty{text-align:center;padding:4rem 1rem;color:#3d2f5c;font-family:'Space Mono',monospace;font-size:12px}
    ::-webkit-scrollbar{width:4px}
    ::-webkit-scrollbar-track{background:transparent}
    ::-webkit-scrollbar-thumb{background:#2d1f4a;border-radius:2px}
  `;

  const showNav = !["player","journal"].includes(screen);

  return (
    <div style={{ minHeight:"100vh", background:"#080510", fontFamily:"'Crimson Pro',Georgia,serif",
      position:"relative", overflow:"hidden", paddingBottom: showNav ? 80 : 0 }}>
      <style>{css}</style>

      {/* Ambient orbs */}
      <div className="orb" style={{ width:600, height:600, background:"rgba(124,58,237,0.065)", top:-200, right:-200, animation:"floatOrb 9s ease-in-out infinite" }} />
      <div className="orb" style={{ width:400, height:400, background:"rgba(76,29,149,0.08)", bottom:-120, left:-120, animation:"floatOrb 12s ease-in-out 3s infinite" }} />
      <div className="orb" style={{ width:250, height:250, background:"rgba(192,132,252,0.04)", top:"45%", left:"25%", animation:"floatOrb 15s ease-in-out 6s infinite" }} />

      {/* Audio elements */}
      <audio ref={audioRef} onEnded={handleEnded} onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)} />
      <audio ref={preloadRef} preload="auto" style={{ display:"none" }} />

      {/* Bottom nav */}
      {showNav && <BottomNav screen={screen} setScreen={setScreen} finishedCount={finishedCount} />}

      {/* ── Upload Modal ───────────────────────────────────────────────────── */}
      {uploadPending && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setUploadPending(null); }}>
          <div className="modal-box">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1.5rem" }}>
              <div>
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc", letterSpacing:"0.2em", textTransform:"uppercase", marginBottom:4 }}>New book</p>
                <h3 style={{ fontSize:"1.3rem", fontWeight:300, color:"#f0ecf8" }}>Tell us about it</h3>
              </div>
              <BookCover book={{ title: uploadForm.title || "Preview", author: uploadForm.author }} size="sm" />
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:12, marginBottom:"1.5rem" }}>
              <div>
                <label style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#7c6a9a", textTransform:"uppercase", letterSpacing:"0.15em", display:"block", marginBottom:6 }}>Title</label>
                <input className="text-input" value={uploadForm.title}
                  onChange={e => setUploadForm(p => ({ ...p, title: e.target.value }))} placeholder="Book title…" />
              </div>
              <div>
                <label style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#7c6a9a", textTransform:"uppercase", letterSpacing:"0.15em", display:"block", marginBottom:6 }}>Author</label>
                <input className="text-input" value={uploadForm.author}
                  onChange={e => setUploadForm(p => ({ ...p, author: e.target.value }))} placeholder="Author name…" />
              </div>
              <div>
                <label style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#7c6a9a", textTransform:"uppercase", letterSpacing:"0.15em", display:"block", marginBottom:6 }}>Category</label>
                <select className="select-input" value={uploadForm.category}
                  onChange={e => setUploadForm(p => ({ ...p, category: e.target.value }))}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display:"flex", gap:10 }}>
              <button className="btn-ghost" onClick={() => setUploadPending(null)} style={{ flex:1 }}>Cancel</button>
              <button onClick={confirmUpload} disabled={uploading}
                style={{ flex:2, background:"linear-gradient(135deg,#7c3aed,#9333ea)", border:"none", borderRadius:10,
                  color:"#f0ecf8", cursor:"pointer", padding:"12px", fontFamily:"'Space Mono',monospace", fontSize:11,
                  fontWeight:700, display:"flex", alignItems:"center", justifyContent:"center", gap:8,
                  opacity: uploading ? 0.6 : 1 }}>
                {uploading
                  ? <><div style={{ width:14, height:14, border:"2px solid #f0ecf8", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> Adding…</>
                  : "Add to collection ✦"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Book Complete Overlay ──────────────────────────────────────────── */}
      {showBookComplete && (
        <>
          <Confetti />
          <div style={{ position:"fixed", inset:0, background:"rgba(8,5,16,0.95)", backdropFilter:"blur(12px)",
            zIndex:250, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center",
            padding:"2rem", textAlign:"center", animation:"fadeUp 0.5s ease" }}>
            <div style={{ fontSize:64, marginBottom:16, animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.2s both" }}>📖</div>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc", letterSpacing:"0.3em",
              textTransform:"uppercase", marginBottom:12, animation:"fadeUp 0.5s ease 0.3s both" }}>
              Book complete ✦
            </p>
            <h2 style={{ fontSize:"clamp(1.6rem,5vw,2.4rem)", fontWeight:300, color:"#f0ecf8", lineHeight:1.2,
              marginBottom:8, animation:"fadeUp 0.5s ease 0.4s both" }}>
              You did it, Victory!
            </h2>
            <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"1.1rem", color:"#9b7cc8",
              marginBottom:6, animation:"fadeUp 0.5s ease 0.5s both" }}>
              "{activeBook?.title}"
            </p>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68",
              marginBottom:"2.5rem", animation:"fadeUp 0.5s ease 0.6s both" }}>
              {activeBook?.word_count?.toLocaleString()} words · ~{Math.round((activeBook?.word_count||0)/150/60*10)/10} hrs listened
            </p>
            <div style={{ display:"flex", flexDirection:"column", gap:10, width:"100%", maxWidth:320,
              animation:"fadeUp 0.5s ease 0.7s both" }}>
              <button
                onClick={() => { setShowBookComplete(false); openJournal(activeBook); }}
                style={{ background:"linear-gradient(135deg,#7c3aed,#9333ea)", border:"none", borderRadius:12,
                  color:"#f0ecf8", cursor:"pointer", padding:"14px", fontFamily:"'Space Mono',monospace",
                  fontSize:12, fontWeight:700 }}>
                📝 Write about it
              </button>
              <button className="btn-icon"
                onClick={() => { setShowBookComplete(false); setScreen(fromScreen); fetchBooks(); }}>
                Back to {fromScreen === "shelf" ? "Shelf" : "Library"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* LIBRARY                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "library" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          {/* Header */}
          <div style={{ marginBottom:"1.75rem", textAlign:"center" }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.3em",
              color:"#7c3aed", textTransform:"uppercase", marginBottom:10, animation:"shimmer 3s ease infinite" }}>
              ✦ Your personal sanctuary ✦
            </p>
            <h1 style={{ fontSize:"clamp(1.8rem,6vw,2.6rem)", fontWeight:300, color:"#f0ecf8", lineHeight:1.2,
              marginBottom:6, textShadow:"0 0 40px rgba(192,132,252,0.35)" }}>
              Welcome, Victory
            </h1>
            <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"1.05rem", fontStyle:"italic", color:"#7c6a9a", fontWeight:300 }}>
              Victory's Book Collection
            </p>
          </div>

          {/* Stats row */}
          {!loadingBooks && books.length > 0 && (
            <div style={{ display:"flex", gap:8, justifyContent:"center", marginBottom:"1.5rem", flexWrap:"wrap" }}>
              <div className="stat-pill"><span style={{ color:"#c084fc" }}>◆</span>{books.length} books</div>
              {finishedCount > 0 && <div className="stat-pill"><span style={{ color:"#c084fc" }}>◆</span>{finishedCount} finished</div>}
              {inProgress > 0 && <div className="stat-pill"><span style={{ color:"#a78bfa" }}>◆</span>{inProgress} in progress</div>}
              {totalHours > 0 && <div className="stat-pill"><span style={{ color:"#c084fc" }}>◆</span>~{totalHours} hrs listened</div>}
            </div>
          )}

          {/* Drop zone */}
          <div className={`drop-zone ${dragOver ? "active" : ""}`} style={{ marginBottom:"1.25rem" }}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={e => { e.preventDefault(); setDragOver(false); handleFilePicked(e.dataTransfer.files[0]); }}>
            <input ref={fileInputRef} type="file" accept=".pdf" style={{ display:"none" }}
              onChange={e => handleFilePicked(e.target.files[0])} />
            {isLoading && loadingMsg.includes("PDF") ? (
              <div>
                <div style={{ width:24, height:24, border:"2px solid #c084fc", borderTopColor:"transparent",
                  borderRadius:"50%", margin:"0 auto 10px", animation:"spin 0.8s linear infinite" }} />
                <p style={{ color:"#7c6a9a", fontSize:13, animation:"pulse 1.5s ease infinite" }}>{loadingMsg}</p>
              </div>
            ) : (
              <>
                <div style={{ fontSize:28, marginBottom:8 }}>📚</div>
                <p style={{ color:"#7c6a9a", fontSize:14, marginBottom:4 }}>Add a book to your collection</p>
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#3d2f5c" }}>drop PDF here or click to browse</p>
              </>
            )}
          </div>

          {error && <div style={{ background:"rgba(200,60,60,0.08)", border:"0.5px solid rgba(200,60,60,0.25)",
            borderRadius:8, padding:"10px 14px", marginBottom:14 }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"#e06060" }}>⚠ {error}</p>
          </div>}

          {/* Search */}
          {books.length > 0 && (
            <div style={{ position:"relative", marginBottom:10 }}>
              <span style={{ position:"absolute", left:12, top:"50%", transform:"translateY(-50%)", color:"#4a3a68", fontSize:15 }}>🔍</span>
              <input className="search-input" placeholder="Search by title or author…"
                value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          )}

          {/* Category chips */}
          {books.length > 0 && (
            <div style={{ display:"flex", gap:8, overflowX:"auto", paddingBottom:8, marginBottom:"1.25rem",
              scrollbarWidth:"none" }}>
              {presentCategories.map(c => (
                <button key={c} className={`chip ${filterCategory === c ? "active" : ""}`}
                  onClick={() => setFilterCategory(c)}>{c}</button>
              ))}
            </div>
          )}

          {/* Book list */}
          {loadingBooks ? (
            <div style={{ textAlign:"center", padding:"2rem" }}>
              <div style={{ width:24, height:24, border:"2px solid #7c3aed", borderTopColor:"transparent",
                borderRadius:"50%", margin:"0 auto", animation:"spin 0.8s linear infinite" }} />
            </div>
          ) : filteredLibraryBooks.length === 0 ? (
            <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
              <p style={{ color:"#2d1f4a", fontSize:14, fontFamily:"'Space Mono',monospace" }}>
                {books.length === 0 ? "No books yet — upload your first PDF above" : "No books match your search"}
              </p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
              {filteredLibraryBooks.map(book => {
                const prog = book.reading_progress?.[0];
                const pct = book.chunk_count ? Math.round(((prog?.current_chunk||0)/book.chunk_count)*100) : 0;
                const lastOpened = prog?.last_opened ? new Date(prog.last_opened).toLocaleDateString("en-US",{month:"short",day:"numeric"}) : null;
                const isFinished = book.status === "finished";
                return (
                  <div key={book.id} className="book-card fade-up" onClick={() => openBook(book)}>
                    <button className="delete-btn" onClick={e => deleteBook(e, book.id, book.file_path)}>✕</button>
                    <div style={{ display:"flex", gap:12, alignItems:"flex-start" }}>
                      <BookCover book={book} size="sm" onClick={() => openBook(book)} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:4 }}>
                          <p style={{ fontSize:"1rem", fontWeight:600, color:"#f0ecf8", lineHeight:1.3, paddingRight:20 }}>{book.title}</p>
                          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:11,
                            color: isFinished ? "#5cb87a" : pct > 0 ? "#c084fc" : "#3d2f5c", flexShrink:0 }}>
                            {isFinished ? "✦" : `${pct}%`}
                          </span>
                        </div>
                        {book.author && book.author !== "Unknown Author" &&
                          <p style={{ fontSize:12, color:"#7c6a9a", fontStyle:"italic", marginBottom:4 }}>{book.author}</p>}
                        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap" }}>
                          {book.category && book.category !== "Uncategorized" &&
                            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#7c3aed",
                              background:"rgba(124,58,237,0.12)", borderRadius:10, padding:"2px 8px" }}>{book.category}</span>}
                          <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>
                            {(book.word_count||0).toLocaleString()} words
                            {lastOpened && ` · ${lastOpened}`}
                          </p>
                        </div>
                        <div className="progress-bar" style={{ marginTop:10, cursor:"default" }}>
                          <div className="progress-fill" style={{ width:`${isFinished?100:pct}%`, transition:"none",
                            background: isFinished ? "linear-gradient(90deg,#22c55e,#4ade80)" : undefined }} />
                        </div>
                        <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#3d2f5c", marginTop:4 }}>
                          {isFinished ? "complete ✦" : pct === 0 ? "not started" : "in progress"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote */}
          <div style={{ background:"rgba(124,58,237,0.06)", border:"0.5px solid rgba(124,58,237,0.15)",
            borderRadius:12, padding:"1.2rem 1.5rem", marginTop:"1.5rem" }}>
            <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"1.05rem", fontStyle:"italic",
              color:"#9b7cc8", lineHeight:1.6, marginBottom:8 }}>"{quote.text}"</p>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68", letterSpacing:"0.1em" }}>— {quote.author}</p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* PLAYER                                                              */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "player" && (
        <div style={{ maxWidth:520, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          <button className="btn-icon"
            onClick={() => { setScreen(fromScreen); setIsPlaying(false); audioRef.current?.pause(); saveProgress(currentChunk, audioRef.current?.currentTime||0); fetchBooks(); }}
            style={{ marginBottom:"1.5rem" }}>
            ← {fromScreen === "shelf" ? "Shelf" : "Library"}
          </button>

          <div style={{ marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.2em",
              color:"#c084fc", textTransform:"uppercase", marginBottom:6 }}>Now playing</p>
            <h2 style={{ fontSize:"clamp(1.2rem,4vw,1.6rem)", fontWeight:300, color:"#f0ecf8", lineHeight:1.3, marginBottom:4 }}>
              {activeBook?.title}
            </h2>
            {activeBook?.author && activeBook.author !== "Unknown Author" &&
              <p style={{ fontSize:"0.95rem", fontStyle:"italic", color:"#7c6a9a", marginBottom:4 }}>{activeBook.author}</p>}
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68", marginTop:4 }}>
              {wordCount.toLocaleString()} words · ~{estMinutes} min · {chunks.length} parts
              {cachedCount > 0 && <span style={{ color: allCached ? "#5cb87a" : "#c084fc" }}> · {cachedCount}/{chunks.length} ready</span>}
            </p>
          </div>

          {/* Voice selector */}
          <div style={{ marginBottom:12, position:"relative" }} ref={dropdownRef}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68",
              textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:6 }}>Voice</p>
            <button className="btn-icon" onClick={() => setShowVoiceDropdown(v => !v)}
              style={{ width:"100%", justifyContent:"space-between", padding:"10px 14px",
                borderColor: showVoiceDropdown ? "#c084fc" : "#2d1f4a",
                color: showVoiceDropdown ? "#c084fc" : "#7c6a9a" }}>
              <span style={{ display:"flex", flexDirection:"column", alignItems:"flex-start", gap:2 }}>
                <span style={{ fontSize:13, color:"#f0ecf8", fontFamily:"'Crimson Pro',serif" }}>{selectedVoice.label}</span>
                <span style={{ fontSize:10 }}>{selectedVoice.desc}</span>
              </span>
              <span style={{ fontSize:10 }}>{showVoiceDropdown ? "▲" : "▼"}</span>
            </button>
            {showVoiceDropdown && (
              <div className="voice-dropdown">
                {VOICE_OPTIONS.map(v => (
                  <div key={v.id} className={`voice-option ${selectedVoice.id===v.id?"active":""}`}
                    onClick={() => { setSelectedVoice(v); setShowVoiceDropdown(false); setIsPlaying(false); audioRef.current?.pause(); }}>
                    <p style={{ fontSize:14, color:"#f0ecf8", fontFamily:"'Crimson Pro',serif", marginBottom:2 }}>{v.label}</p>
                    <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#55446a" }}>{v.desc} · {v.lang}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ marginBottom:12 }}>
            {/* Overall progress */}
            <div style={{ marginBottom:"1.25rem" }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width:`${progress}%` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:6 }}>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68" }}>Part {currentChunk+1} / {chunks.length}</span>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68" }}>{Math.round(progress)}%</span>
              </div>
            </div>

            {/* Time scrubber */}
            <div style={{ marginBottom:"1.25rem" }}>
              <div className="progress-bar" onClick={e => {
                if (!audioRef.current || !duration) return;
                const rect = e.currentTarget.getBoundingClientRect();
                audioRef.current.currentTime = ((e.clientX-rect.left)/rect.width)*duration;
              }}>
                <div className="progress-fill" style={{ width:`${duration?(currentTime/duration)*100:0}%` }} />
              </div>
              <div style={{ display:"flex", justifyContent:"space-between", marginTop:4 }}>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#3d2f5c" }}>{fmt(currentTime)}</span>
                <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#3d2f5c" }}>{fmt(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10, marginBottom:"1.25rem" }}>
              <button className="btn-ghost" onClick={() => { if (currentChunk>0) playChunk(currentChunk-1); }}
                disabled={currentChunk===0} style={{ padding:"8px 12px", fontSize:12 }}>◀◀</button>
              <button className="btn-icon" onClick={() => handleSkip(-10)} style={{ padding:"8px 10px" }}>−10s</button>
              <button className="btn-purple" onClick={handlePlay} disabled={isLoading} style={{ width:64, height:64, fontSize:20 }}>
                {isLoading
                  ? <div style={{ width:20, height:20, border:"2px solid #f0ecf8", borderTopColor:"transparent", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
                  : isPlaying ? <WaveIcon playing /> : <span style={{ marginLeft:3 }}>▶</span>}
              </button>
              <button className="btn-icon" onClick={() => handleSkip(10)} style={{ padding:"8px 10px" }}>+10s</button>
              <button className="btn-ghost" onClick={() => { if (currentChunk<chunks.length-1) playChunk(currentChunk+1); }}
                disabled={currentChunk===chunks.length-1} style={{ padding:"8px 12px", fontSize:12 }}>▶▶</button>
            </div>

            {/* Speed */}
            <div style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:6 }}>
              <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#3d2f5c", marginRight:4 }}>SPEED</span>
              {[0.75,1,1.25,1.5,1.75,2].map(s => (
                <button key={s} className={`speed-btn ${speed===s?"active":""}`}
                  onClick={() => { setSpeed(s); if (audioRef.current) audioRef.current.playbackRate=s; }}>{s}×</button>
              ))}
            </div>

            {isLoading && loadingMsg && (
              <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc",
                textAlign:"center", marginTop:"1rem", animation:"pulse 1.5s ease infinite" }}>{loadingMsg}</p>
            )}
          </div>

          {/* Regen confirm */}
          {showRegenConfirm && (
            <div className="confirm-box">
              <p style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"#c084fc", marginBottom:8 }}>
                Regenerate all audio as <strong>{selectedVoice.label}</strong>?
              </p>
              <div style={{ display:"flex", gap:8 }}>
                <button className="btn-ghost" onClick={() => setShowRegenConfirm(false)} style={{ flex:1 }}>Cancel</button>
                <button className="btn-danger" onClick={() => handlePregenerate(true)} style={{ flex:1 }}>Yes, regenerate</button>
              </div>
            </div>
          )}

          {/* Actions */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:12 }}>
            <button className="btn-icon" onClick={() => handlePregenerate(false)}
              disabled={!!pregenProgress || allCached} style={{ fontSize:10 }}>
              {pregenProgress ? `Buffering ${pregenProgress.done}/${pregenProgress.total}…` : allCached ? "✦ All ready" : "⚡ Pre-buffer all"}
            </button>
            <button className="btn-danger" onClick={() => setShowRegenConfirm(true)}
              disabled={!!pregenProgress} style={{ fontSize:10 }}>↺ Regenerate</button>
            <button className="btn-icon" onClick={handleDownload}
              disabled={isLoading || cachedCount===0} style={{ gridColumn:"1/-1", fontSize:10 }}>
              ↓ Download MP3 ({selectedVoice.label})
            </button>
          </div>

          {error && <div style={{ background:"rgba(200,60,60,0.08)", border:"0.5px solid rgba(200,60,60,0.25)",
            borderRadius:8, padding:"10px 14px", marginBottom:12 }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:11, color:"#e06060" }}>⚠ {error}</p>
          </div>}

          <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#1e1530", textAlign:"center", marginTop:8 }}>
            3 chunks pre-buffered · progress auto-saved
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* SHELF                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "shelf" && (
        <div style={{ maxWidth:600, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          <div style={{ marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.25em",
              color:"#c084fc", textTransform:"uppercase", marginBottom:6 }}>✦ Finished books</p>
            <h2 style={{ fontSize:"clamp(1.4rem,4vw,2rem)", fontWeight:300, color:"#f0ecf8" }}>Your Shelf</h2>
            {finishedCount > 0 && (
              <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68", marginTop:4 }}>
                {finishedCount} {finishedCount===1?"book":"books"} · ~{totalHours} hrs total
              </p>
            )}
          </div>

          {/* Sort controls */}
          {finishedCount > 0 && (
            <div style={{ display:"flex", gap:8, marginBottom:"1.5rem", flexWrap:"wrap" }}>
              {["date","rating","author","category"].map(s => (
                <button key={s} className={`chip ${shelfSort===s?"active":""}`} onClick={() => setShelfSort(s)}>
                  {s==="date"?"Recent":s==="rating"?"Top rated":s==="author"?"Author":"Category"}
                </button>
              ))}
            </div>
          )}

          {finishedCount === 0 ? (
            <div className="shelf-empty">
              <div style={{ fontSize:48, marginBottom:16 }}>🏛️</div>
              <p style={{ fontSize:14, marginBottom:8 }}>Your shelf is empty</p>
              <p style={{ fontSize:11, color:"#2d1f4a" }}>Finish a book to see it here</p>
            </div>
          ) : (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {sortedShelf.map(book => {
                const j = journals[book.id];
                const isSelected = selectedShelfBook?.id === book.id;
                const finDate = book.finished_at ? new Date(book.finished_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}) : null;
                return (
                  <div key={book.id} className="fade-up"
                    style={{ background:"#110d1a", border:`0.5px solid ${isSelected?"#7c3aed":"#2d1f4a"}`,
                      borderRadius:14, overflow:"hidden", transition:"border-color 0.2s, box-shadow 0.2s",
                      boxShadow: isSelected ? "0 0 20px rgba(124,58,237,0.2)" : "none" }}>
                    <div style={{ display:"flex", gap:14, padding:"1.1rem", cursor:"pointer", alignItems:"flex-start" }}
                      onClick={() => setSelectedShelfBook(isSelected ? null : book)}>
                      <BookCover book={book} size="sm" onClick={() => {}} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:"1rem", fontWeight:600, color:"#f0ecf8", lineHeight:1.3, marginBottom:4 }}>{book.title}</p>
                        {book.author && book.author !== "Unknown Author" &&
                          <p style={{ fontSize:12, color:"#7c6a9a", fontStyle:"italic", marginBottom:6 }}>{book.author}</p>}
                        <div style={{ display:"flex", gap:8, alignItems:"center", flexWrap:"wrap", marginBottom:6 }}>
                          {book.category && book.category !== "Uncategorized" &&
                            <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#7c3aed",
                              background:"rgba(124,58,237,0.12)", borderRadius:10, padding:"2px 8px" }}>{book.category}</span>}
                          {finDate && <span style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>Finished {finDate}</span>}
                        </div>
                        {j?.rating > 0 && <Stars value={j.rating} readonly />}
                        {j?.rating === 0 && <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#2d1f4a" }}>No rating yet</p>}
                      </div>
                      <span style={{ color:"#4a3a68", fontSize:12, flexShrink:0, marginTop:4 }}>{isSelected?"▲":"▼"}</span>
                    </div>

                    {/* Expanded actions */}
                    {isSelected && (
                      <div style={{ borderTop:"0.5px solid #2d1f4a", padding:"1rem", display:"flex", gap:8, flexWrap:"wrap",
                        animation:"dropIn 0.15s ease" }}>
                        {j && (j.learned || j.takeaways || j.actions) && (
                          <div style={{ width:"100%", marginBottom:8, padding:"10px 12px",
                            background:"rgba(124,58,237,0.06)", borderRadius:8 }}>
                            {j.learned && <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:13, color:"#9b7cc8",
                              lineHeight:1.5, display:"-webkit-box", WebkitLineClamp:2, WebkitBoxOrient:"vertical", overflow:"hidden" }}>
                              "{j.learned.substring(0,120)}{j.learned.length>120?"…":""}"</p>}
                          </div>
                        )}
                        <button onClick={() => openBook(book)} className="btn-icon" style={{ flex:1, fontSize:10 }}>▶ Listen again</button>
                        <button onClick={() => openJournal(book)} className="btn-icon" style={{ flex:1, fontSize:10 }}>
                          📝 {j ? "View journal" : "Write journal"}
                        </button>
                        <button onClick={() => { if (confirm("Repeat this book? Progress will reset.")) repeatBook(book); }}
                          className="btn-ghost" style={{ flex:1, fontSize:10 }}>↺ Restart</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* JOURNAL                                                             */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "journal" && journalBook && (
        <div style={{ maxWidth:580, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          <button className="btn-icon" onClick={() => setScreen(fromScreen)} style={{ marginBottom:"1.5rem" }}>
            ← Back
          </button>

          <div style={{ display:"flex", gap:14, alignItems:"flex-start", marginBottom:"2rem" }}>
            <BookCover book={journalBook} size="md" onClick={() => {}} />
            <div>
              <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.2em",
                color:"#c084fc", textTransform:"uppercase", marginBottom:6 }}>📝 Book journal</p>
              <h2 style={{ fontSize:"clamp(1.1rem,3.5vw,1.5rem)", fontWeight:300, color:"#f0ecf8", lineHeight:1.3, marginBottom:4 }}>
                {journalBook.title}
              </h2>
              {journalBook.author && journalBook.author !== "Unknown Author" &&
                <p style={{ fontSize:13, color:"#7c6a9a", fontStyle:"italic", marginBottom:10 }}>{journalBook.author}</p>}
              <Stars value={journalForm.rating} onChange={r => setJournalForm(p => ({ ...p, rating: r }))} />
            </div>
          </div>

          <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
            {/* Section 1 */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(124,58,237,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>💡</div>
                <div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc",
                    textTransform:"uppercase", letterSpacing:"0.15em" }}>What I learned</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>Key ideas that shifted your perspective</p>
                </div>
              </div>
              <textarea className="journal-textarea" rows={4}
                placeholder="What new ideas, concepts, or perspectives did this book give you?"
                value={journalForm.learned}
                onChange={e => setJournalForm(p => ({ ...p, learned: e.target.value }))} />
            </div>

            {/* Section 2 */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(124,58,237,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>⭐</div>
                <div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc",
                    textTransform:"uppercase", letterSpacing:"0.15em" }}>Key takeaways</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>The moments and lines that stuck with you</p>
                </div>
              </div>
              <textarea className="journal-textarea" rows={4}
                placeholder="• Memorable quotes or passages&#10;• Concepts you want to remember&#10;• Things that surprised you"
                value={journalForm.takeaways}
                onChange={e => setJournalForm(p => ({ ...p, takeaways: e.target.value }))} />
            </div>

            {/* Section 3 */}
            <div>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ width:28, height:28, borderRadius:"50%", background:"rgba(124,58,237,0.2)",
                  display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, flexShrink:0 }}>🚀</div>
                <div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc",
                    textTransform:"uppercase", letterSpacing:"0.15em" }}>Action steps</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>What will you actually do differently?</p>
                </div>
              </div>
              <textarea className="journal-textarea" rows={4}
                placeholder="1. Start doing…&#10;2. Stop doing…&#10;3. Change how I…"
                value={journalForm.actions}
                onChange={e => setJournalForm(p => ({ ...p, actions: e.target.value }))} />
            </div>
          </div>

          <button onClick={saveJournal} disabled={savingJournal}
            style={{ width:"100%", marginTop:"1.5rem", background:"linear-gradient(135deg,#7c3aed,#9333ea)",
              border:"none", borderRadius:12, color:"#f0ecf8", cursor:"pointer", padding:"14px",
              fontFamily:"'Space Mono',monospace", fontSize:12, fontWeight:700,
              display:"flex", alignItems:"center", justifyContent:"center", gap:8,
              opacity: savingJournal ? 0.6 : 1, transition:"opacity 0.2s" }}>
            {savingJournal
              ? <><div style={{ width:14, height:14, border:"2px solid #f0ecf8", borderTopColor:"transparent",
                  borderRadius:"50%", animation:"spin 0.8s linear infinite" }} /> Saving…</>
              : "Save journal entry ✦"}
          </button>

          <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#2d1f4a", textAlign:"center", marginTop:12 }}>
            Auto-saved to your collection
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* GOALS                                                               */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "goals" && (
        <div style={{ maxWidth:580, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          <div style={{ marginBottom:"1.75rem" }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.25em",
              color:"#c084fc", textTransform:"uppercase", marginBottom:6 }}>🎯 Reading goals</p>
            <h2 style={{ fontSize:"clamp(1.4rem,4vw,2rem)", fontWeight:300, color:"#f0ecf8" }}>{thisYear} Goal</h2>
          </div>

          {/* Annual goal ring */}
          <div className="card" style={{ display:"flex", flexDirection:"column", alignItems:"center", marginBottom:16, padding:"2rem" }}>
            <div style={{ position:"relative", marginBottom:"1.5rem" }}>
              <CircleProgress value={booksThisYear.length} max={GOAL} size={160} stroke={13} />
              <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column",
                alignItems:"center", justifyContent:"center" }}>
                <p style={{ fontSize:"2.5rem", fontWeight:300, color:"#f0ecf8", lineHeight:1 }}>
                  {booksThisYear.length}
                </p>
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#7c6a9a" }}>of {GOAL}</p>
              </div>
            </div>
            <p style={{ fontFamily:"'Crimson Pro',serif", fontSize:"1.1rem", color:"#9b7cc8", fontStyle:"italic", marginBottom:6 }}>
              {booksThisYear.length === 0
                ? "Your journey starts with the first book ✦"
                : booksThisYear.length < GOAL / 2
                ? "You're building momentum, Victory!"
                : booksThisYear.length < GOAL
                ? `${GOAL - booksThisYear.length} more to go — you've got this!`
                : "Goal achieved! You're a reading queen ✦"}
            </p>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#4a3a68" }}>
              {Math.round(booksThisYear.length/GOAL*100)}% complete
            </p>

            {/* Milestones */}
            <div style={{ display:"flex", gap:12, marginTop:"1.5rem", flexWrap:"wrap", justifyContent:"center" }}>
              {[{n:3,icon:"🌱",label:"3 books"},{n:6,icon:"🌸",label:"Halfway"},{n:9,icon:"⭐",label:"9 books"},{n:12,icon:"🏆",label:"Goal!"}].map(m => (
                <div key={m.n} style={{ textAlign:"center", opacity: booksThisYear.length >= m.n ? 1 : 0.3,
                  transition:"opacity 0.3s", filter: booksThisYear.length >= m.n ? "none" : "grayscale(1)" }}>
                  <div style={{ fontSize:28, marginBottom:4 }}>{m.icon}</div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color: booksThisYear.length >= m.n ? "#c084fc" : "#4a3a68" }}>
                    {m.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Monthly breakdown */}
          <div className="card">
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#7c6a9a",
              textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"1.25rem" }}>Monthly breakdown</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(6,1fr)", gap:8 }}>
              {monthBreakdown.map((m, i) => {
                const isPast = i <= new Date().getMonth();
                const barH = m.count > 0 ? Math.max(20, (m.count / maxMonth) * 60) : 4;
                return (
                  <div key={m.label} style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:4 }}>
                    <div style={{ display:"flex", alignItems:"flex-end", height:64 }}>
                      <div style={{ width:24, height:barH, borderRadius:4,
                        background: m.count > 0 ? "linear-gradient(180deg,#c084fc,#7c3aed)" : (isPast ? "#1e1530" : "#160f26"),
                        transition:"height 0.6s ease" }} />
                    </div>
                    <p style={{ fontFamily:"'Space Mono',monospace", fontSize:8,
                      color: m.count > 0 ? "#c084fc" : isPast ? "#3d2f5c" : "#2d1f4a" }}>
                      {m.label}
                    </p>
                    {m.count > 0 && (
                      <p style={{ fontFamily:"'Space Mono',monospace", fontSize:8, color:"#7c6a9a" }}>{m.count}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-time stats */}
          {finishedCount > 0 && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:10, marginTop:12 }}>
              {[
                { label:"All-time books", value: finishedCount },
                { label:"Hours listened", value: `${totalHours}h` },
                { label:"Avg per month", value: (finishedCount/Math.max(1,new Date().getMonth()+1)).toFixed(1) },
                { label:"This year", value: booksThisYear.length },
              ].map(s => (
                <div key={s.label} style={{ background:"#110d1a", border:"0.5px solid #2d1f4a",
                  borderRadius:12, padding:"1rem", textAlign:"center" }}>
                  <p style={{ fontSize:"1.8rem", fontWeight:300, color:"#c084fc", lineHeight:1, marginBottom:4 }}>{s.value}</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:9, color:"#4a3a68" }}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════════════════ */}
      {/* WRAPPED / ANALYTICS                                                 */}
      {/* ════════════════════════════════════════════════════════════════════ */}
      {screen === "wrapped" && (
        <div style={{ maxWidth:580, margin:"0 auto", padding:"2rem 1rem", position:"relative", zIndex:1 }}>
          <div style={{ marginBottom:"1.5rem" }}>
            <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, letterSpacing:"0.25em",
              color:"#c084fc", textTransform:"uppercase", marginBottom:6 }}>✦ Analytics</p>
            <h2 style={{ fontSize:"clamp(1.4rem,4vw,2rem)", fontWeight:300, color:"#f0ecf8" }}>Victory Wrapped</h2>
          </div>

          {/* Period selector */}
          <div style={{ display:"flex", gap:8, marginBottom:"1.5rem" }}>
            {["week","month","quarter","year"].map(p => (
              <button key={p} className={`chip ${wrappedPeriod===p?"active":""}`} onClick={() => setWrappedPeriod(p)}
                style={{ flex:1, textAlign:"center", textTransform:"capitalize" }}>{p}</button>
            ))}
          </div>

          {periodBooks.length === 0 ? (
            <div style={{ textAlign:"center", padding:"3rem 1rem" }}>
              <div style={{ fontSize:48, marginBottom:12 }}>📊</div>
              <p style={{ color:"#3d2f5c", fontFamily:"'Space Mono',monospace", fontSize:12 }}>
                No finished books this {wrappedPeriod}
              </p>
              <p style={{ color:"#2d1f4a", fontFamily:"'Space Mono',monospace", fontSize:10, marginTop:6 }}>
                Keep listening — your stats will show up here
              </p>
            </div>
          ) : (
            <>
              {/* Wrapped cards */}
              <div className="wrapped-card" style={{ background:"linear-gradient(135deg,#1a0536,#3b0764)" }}>
                <div style={{ position:"absolute", top:0, right:0, fontSize:80, opacity:0.08, lineHeight:1 }}>📚</div>
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"rgba(192,132,252,0.7)",
                  textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:8 }}>Books read</p>
                <p style={{ fontSize:"4rem", fontWeight:300, color:"#f0ecf8", lineHeight:1, marginBottom:6 }}>{periodBooks.length}</p>
                <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"1.05rem", color:"#c084fc" }}>
                  {periodBooks.length === 1 ? "One down, many to go ✦" : `${periodBooks.length} books of pure wisdom ✦`}
                </p>
              </div>

              <div className="wrapped-card" style={{ background:"linear-gradient(135deg,#0c1445,#1e3a8a)" }}>
                <div style={{ position:"absolute", top:0, right:0, fontSize:80, opacity:0.08, lineHeight:1 }}>⏱️</div>
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"rgba(147,197,253,0.7)",
                  textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:8 }}>Hours absorbed</p>
                <p style={{ fontSize:"4rem", fontWeight:300, color:"#f0ecf8", lineHeight:1, marginBottom:6 }}>{periodHours}</p>
                <p style={{ fontFamily:"'Crimson Pro',serif", fontStyle:"italic", fontSize:"1.05rem", color:"#93c5fd" }}>
                  hours of knowledge, Victory ✦
                </p>
              </div>

              {topCats.length > 0 && (
                <div className="wrapped-card" style={{ background:"linear-gradient(135deg,#0a2014,#14532d)" }}>
                  <div style={{ position:"absolute", top:0, right:0, fontSize:80, opacity:0.08, lineHeight:1 }}>📂</div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"rgba(134,239,172,0.7)",
                    textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:8 }}>Top category</p>
                  <p style={{ fontSize:"2.2rem", fontWeight:300, color:"#f0ecf8", lineHeight:1.2, marginBottom:6 }}>{topCats[0][0]}</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#86efac" }}>
                    {topCats[0][1]} {topCats[0][1]===1?"book":"books"} in this category
                  </p>
                </div>
              )}

              {topAuthors.length > 0 && (
                <div className="wrapped-card" style={{ background:"linear-gradient(135deg,#2d0836,#581c87)" }}>
                  <div style={{ position:"absolute", top:0, right:0, fontSize:80, opacity:0.08, lineHeight:1 }}>✍️</div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"rgba(216,180,254,0.7)",
                    textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:8 }}>Favourite author</p>
                  <p style={{ fontSize:"2rem", fontWeight:300, color:"#f0ecf8", lineHeight:1.2, marginBottom:6 }}>{topAuthors[0][0]}</p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#d8b4fe" }}>
                    {topAuthors[0][1]} {topAuthors[0][1]===1?"book":"books"} listened
                  </p>
                </div>
              )}

              {wrappedPeriod === "year" && (
                <div className="wrapped-card" style={{ background:"linear-gradient(135deg,#1c1917,#44403c)" }}>
                  <div style={{ position:"absolute", top:0, right:0, fontSize:80, opacity:0.08, lineHeight:1 }}>🎯</div>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"rgba(214,211,209,0.7)",
                    textTransform:"uppercase", letterSpacing:"0.2em", marginBottom:8 }}>Goal progress</p>
                  <p style={{ fontSize:"4rem", fontWeight:300, color:"#f0ecf8", lineHeight:1, marginBottom:6 }}>
                    {Math.round(booksThisYear.length/GOAL*100)}%
                  </p>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#d6d3d1" }}>
                    {booksThisYear.length}/{GOAL} books towards your goal
                  </p>
                </div>
              )}

              {/* Category breakdown */}
              {topCats.length > 1 && (
                <div className="card" style={{ marginBottom:12 }}>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#7c6a9a",
                    textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"1.25rem" }}>Category breakdown</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {topCats.map(([cat, cnt]) => (
                      <div key={cat}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:"'Crimson Pro',serif", fontSize:14, color:"#f0ecf8" }}>{cat}</span>
                          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc" }}>{cnt}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width:`${(cnt/topCats[0][1])*100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Author breakdown */}
              {topAuthors.length > 1 && (
                <div className="card" style={{ marginBottom:12 }}>
                  <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#7c6a9a",
                    textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"1.25rem" }}>Author breakdown</p>
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {topAuthors.map(([auth, cnt]) => (
                      <div key={auth}>
                        <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                          <span style={{ fontFamily:"'Crimson Pro',serif", fontSize:14, color:"#f0ecf8" }}>{auth}</span>
                          <span style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#c084fc" }}>{cnt}</span>
                        </div>
                        <div className="progress-bar">
                          <div className="progress-fill" style={{ width:`${(cnt/topAuthors[0][1])*100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recent finished */}
              <div className="card">
                <p style={{ fontFamily:"'Space Mono',monospace", fontSize:10, color:"#7c6a9a",
                  textTransform:"uppercase", letterSpacing:"0.15em", marginBottom:"1.25rem" }}>
                  Finished this {wrappedPeriod}
                </p>
                <div style={{ display:"flex", gap:10, overflowX:"auto", paddingBottom:8 }}>
                  {periodBooks.map(b => (
                    <div key={b.id} style={{ flexShrink:0 }}>
                      <BookCover book={b} size="sm" onClick={() => { setSelectedShelfBook(b); setScreen("shelf"); }} />
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
