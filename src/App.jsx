import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Library, Archive, Target, Sparkles,
  Play, Pause, SkipBack, SkipForward, Rewind, FastForward,
  ArrowLeft, Search, ChevronDown, ChevronUp, X, Trash2,
  Zap, Download, RefreshCw, CheckCircle2,
  Lightbulb, Star, Rocket, PenLine,
  Mic2, BookOpen, Clock, TrendingUp, Trophy,
  Upload, RotateCcw, Tag, User, BarChart2,
} from "lucide-react";

const SUPABASE_URL = "https://qnkmneedjzdjnxmgavli.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFua21uZWVkanpkam54bWdhdmxpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA5NTA4MTUsImV4cCI6MjA5NjUyNjgxNX0.VQ32EH4ZPep3S3tyfViAOQaw3GIW_M_3icbHKm-SUEg";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const API_KEY = import.meta.env.VITE_GOOGLE_TTS_KEY || "";
const CHUNK_SIZE = 4000;
const GOAL = 12;

const CATEGORIES = ["Uncategorized","Fiction","Non-Fiction","Self-Help","Business","Biography","Science","History","Fantasy","Mystery","Thriller","Romance","Philosophy","Psychology","Spirituality","Health","Technology"];
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const QUOTES = [
  { text: "A reader lives a thousand lives before she dies.", author: "George R.R. Martin" },
  { text: "There is no friend as loyal as a book.", author: "Ernest Hemingway" },
  { text: "Books are a uniquely portable magic.", author: "Stephen King" },
  { text: "She is too fond of books, and it has turned her brain.", author: "Louisa May Alcott" },
  { text: "A book is a dream you hold in your hands.", author: "Neil Gaiman" },
  { text: "Not all those who wander are lost — some are between chapters.", author: "Unknown" },
  { text: "Reading is the quietest form of courage.", author: "Unknown" },
];

const VOICES = [
  { id:"en-US-Neural2-F", label:"Naomi",    desc:"Warm American female",    lang:"en-US", gender:"FEMALE" },
  { id:"en-US-Neural2-H", label:"Serena",   desc:"Clear American female",   lang:"en-US", gender:"FEMALE" },
  { id:"en-GB-Wavenet-C", label:"Victoria", desc:"Elegant British female",  lang:"en-GB", gender:"FEMALE" },
  { id:"en-US-Neural2-D", label:"Marcus",   desc:"Warm American male",      lang:"en-US", gender:"MALE"   },
  { id:"en-US-Neural2-I", label:"DeShawn",  desc:"Deep rich American male", lang:"en-US", gender:"MALE"   },
  { id:"en-US-Neural2-J", label:"Jordan",   desc:"Clear American male",     lang:"en-US", gender:"MALE"   },
  { id:"en-US-Wavenet-B", label:"Franklin", desc:"Authoritative male",      lang:"en-US", gender:"MALE"   },
  { id:"en-US-Wavenet-I", label:"Isaiah",   desc:"Rich deep male",          lang:"en-US", gender:"MALE"   },
  { id:"en-GB-Wavenet-B", label:"Edmund",   desc:"Deep British male",       lang:"en-GB", gender:"MALE"   },
  { id:"en-AU-Wavenet-B", label:"Bruce",    desc:"Deep Australian male",    lang:"en-AU", gender:"MALE"   },
];

const PALETTES = [
  ["#4c1d95","#7c3aed"],["#1e1b4b","#4338ca"],["#0c4a6e","#0ea5e9"],
  ["#064e3b","#10b981"],["#7f1d1d","#ef4444"],["#78350f","#f59e0b"],
  ["#831843","#ec4899"],["#1e3a5f","#3b82f6"],["#3b0764","#a855f7"],
  ["#14532d","#22c55e"],["#0f172a","#6366f1"],["#1c1917","#78716c"],
];

const CONFETTI = Array.from({length:55},(_,i) => ({
  left:(i*37+11)%100, delay:(i*0.12)%3,
  dur:2.5+(i*0.07)%2, size:5+(i*3)%8,
  color:["#c084fc","#7c3aed","#a78bfa","#e879f9","#f0abfc","#fbbf24","#34d399","#60a5fa"][i%8],
  rot:(i*47)%360, shape:i%3,
}));

const STARS_BG = Array.from({length:70},(_,i) => ({
  left:(i*73+11)%100, top:(i*47+23)%100,
  size: i%4===0 ? 1.5 : 0.8,
  op: 0.05+(i%6)*0.04,
  dur: 2+(i*0.23)%3,
  delay:(i*0.31)%5,
}));

const WAVEFORM_HEIGHTS = [20,38,15,52,28,44,12,35,58,22,40,50,14,42,26,32,55,18,38,12,48,25,42,15,32,52,20,38,48,14,42,26,34,52,20,36,14,46,24,42];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function bookGradient(title) {
  let h = 0;
  for (let i = 0; i < title.length; i++) h = title.charCodeAt(i)+((h<<5)-h);
  return PALETTES[Math.abs(h)%PALETTES.length];
}

function chunkText(text) {
  const paras = text.split(/\n+/).filter(p=>p.trim());
  const chunks=[]; let cur="";
  for (const p of paras) {
    if ((cur+" "+p).trim().length>CHUNK_SIZE) { if(cur.trim()) chunks.push(cur.trim()); cur=p; }
    else cur = cur ? cur+"\n\n"+p : p;
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks;
}

async function extractTextFromPDF(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=async e=>{
      try {
        const pdfjsLib=window.pdfjsLib;
        pdfjsLib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const pdf=await pdfjsLib.getDocument({data:new Uint8Array(e.target.result)}).promise;
        let text="";
        for(let i=1;i<=pdf.numPages;i++){
          const pg=await pdf.getPage(i);
          const ct=await pg.getTextContent();
          text+=ct.items.map(it=>it.str).join(" ")+"\n\n";
        }
        res(text.trim());
      } catch(err){rej(err);}
    };
    r.onerror=rej; r.readAsArrayBuffer(file);
  });
}

async function ttsGenerate(text, bookId, idx, voice, force=false) {
  if (!force) {
    const {data:c}=await supabase.from("audio_chunks").select("audio_path")
      .eq("book_id",bookId).eq("chunk_index",idx).eq("voice_id",voice.id).single();
    if (c?.audio_path) {
      const {data}=supabase.storage.from("audio").getPublicUrl(c.audio_path);
      return data.publicUrl;
    }
  }
  const r=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,{
    method:"POST", headers:{"Content-Type":"application/json"},
    body:JSON.stringify({input:{text},voice:{languageCode:voice.lang,name:voice.id,ssmlGender:voice.gender},
      audioConfig:{audioEncoding:"MP3",speakingRate:0.95,pitch:-1.0}}),
  });
  if(!r.ok){const e=await r.json();throw new Error(e.error?.message||"TTS error");}
  const j=await r.json();
  const blob=new Blob([Uint8Array.from(atob(j.audioContent),c=>c.charCodeAt(0))],{type:"audio/mp3"});
  const path=`${bookId}/${voice.id}/chunk_${idx}.mp3`;
  await supabase.storage.from("audio").upload(path,blob,{contentType:"audio/mp3",upsert:true});
  await supabase.from("audio_chunks").upsert({book_id:bookId,chunk_index:idx,audio_path:path,voice_id:voice.id},{onConflict:"book_id,chunk_index,voice_id"});
  const {data:u}=supabase.storage.from("audio").getPublicUrl(path);
  return u.publicUrl;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const Starfield = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    {STARS_BG.map((s,i)=>(
      <div key={i} style={{position:"absolute",left:`${s.left}%`,top:`${s.top}%`,
        width:s.size,height:s.size,borderRadius:"50%",background:"#c084fc",opacity:s.op,
        animation:`twinkle ${s.dur}s ease-in-out ${s.delay}s infinite alternate`}}/>
    ))}
  </div>
);

const BookCover = ({book,size="md",onClick}) => {
  const [c1,c2]=bookGradient(book.title);
  const dims={sm:{w:68,h:96},md:{w:96,h:136},lg:{w:130,h:184}}[size];
  return (
    <div onClick={onClick} style={{width:dims.w,height:dims.h,borderRadius:8,
      background:`linear-gradient(145deg,${c1},${c2})`,cursor:onClick?"pointer":"default",
      flexShrink:0,overflow:"hidden",position:"relative",
      boxShadow:"0 8px 32px rgba(0,0,0,0.6),inset 3px 0 rgba(255,255,255,0.07),-2px 0 rgba(0,0,0,0.4)",
      transition:"transform 0.25s cubic-bezier(.34,1.56,.64,1),box-shadow 0.25s ease",
      display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"8px 7px"}}
      onMouseEnter={e=>{if(onClick){e.currentTarget.style.transform="translateY(-6px) rotate(-1.5deg)";e.currentTarget.style.boxShadow="0 20px 48px rgba(0,0,0,0.7),inset 3px 0 rgba(255,255,255,0.1),-2px 0 rgba(0,0,0,0.5)";}}}
      onMouseLeave={e=>{e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 8px 32px rgba(0,0,0,0.6),inset 3px 0 rgba(255,255,255,0.07),-2px 0 rgba(0,0,0,0.4)";}}>
      <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,0.5))"}}/>
      <p style={{position:"relative",fontSize:size==="sm"?7.5:9.5,fontWeight:700,
        color:"rgba(255,255,255,0.95)",lineHeight:1.3,
        display:"-webkit-box",WebkitLineClamp:size==="sm"?3:4,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
        {book.title}
      </p>
      {size==="lg"&&book.author&&book.author!=="Unknown Author"&&(
        <p style={{position:"relative",fontSize:8,color:"rgba(255,255,255,0.5)",marginTop:3,
          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{book.author}</p>
      )}
    </div>
  );
};

const CircleRing = ({value,max,size=160,stroke=12}) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r;
  const offset=circ-Math.min(value/max,1)*circ;
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#c084fc"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(124,58,237,0.12)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#rg)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:"stroke-dashoffset 1.4s cubic-bezier(.34,1,.56,1)"}}/>
    </svg>
  );
};

const StarRow = ({value,onChange,readonly=false}) => (
  <div style={{display:"flex",gap:4}}>
    {[1,2,3,4,5].map(s=>(
      <button key={s} onClick={()=>!readonly&&onChange?.(s)}
        style={{background:"none",border:"none",cursor:readonly?"default":"pointer",padding:2,
          color:s<=value?"#c084fc":"rgba(124,58,237,0.2)",transition:"color 0.15s,filter 0.15s",
          filter:s<=value?"drop-shadow(0 0 5px rgba(192,132,252,0.6))":"none"}}>
        <Star size={18} fill={s<=value?"currentColor":"none"}/>
      </button>
    ))}
  </div>
);

const Waveform = ({playing,bars=36}) => (
  <div style={{display:"flex",alignItems:"center",gap:2.5,height:48,justifyContent:"center"}}>
    {WAVEFORM_HEIGHTS.slice(0,bars).map((h,i)=>(
      <div key={i} style={{width:2.5,height:`${h}%`,borderRadius:4,
        background:playing?"linear-gradient(180deg,#c084fc,#7c3aed)":"rgba(124,58,237,0.18)",
        animation:playing?`waveBar ${0.35+(i%7)*0.1}s ease-in-out ${(i%5)*0.07}s infinite alternate`:"none",
        transition:"background 0.4s"}}/>
    ))}
  </div>
);

const ConfettiBlast = () => (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:300}}>
    {CONFETTI.map((p,i)=>(
      <div key={i} style={{position:"absolute",left:`${p.left}%`,top:"-20px",
        width:p.shape===1?p.size*2:p.size,height:p.size,background:p.color,
        borderRadius:p.shape===0?"50%":"2px",transform:`rotate(${p.rot}deg)`,
        animation:`confettiFall ${p.dur}s ease ${p.delay}s forwards`}}/>
    ))}
  </div>
);

const BottomNav = ({screen,setScreen,finishedCount}) => {
  const tabs=[
    {id:"library",Icon:Library,label:"Library"},
    {id:"shelf",  Icon:Archive, label:"Shelf",   badge:finishedCount},
    {id:"goals",  Icon:Target,  label:"Goals"},
    {id:"wrapped",Icon:Sparkles,label:"Wrapped"},
  ];
  return (
    <nav style={{position:"fixed",bottom:0,left:0,right:0,zIndex:100,
      background:"rgba(6,4,18,0.92)",backdropFilter:"blur(28px) saturate(1.5)",
      borderTop:"0.5px solid rgba(124,58,237,0.15)",display:"flex"}}>
      {tabs.map(({id,Icon,label,badge})=>{
        const active=screen===id;
        return (
          <button key={id} onClick={()=>setScreen(id)}
            style={{flex:1,background:"none",border:"none",cursor:"pointer",
              padding:"14px 4px 12px",display:"flex",flexDirection:"column",
              alignItems:"center",gap:4,position:"relative",
              color:active?"#c084fc":"rgba(91,74,122,0.8)",
              transition:"color 0.2s"}}>
            {badge>0&&!active&&(
              <div style={{position:"absolute",top:10,right:"18%",width:7,height:7,
                borderRadius:"50%",background:"#7c3aed"}}/>
            )}
            <div style={{transition:"transform 0.2s cubic-bezier(.34,1.56,.64,1)",
              transform:active?"scale(1.15)":"scale(1)"}}>
              <Icon size={20} strokeWidth={active?2:1.5}/>
            </div>
            <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,
              fontWeight:active?700:400,letterSpacing:"0.03em"}}>{label}</span>
            {active&&(
              <div style={{width:20,height:2,borderRadius:2,
                background:"linear-gradient(90deg,#7c3aed,#c084fc)",
                animation:"scaleIn 0.2s ease"}}/>
            )}
          </button>
        );
      })}
    </nav>
  );
};

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen,setScreen]=useState("library");
  const [fromScreen,setFromScreen]=useState("library");
  const [books,setBooks]=useState([]);
  const [loadingBooks,setLoadingBooks]=useState(true);
  const [activeBook,setActiveBook]=useState(null);
  const [uploadPending,setUploadPending]=useState(null);
  const [uploadForm,setUploadForm]=useState({title:"",author:"",category:"Uncategorized"});
  const [uploading,setUploading]=useState(false);
  const [dragOver,setDragOver]=useState(false);
  const [chunks,setChunks]=useState([]);
  const [cachedChunks,setCachedChunks]=useState({});
  const [currentChunk,setCurrentChunk]=useState(0);
  const [audioUrls,setAudioUrls]=useState({});
  const [isPlaying,setIsPlaying]=useState(false);
  const [isLoading,setIsLoading]=useState(false);
  const [loadingMsg,setLoadingMsg]=useState("");
  const [error,setError]=useState("");
  const [progress,setProgress]=useState(0);
  const [speed,setSpeed]=useState(1);
  const [currentTime,setCurrentTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const [pregenProgress,setPregenProgress]=useState(null);
  const [voice,setVoice]=useState(VOICES.find(v=>v.id==="en-US-Neural2-F"));
  const [showVoiceDrop,setShowVoiceDrop]=useState(false);
  const [showRegenConfirm,setShowRegenConfirm]=useState(false);
  const [showBookComplete,setShowBookComplete]=useState(false);
  const [journals,setJournals]=useState({});
  const [journalBook,setJournalBook]=useState(null);
  const [journalForm,setJournalForm]=useState({learned:"",takeaways:"",actions:"",rating:0});
  const [savingJournal,setSavingJournal]=useState(false);
  const [shelfSort,setShelfSort]=useState("date");
  const [selectedShelfBook,setSelectedShelfBook]=useState(null);
  const [searchQ,setSearchQ]=useState("");
  const [filterCat,setFilterCat]=useState("All");
  const [wrappedPeriod,setWrappedPeriod]=useState("year");
  const [quoteIdx]=useState(()=>Math.floor((Date.now()/86400000)%QUOTES.length));

  const audioRef=useRef(null);
  const preloadRef=useRef(null);
  const fileInputRef=useRef(null);
  const progressSaveRef=useRef(null);
  const voiceDropRef=useRef(null);
  const chunksRef=useRef(chunks);
  const urlsRef=useRef(audioUrls);
  const chunkRef=useRef(currentChunk);
  const bookRef=useRef(activeBook);
  const voiceRef=useRef(voice);
  const speedRef=useRef(speed);

  useEffect(()=>{chunksRef.current=chunks;},[chunks]);
  useEffect(()=>{urlsRef.current=audioUrls;},[audioUrls]);
  useEffect(()=>{chunkRef.current=currentChunk;},[currentChunk]);
  useEffect(()=>{bookRef.current=activeBook;},[activeBook]);
  useEffect(()=>{voiceRef.current=voice;},[voice]);
  useEffect(()=>{speedRef.current=speed;},[speed]);

  useEffect(()=>{fetchBooks();fetchJournals();},[]);

  useEffect(()=>{
    const h=e=>{if(voiceDropRef.current&&!voiceDropRef.current.contains(e.target))setShowVoiceDrop(false);};
    document.addEventListener("mousedown",h);
    return()=>document.removeEventListener("mousedown",h);
  },[]);

  useEffect(()=>{
    setAudioUrls({});
    if(activeBook) refreshCached(activeBook.id,voice.id);
  },[voice]);

  // ── Data
  const fetchBooks=async()=>{
    setLoadingBooks(true);
    const {data}=await supabase.from("books").select("*,reading_progress(*)")
      .order("created_at",{ascending:false});
    setBooks(data||[]);
    setLoadingBooks(false);
  };
  const fetchJournals=async()=>{
    const {data}=await supabase.from("book_journals").select("*");
    const m={};(data||[]).forEach(j=>{m[j.book_id]=j;});
    setJournals(m);
  };
  const refreshCached=async(bookId,voiceId)=>{
    const {data}=await supabase.from("audio_chunks").select("chunk_index")
      .eq("book_id",bookId).eq("voice_id",voiceId);
    const c={};(data||[]).forEach(r=>{c[r.chunk_index]=true;});
    setCachedChunks(c);
  };

  // ── Upload
  const handleFilePicked=async file=>{
    if(!file||file.type!=="application/pdf"){setError("Please upload a PDF file.");return;}
    setError("");setIsLoading(true);setLoadingMsg("Reading PDF…");
    try {
      const text=await extractTextFromPDF(file);
      if(!text) throw new Error("No readable text found.");
      setUploadPending({file,text,chunks:chunkText(text)});
      setUploadForm({title:file.name.replace(/\.pdf$/i,""),author:"",category:"Uncategorized"});
    } catch(e){setError(e.message);}
    setIsLoading(false);setLoadingMsg("");
  };
  const confirmUpload=async()=>{
    if(!uploadPending) return;
    setUploading(true);setLoadingMsg("Adding to your collection…");
    try {
      const {file,text,chunks:c}=uploadPending;
      const fp=`${Date.now()}_${file.name}`;
      const {error:ue}=await supabase.storage.from("books").upload(fp,file);
      if(ue) throw ue;
      const {data:bd,error:be}=await supabase.from("books").insert({
        title:uploadForm.title||file.name.replace(/\.pdf$/i,""),
        author:uploadForm.author||"Unknown Author",
        category:uploadForm.category,
        file_path:fp,
        word_count:text.split(/\s+/).filter(Boolean).length,
        chunk_count:c.length,
        status:"reading",
      }).select().single();
      if(be) throw be;
      await supabase.from("reading_progress").insert({book_id:bd.id,current_chunk:0,current_position:0});
      await fetchBooks();
      setUploadPending(null);setUploading(false);setLoadingMsg("");
      openBook({...bd,reading_progress:[{current_chunk:0,current_position:0}]},c);
    } catch(e){setError(e.message);setUploading(false);setLoadingMsg("");}
  };

  // ── Book
  const openBook=async(book,preloaded=null)=>{
    setError("");setAudioUrls({});setIsPlaying(false);setActiveBook(book);
    setPregenProgress(null);setShowRegenConfirm(false);setShowBookComplete(false);
    setFromScreen(screen);
    let c=preloaded;
    if(!c){
      setIsLoading(true);setLoadingMsg("Loading book…");
      try {
        const {data}=await supabase.storage.from("books").download(book.file_path);
        const f=new File([data],book.title+".pdf",{type:"application/pdf"});
        c=chunkText(await extractTextFromPDF(f));
      } catch(e){setError(e.message);setIsLoading(false);return;}
      setIsLoading(false);setLoadingMsg("");
    }
    setChunks(c);
    await refreshCached(book.id,voice.id);
    const prog=book.reading_progress?.[0];
    const sc=prog?.current_chunk||0;
    setCurrentChunk(sc);setProgress((sc/c.length)*100);
    setScreen("player");
    if(prog?.id) await supabase.from("reading_progress").update({last_opened:new Date().toISOString()}).eq("id",prog.id);
  };
  const repeatBook=async book=>{
    const prog=book.reading_progress?.[0];
    if(prog?.id) await supabase.from("reading_progress").update({current_chunk:0,current_position:0}).eq("id",prog.id);
    await supabase.from("books").update({status:"reading",finished_at:null}).eq("id",book.id);
    await fetchBooks();
    openBook({...book,status:"reading",finished_at:null,reading_progress:[{...prog,current_chunk:0,current_position:0}]});
  };
  const saveProgress=useCallback(async(chunk,pos)=>{
    const book=bookRef.current;
    const prog=book?.reading_progress?.[0];
    if(prog?.id) await supabase.from("reading_progress")
      .update({current_chunk:chunk,current_position:pos,last_opened:new Date().toISOString()})
      .eq("id",prog.id);
  },[]);
  const deleteBook=async(e,bookId,fp)=>{
    e.stopPropagation();
    if(!confirm("Remove this book?")) return;
    const {data:cd}=await supabase.from("audio_chunks").select("audio_path").eq("book_id",bookId);
    if(cd?.length) await supabase.storage.from("audio").remove(cd.map(c=>c.audio_path));
    await supabase.storage.from("books").remove([fp]);
    await supabase.from("books").delete().eq("id",bookId);
    fetchBooks();
  };

  // ── Audio — seamless 3-chunk lookahead
  const preloadChunk=useCallback(async idx=>{
    const c=chunksRef.current,urls=urlsRef.current,book=bookRef.current,v=voiceRef.current;
    if(!API_KEY||!c[idx]||urls[idx]||!book) return;
    try {
      const url=await ttsGenerate(c[idx],book.id,idx,v);
      setAudioUrls(prev=>({...prev,[idx]:url}));
      setCachedChunks(prev=>({...prev,[idx]:true}));
      const h=new Audio();h.preload="auto";h.src=url;h.load();
    } catch(e){}
  },[]);

  const playChunk=useCallback(async(idx,force=false)=>{
    const c=chunksRef.current,book=bookRef.current,v=voiceRef.current;
    if(!c[idx]) return;
    setCurrentChunk(idx);setError("");
    let url=!force&&urlsRef.current[idx]?urlsRef.current[idx]:null;
    if(!url){
      setIsLoading(true);
      setLoadingMsg(cachedChunks[idx]&&!force?`Loading part ${idx+1}…`:`Generating part ${idx+1} of ${c.length}…`);
      try {
        url=await ttsGenerate(c[idx],book.id,idx,v,force);
        setAudioUrls(prev=>({...prev,[idx]:url}));
        setCachedChunks(prev=>({...prev,[idx]:true}));
      } catch(e){setError(e.message);setIsLoading(false);setIsPlaying(false);return;}
      setIsLoading(false);setLoadingMsg("");
    }
    if(audioRef.current){
      audioRef.current.src=url;
      audioRef.current.playbackRate=speedRef.current;
      audioRef.current.play();
      setIsPlaying(true);
    }
    [1,2,3].forEach(off=>{
      const n=idx+off;
      if(c[n]&&!urlsRef.current[n]) setTimeout(()=>preloadChunk(n),off*700);
    });
  },[cachedChunks,preloadChunk]);

  const handlePlay=async()=>{
    if(!API_KEY){setError("VITE_GOOGLE_TTS_KEY not set.");return;}
    if(!chunks.length) return;
    if(isPlaying){
      audioRef.current?.pause();setIsPlaying(false);
      saveProgress(currentChunk,audioRef.current?.currentTime||0);
    } else {
      if(audioRef.current?.src&&audioRef.current.paused){
        audioRef.current.playbackRate=speed;audioRef.current.play();setIsPlaying(true);
      } else playChunk(currentChunk);
    }
  };

  const handleEnded=useCallback(async()=>{
    const idx=chunkRef.current,c=chunksRef.current,book=bookRef.current;
    if(idx<c.length-1){
      playChunk(idx+1);
    } else {
      setIsPlaying(false);setProgress(100);saveProgress(0,0);
      if(book){
        await supabase.from("books").update({status:"finished",finished_at:new Date().toISOString()}).eq("id",book.id);
        setActiveBook(p=>({...p,status:"finished",finished_at:new Date().toISOString()}));
        await fetchBooks();setShowBookComplete(true);
      }
    }
  },[playChunk,saveProgress]);

  const handleTimeUpdate=()=>{
    if(!audioRef.current) return;
    const pos=audioRef.current.currentTime,dur=audioRef.current.duration||0;
    setCurrentTime(pos);setDuration(dur);
    const cp=dur?pos/dur:0;
    setProgress(((chunkRef.current+cp)/(chunksRef.current.length||1))*100);
    clearTimeout(progressSaveRef.current);
    progressSaveRef.current=setTimeout(()=>saveProgress(chunkRef.current,pos),10000);
  };

  const handleSkip=s=>{
    if(!audioRef.current) return;
    audioRef.current.currentTime=Math.max(0,Math.min(audioRef.current.duration||0,audioRef.current.currentTime+s));
  };

  const handlePregenerate=async(force=false)=>{
    if(!API_KEY||!chunks.length||!activeBook) return;
    setShowRegenConfirm(false);setPregenProgress({done:0,total:chunks.length});
    for(let i=0;i<chunks.length;i++){
      if(force||!cachedChunks[i]){
        try {
          const url=await ttsGenerate(chunks[i],activeBook.id,i,voice,force);
          setAudioUrls(prev=>({...prev,[i]:url}));
          setCachedChunks(prev=>({...prev,[i]:true}));
          const h=new Audio();h.preload="auto";h.src=url;h.load();
        } catch(e){setError(`Failed on part ${i+1}: ${e.message}`);setPregenProgress(null);return;}
      }
      setPregenProgress({done:i+1,total:chunks.length});
    }
    setPregenProgress(null);
  };

  const handleDownload=async()=>{
    if(!activeBook) return;
    setLoadingMsg("Preparing download…");setIsLoading(true);
    try {
      const {data:cd}=await supabase.from("audio_chunks").select("chunk_index,audio_path")
        .eq("book_id",activeBook.id).eq("voice_id",voice.id).order("chunk_index");
      if(!cd?.length){setError("Generate audio first.");setIsLoading(false);setLoadingMsg("");return;}
      const blobs=[];
      for(const ch of cd){const {data}=await supabase.storage.from("audio").download(ch.audio_path);blobs.push(data);}
      const url=URL.createObjectURL(new Blob(blobs,{type:"audio/mp3"}));
      const a=document.createElement("a");a.href=url;a.download=`${activeBook.title} — ${voice.label}.mp3`;a.click();
      URL.revokeObjectURL(url);
    } catch(e){setError(e.message);}
    setIsLoading(false);setLoadingMsg("");
  };

  // ── Journal
  const openJournal=book=>{
    setJournalBook(book);
    const j=journals[book.id];
    setJournalForm({learned:j?.learned||"",takeaways:j?.takeaways||"",actions:j?.actions||"",rating:j?.rating||0});
    setFromScreen(screen);setScreen("journal");
  };
  const saveJournal=async()=>{
    if(!journalBook) return;
    setSavingJournal(true);
    const payload={book_id:journalBook.id,...journalForm,updated_at:new Date().toISOString()};
    const ex=journals[journalBook.id];
    if(ex?.id) await supabase.from("book_journals").update(payload).eq("id",ex.id);
    else await supabase.from("book_journals").insert(payload);
    await fetchJournals();setSavingJournal(false);
  };

  // ── Helpers
  const fmt=s=>{if(!s||isNaN(s))return"0:00";return`${Math.floor(s/60)}:${String(Math.floor(s%60)).padStart(2,"0")}`;};

  // ── Derived
  const finished=books.filter(b=>b.status==="finished");
  const finishedCount=finished.length;
  const thisYear=new Date().getFullYear();
  const booksThisYear=finished.filter(b=>b.finished_at&&new Date(b.finished_at).getFullYear()===thisYear);
  const totalHours=Math.round(finished.reduce((s,b)=>s+(b.word_count||0),0)/150/60*10)/10;

  const filteredBooks=books.filter(b=>{
    const q=searchQ.toLowerCase();
    return(!q||b.title.toLowerCase().includes(q)||(b.author||"").toLowerCase().includes(q))&&
      (filterCat==="All"||b.category===filterCat);
  });

  const presentCats=["All",...new Set(books.map(b=>b.category).filter(Boolean))];

  const sortedShelf=[...finished].sort((a,b)=>{
    if(shelfSort==="date") return new Date(b.finished_at||0)-new Date(a.finished_at||0);
    if(shelfSort==="rating") return (journals[b.id]?.rating||0)-(journals[a.id]?.rating||0);
    if(shelfSort==="author") return (a.author||"").localeCompare(b.author||"");
    return (a.category||"").localeCompare(b.category||"");
  });

  const cachedCount=Object.keys(cachedChunks).length;
  const allCached=chunks.length>0&&cachedCount>=chunks.length;

  const now2=new Date();
  const pStart={
    week:new Date(now2.getTime()-7*864e5),
    month:new Date(now2.getFullYear(),now2.getMonth(),1),
    quarter:new Date(now2.getFullYear(),Math.floor(now2.getMonth()/3)*3,1),
    year:new Date(now2.getFullYear(),0,1),
  }[wrappedPeriod];
  const periodBooks=finished.filter(b=>b.finished_at&&new Date(b.finished_at)>=pStart);
  const periodHours=Math.round(periodBooks.reduce((s,b)=>s+(b.word_count||0),0)/150/60*10)/10;
  const catCount={};periodBooks.forEach(b=>{if(b.category)catCount[b.category]=(catCount[b.category]||0)+1;});
  const topCats=Object.entries(catCount).sort((a,b)=>b[1]-a[1]);
  const authCount={};periodBooks.forEach(b=>{if(b.author&&b.author!=="Unknown Author")authCount[b.author]=(authCount[b.author]||0)+1;});
  const topAuthors=Object.entries(authCount).sort((a,b)=>b[1]-a[1]);
  const monthBreak=Array.from({length:12},(_,m)=>({
    label:MONTH_LABELS[m],
    count:booksThisYear.filter(b=>new Date(b.finished_at).getMonth()===m).length,
  }));
  const maxMo=Math.max(1,...monthBreak.map(m=>m.count));
  const quote=QUOTES[quoteIdx];
  const showNav=!["player","journal"].includes(screen);

  // ─── CSS ─────────────────────────────────────────────────────────────────

  const css=`
    @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,300;0,400;0,600;1,300;1,400&family=Space+Mono:wght@400;700&display=swap');
    *{box-sizing:border-box;margin:0;padding:0;}
    html{scroll-behavior:smooth;}
    body{background:#060412;overflow-x:hidden;}

    @keyframes wave{from{transform:scaleY(0.35);transform-origin:center}to{transform:scaleY(1.45);transform-origin:center}}
    @keyframes waveBar{from{height:20%}to{height:100%}}
    @keyframes spin{to{transform:rotate(360deg)}}
    @keyframes pulse{0%,100%{opacity:1}50%{opacity:0.35}}
    @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}
    @keyframes fadeIn{from{opacity:0}to{opacity:1}}
    @keyframes dropIn{from{opacity:0;transform:translateY(-10px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}
    @keyframes shimmer{0%,100%{opacity:0.65}50%{opacity:1}}
    @keyframes floatOrb{0%,100%{transform:translateY(0) scale(1)}50%{transform:translateY(-22px) scale(1.04)}}
    @keyframes confettiFall{to{transform:translateY(105vh) rotate(720deg);opacity:0}}
    @keyframes glowPulse{0%,100%{box-shadow:0 0 28px rgba(124,58,237,0.45),0 0 0 0 rgba(124,58,237,0.2)}50%{box-shadow:0 0 48px rgba(192,132,252,0.7),0 0 0 8px rgba(124,58,237,0)}}
    @keyframes scaleIn{from{transform:scale(0)}to{transform:scale(1)}}
    @keyframes twinkle{from{opacity:0.04}to{opacity:0.45}}
    @keyframes slideUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
    @keyframes popIn{from{opacity:0;transform:scale(0.8) translateY(20px)}to{opacity:1;transform:scale(1) translateY(0)}}
    @keyframes borderFlow{0%,100%{border-color:rgba(124,58,237,0.2)}50%{border-color:rgba(192,132,252,0.45)}}

    .fade-up{animation:fadeUp 0.4s ease both;}
    .pop-in{animation:popIn 0.4s cubic-bezier(0.34,1.56,0.64,1) both;}

    .card{
      background:rgba(20,14,36,0.8);
      border:0.5px solid rgba(124,58,237,0.14);
      border-radius:18px;
      backdrop-filter:blur(16px);
      padding:1.5rem;
    }
    .card-hover{transition:border-color 0.25s,box-shadow 0.25s,background 0.25s,transform 0.2s;}
    .card-hover:hover{
      border-color:rgba(124,58,237,0.38);
      box-shadow:0 0 28px rgba(124,58,237,0.12);
      background:rgba(24,17,42,0.9);
    }

    .btn-primary{
      background:linear-gradient(135deg,#7c3aed,#9333ea);
      border:none;border-radius:50%;color:#f5f0ff;cursor:pointer;
      display:flex;align-items:center;justify-content:center;
      transition:transform 0.15s cubic-bezier(.34,1.56,.64,1),filter 0.2s,box-shadow 0.2s;
      animation:glowPulse 3s ease infinite;
      position:relative;overflow:hidden;
    }
    .btn-primary:hover{transform:scale(1.08);filter:brightness(1.12);}
    .btn-primary:active{transform:scale(0.94);}
    .btn-primary:disabled{background:rgba(45,31,74,0.6);color:#3d2f5c;cursor:not-allowed;animation:none;box-shadow:none;}

    .btn-glass{
      background:rgba(124,58,237,0.08);
      border:0.5px solid rgba(124,58,237,0.18);
      border-radius:10px;color:rgba(167,139,202,0.9);cursor:pointer;
      font-family:'Space Mono',monospace;font-size:11px;
      padding:8px 14px;
      transition:all 0.18s cubic-bezier(.34,1.56,.64,1);
      display:flex;align-items:center;justify-content:center;gap:6px;
      backdrop-filter:blur(8px);
    }
    .btn-glass:hover{background:rgba(124,58,237,0.18);border-color:rgba(192,132,252,0.4);color:#c084fc;transform:translateY(-1px);}
    .btn-glass:active{transform:translateY(0);}
    .btn-glass:disabled{opacity:0.3;cursor:not-allowed;transform:none;}

    .btn-ghost{
      background:transparent;border:0.5px solid rgba(45,31,74,0.8);
      border-radius:10px;color:rgba(91,74,122,0.9);cursor:pointer;
      font-family:'Space Mono',monospace;font-size:11px;padding:8px 16px;
      transition:all 0.18s ease;display:flex;align-items:center;justify-content:center;gap:6px;
    }
    .btn-ghost:hover{border-color:rgba(192,132,252,0.5);color:#c084fc;}
    .btn-ghost:disabled{opacity:0.3;cursor:not-allowed;}

    .btn-danger{
      background:transparent;border:0.5px solid rgba(127,29,29,0.6);
      border-radius:10px;color:rgba(248,113,113,0.8);cursor:pointer;
      font-family:'Space Mono',monospace;font-size:11px;padding:8px 16px;
      transition:all 0.18s ease;display:flex;align-items:center;justify-content:center;gap:6px;
    }
    .btn-danger:hover{border-color:#f87171;background:rgba(200,60,60,0.08);color:#f87171;}
    .btn-danger:disabled{opacity:0.3;cursor:not-allowed;}

    .speed-btn{
      background:transparent;border:0.5px solid rgba(45,31,74,0.7);
      border-radius:8px;color:rgba(74,58,104,0.9);cursor:pointer;
      font-family:'Space Mono',monospace;font-size:10px;padding:5px 9px;
      transition:all 0.15s ease;
    }
    .speed-btn:hover{border-color:rgba(192,132,252,0.4);color:#c084fc;}
    .speed-btn.active{border-color:#c084fc;color:#c084fc;background:rgba(192,132,252,0.1);font-weight:700;}

    .book-card{
      background:rgba(17,13,26,0.7);
      border:0.5px solid rgba(45,31,74,0.7);
      border-radius:16px;padding:1.2rem;
      cursor:pointer;
      transition:border-color 0.2s,background 0.2s,box-shadow 0.2s,transform 0.18s;
      position:relative;backdrop-filter:blur(12px);
    }
    .book-card:hover{
      border-color:rgba(124,58,237,0.45);
      background:rgba(22,15,38,0.85);
      box-shadow:0 4px 32px rgba(124,58,237,0.14);
      transform:translateY(-2px);
    }

    .drop-zone{
      border:1px dashed rgba(45,31,74,0.8);border-radius:16px;
      padding:2rem 1.5rem;text-align:center;cursor:pointer;
      transition:all 0.25s ease;background:rgba(17,13,26,0.4);
    }
    .drop-zone:hover,.drop-zone.over{
      border-color:rgba(192,132,252,0.5);
      background:rgba(124,58,237,0.06);
      box-shadow:inset 0 0 30px rgba(124,58,237,0.05);
    }

    .prog-track{height:3px;background:rgba(30,21,48,0.9);border-radius:2px;overflow:hidden;}
    .prog-track.thick{height:5px;border-radius:3px;}
    .prog-fill{height:100%;background:linear-gradient(90deg,#7c3aed,#c084fc);border-radius:2px;transition:width 0.3s linear;}
    .prog-fill.green{background:linear-gradient(90deg,#10b981,#34d399);}

    .orb{position:fixed;border-radius:50%;filter:blur(90px);pointer-events:none;z-index:0;}

    .delete-btn{
      position:absolute;top:10px;right:10px;background:transparent;border:none;
      color:rgba(45,31,74,0.8);cursor:pointer;padding:5px;border-radius:6px;
      opacity:0;transition:opacity 0.2s,color 0.2s;
    }
    .book-card:hover .delete-btn{opacity:1;}
    .delete-btn:hover{color:#f87171;}

    .voice-dropdown{
      position:absolute;top:calc(100% + 8px);left:0;right:0;
      background:rgba(18,12,30,0.97);border:0.5px solid rgba(58,37,96,0.8);
      border-radius:14px;z-index:50;overflow:hidden;
      animation:dropIn 0.18s cubic-bezier(.34,1.56,.64,1) forwards;
      max-height:280px;overflow-y:auto;backdrop-filter:blur(24px);
      box-shadow:0 16px 48px rgba(0,0,0,0.5);
    }
    .voice-opt{padding:10px 14px;cursor:pointer;transition:background 0.15s;border-bottom:0.5px solid rgba(30,21,48,0.8);}
    .voice-opt:last-child{border-bottom:none;}
    .voice-opt:hover{background:rgba(124,58,237,0.1);}
    .voice-opt.on{background:rgba(192,132,252,0.1);}
    .voice-dropdown::-webkit-scrollbar{width:3px;}
    .voice-dropdown::-webkit-scrollbar-thumb{background:rgba(58,37,96,0.8);border-radius:2px;}

    .chip{
      background:rgba(124,58,237,0.08);border:0.5px solid rgba(45,31,74,0.8);
      border-radius:20px;padding:6px 14px;font-family:'Space Mono',monospace;
      font-size:10px;color:rgba(91,74,122,0.9);cursor:pointer;
      transition:all 0.18s cubic-bezier(.34,1.56,.64,1);white-space:nowrap;
      display:inline-flex;align-items:center;gap:6px;
    }
    .chip:hover{border-color:rgba(192,132,252,0.4);color:#c084fc;transform:translateY(-1px);}
    .chip.on{background:rgba(192,132,252,0.14);border-color:rgba(192,132,252,0.45);color:#c084fc;font-weight:700;}

    .search-wrap input{
      background:rgba(17,13,26,0.8);border:0.5px solid rgba(45,31,74,0.8);
      border-radius:12px;padding:11px 14px 11px 42px;color:#f5f0ff;
      font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;
      transition:border-color 0.2s,box-shadow 0.2s;backdrop-filter:blur(8px);
    }
    .search-wrap input:focus{border-color:rgba(124,58,237,0.6);box-shadow:0 0 0 3px rgba(124,58,237,0.08);}
    .search-wrap input::placeholder{color:rgba(74,58,104,0.8);}

    .journal-ta{
      background:rgba(17,13,26,0.8);border:0.5px solid rgba(45,31,74,0.8);
      border-radius:12px;padding:14px;color:#f5f0ff;
      font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;
      resize:vertical;min-height:100px;transition:border-color 0.2s,box-shadow 0.2s;
      line-height:1.7;backdrop-filter:blur(8px);
    }
    .journal-ta:focus{border-color:rgba(124,58,237,0.6);box-shadow:0 0 0 3px rgba(124,58,237,0.08);}
    .journal-ta::placeholder{color:rgba(74,58,104,0.8);}

    .select-inp{
      background:rgba(17,13,26,0.8);border:0.5px solid rgba(45,31,74,0.8);
      border-radius:12px;padding:11px 14px;color:#f5f0ff;
      font-family:'Space Mono',monospace;font-size:11px;width:100%;outline:none;cursor:pointer;
    }
    .text-inp{
      background:rgba(17,13,26,0.8);border:0.5px solid rgba(45,31,74,0.8);
      border-radius:12px;padding:11px 14px;color:#f5f0ff;
      font-family:'Crimson Pro',serif;font-size:15px;width:100%;outline:none;
      transition:border-color 0.2s;
    }
    .text-inp:focus{border-color:rgba(124,58,237,0.6);}
    .text-inp::placeholder{color:rgba(74,58,104,0.8);}

    .wrapped-card{border-radius:22px;padding:2rem;position:relative;overflow:hidden;margin-bottom:12px;}
    .wrapped-card::after{
      content:'';position:absolute;inset:0;
      background:linear-gradient(135deg,rgba(255,255,255,0.04) 0%,transparent 60%);
      pointer-events:none;
    }

    .modal-overlay{
      position:fixed;inset:0;background:rgba(6,4,18,0.88);
      backdrop-filter:blur(12px) saturate(1.5);z-index:200;
      display:flex;align-items:flex-end;justify-content:center;
    }
    .modal-box{
      background:rgba(14,10,26,0.98);border:0.5px solid rgba(58,37,96,0.8);
      border-radius:24px 24px 0 0;padding:2rem;width:100%;max-width:600px;
      animation:slideUp 0.32s cubic-bezier(.34,1.12,.64,1);backdrop-filter:blur(24px);
    }

    .label-sm{font-family:'Space Mono',monospace;font-size:10px;color:rgba(124,100,154,0.9);
      text-transform:uppercase;letter-spacing:0.14em;display:block;margin-bottom:8px;}

    ::-webkit-scrollbar{width:3px;}
    ::-webkit-scrollbar-track{background:transparent;}
    ::-webkit-scrollbar-thumb{background:rgba(45,31,74,0.8);border-radius:2px;}
  `;

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div style={{minHeight:"100vh",background:"#060412",fontFamily:"'Crimson Pro',Georgia,serif",
      position:"relative",overflow:"hidden",paddingBottom:showNav?84:0}}>
      <style>{css}</style>

      {/* Starfield */}
      <Starfield/>

      {/* Orbs */}
      <div className="orb" style={{width:640,height:640,background:"rgba(124,58,237,0.055)",top:-200,right:-200,animation:"floatOrb 10s ease-in-out infinite"}}/>
      <div className="orb" style={{width:420,height:420,background:"rgba(76,29,149,0.07)",bottom:-150,left:-150,animation:"floatOrb 13s ease-in-out 4s infinite"}}/>
      <div className="orb" style={{width:280,height:280,background:"rgba(192,132,252,0.03)",top:"40%",left:"20%",animation:"floatOrb 17s ease-in-out 8s infinite"}}/>

      {/* Audio */}
      <audio ref={audioRef} onEnded={handleEnded} onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={()=>setDuration(audioRef.current?.duration||0)}/>
      <audio ref={preloadRef} preload="auto" style={{display:"none"}}/>

      {showNav&&<BottomNav screen={screen} setScreen={setScreen} finishedCount={finishedCount}/>}

      {/* ── Upload Modal ────────────────────────────────────────────────────── */}
      {uploadPending&&(
        <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)setUploadPending(null);}}>
          <div className="modal-box">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1.5rem"}}>
              <div>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc",
                  letterSpacing:"0.2em",textTransform:"uppercase",marginBottom:6}}>New book</p>
                <h3 style={{fontSize:"1.4rem",fontWeight:300,color:"#f5f0ff"}}>Tell us about it</h3>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <BookCover book={{title:uploadForm.title||"Preview",author:uploadForm.author}} size="sm"/>
                <button onClick={()=>setUploadPending(null)} className="btn-ghost" style={{padding:8}}>
                  <X size={16}/>
                </button>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:"1.5rem"}}>
              <div>
                <label className="label-sm">Title</label>
                <input className="text-inp" value={uploadForm.title}
                  onChange={e=>setUploadForm(p=>({...p,title:e.target.value}))} placeholder="Book title…"/>
              </div>
              <div>
                <label className="label-sm">Author</label>
                <input className="text-inp" value={uploadForm.author}
                  onChange={e=>setUploadForm(p=>({...p,author:e.target.value}))} placeholder="Author name…"/>
              </div>
              <div>
                <label className="label-sm">Category</label>
                <select className="select-inp" value={uploadForm.category}
                  onChange={e=>setUploadForm(p=>({...p,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn-ghost" onClick={()=>setUploadPending(null)} style={{flex:1}}>Cancel</button>
              <button onClick={confirmUpload} disabled={uploading}
                style={{flex:2,background:"linear-gradient(135deg,#7c3aed,#9333ea)",border:"none",
                  borderRadius:12,color:"#f5f0ff",cursor:"pointer",padding:"13px",
                  fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8,
                  opacity:uploading?0.6:1,transition:"opacity 0.2s,transform 0.15s"}}>
                {uploading
                  ?<><div style={{width:13,height:13,border:"2px solid #f5f0ff",borderTopColor:"transparent",
                      borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Adding…</>
                  :<><BookOpen size={14}/> Add to collection</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Book Complete ───────────────────────────────────────────────────── */}
      {showBookComplete&&(
        <>
          <ConfettiBlast/>
          <div style={{position:"fixed",inset:0,background:"rgba(6,4,18,0.96)",backdropFilter:"blur(16px)",
            zIndex:250,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:"2rem",textAlign:"center"}}>
            <div style={{animation:"popIn 0.55s cubic-bezier(0.34,1.56,0.64,1) 0.2s both"}}>
              <div style={{width:96,height:96,borderRadius:"50%",margin:"0 auto 24px",
                background:"linear-gradient(135deg,#7c3aed,#c084fc)",
                display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 60px rgba(192,132,252,0.5)"}}>
                <BookOpen size={44} color="#f5f0ff"/>
              </div>
            </div>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc",
              letterSpacing:"0.3em",textTransform:"uppercase",marginBottom:14,
              animation:"fadeUp 0.4s ease 0.5s both"}}>Book complete</p>
            <h2 style={{fontSize:"clamp(1.8rem,5vw,2.6rem)",fontWeight:300,color:"#f5f0ff",
              lineHeight:1.2,marginBottom:10,animation:"fadeUp 0.4s ease 0.6s both"}}>
              You did it, Victory!
            </h2>
            <p style={{fontFamily:"'Crimson Pro',serif",fontStyle:"italic",fontSize:"1.15rem",
              color:"#9b7cc8",marginBottom:8,animation:"fadeUp 0.4s ease 0.7s both"}}>
              "{activeBook?.title}"
            </p>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)",
              marginBottom:"2.5rem",animation:"fadeUp 0.4s ease 0.8s both"}}>
              {(activeBook?.word_count||0).toLocaleString()} words · ~{Math.round((activeBook?.word_count||0)/150/60*10)/10} hrs
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300,
              animation:"fadeUp 0.4s ease 0.9s both"}}>
              <button onClick={()=>{setShowBookComplete(false);openJournal(activeBook);}}
                style={{background:"linear-gradient(135deg,#7c3aed,#9333ea)",border:"none",
                  borderRadius:14,color:"#f5f0ff",cursor:"pointer",padding:"15px",
                  fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,
                  display:"flex",alignItems:"center",justifyContent:"center",gap:8}}>
                <PenLine size={15}/> Write about it
              </button>
              <button className="btn-glass"
                onClick={()=>{setShowBookComplete(false);setScreen(fromScreen);fetchBooks();}}>
                Back to {fromScreen==="shelf"?"Shelf":"Library"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ════════════════════════════════════════════════════════ LIBRARY */}
      {screen==="library"&&(
        <div style={{maxWidth:600,margin:"0 auto",padding:"2.5rem 1rem 1rem",position:"relative",zIndex:1}}>
          {/* Header */}
          <div style={{marginBottom:"2rem",textAlign:"center"}}>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.32em",
              color:"rgba(124,58,237,0.9)",textTransform:"uppercase",marginBottom:12,
              animation:"shimmer 4s ease infinite"}}>
              your personal sanctuary
            </p>
            <h1 style={{fontSize:"clamp(2rem,7vw,3rem)",fontWeight:300,color:"#f5f0ff",
              lineHeight:1.1,marginBottom:8,
              background:"linear-gradient(135deg,#f5f0ff 0%,#c084fc 60%,#7c3aed 100%)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Welcome, Victory
            </h1>
            <p style={{fontFamily:"'Crimson Pro',serif",fontSize:"1.05rem",fontStyle:"italic",
              color:"rgba(155,124,200,0.7)",fontWeight:300}}>
              Victory's Book Collection
            </p>
          </div>

          {/* Stats row */}
          {!loadingBooks&&books.length>0&&(
            <div style={{display:"flex",gap:8,justifyContent:"center",marginBottom:"1.75rem",flexWrap:"wrap",
              animation:"fadeUp 0.4s ease 0.1s both"}}>
              {[
                {icon:<BookOpen size={11}/>, label:`${books.length} books`},
                finishedCount>0&&{icon:<CheckCircle2 size={11}/>, label:`${finishedCount} finished`},
                totalHours>0&&{icon:<Clock size={11}/>, label:`~${totalHours} hrs`},
              ].filter(Boolean).map((s,i)=>(
                <div key={i} style={{display:"inline-flex",alignItems:"center",gap:6,
                  background:"rgba(124,58,237,0.1)",border:"0.5px solid rgba(124,58,237,0.2)",
                  borderRadius:20,padding:"5px 14px",fontFamily:"'Space Mono',monospace",
                  fontSize:10,color:"rgba(155,124,200,0.9)"}}>
                  {s.icon}{s.label}
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <div className={`drop-zone ${dragOver?"over":""}`} style={{marginBottom:"1.25rem"}}
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);handleFilePicked(e.dataTransfer.files[0]);}}>
            <input ref={fileInputRef} type="file" accept=".pdf" style={{display:"none"}}
              onChange={e=>handleFilePicked(e.target.files[0])}/>
            {isLoading&&loadingMsg.includes("PDF")?(
              <div>
                <div style={{width:24,height:24,border:"2px solid #c084fc",borderTopColor:"transparent",
                  borderRadius:"50%",margin:"0 auto 12px",animation:"spin 0.8s linear infinite"}}/>
                <p style={{color:"rgba(155,124,200,0.8)",fontSize:13,animation:"pulse 1.5s ease infinite"}}>{loadingMsg}</p>
              </div>
            ):(
              <>
                <div style={{width:48,height:48,borderRadius:"50%",margin:"0 auto 14px",
                  background:"rgba(124,58,237,0.12)",border:"0.5px solid rgba(124,58,237,0.2)",
                  display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Upload size={22} color="rgba(192,132,252,0.8)"/>
                </div>
                <p style={{color:"rgba(155,124,200,0.8)",fontSize:14,marginBottom:6}}>Add a book to your collection</p>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(61,47,92,0.9)"}}>drop PDF here · click to browse</p>
              </>
            )}
          </div>

          {error&&(
            <div style={{background:"rgba(200,60,60,0.07)",border:"0.5px solid rgba(200,60,60,0.2)",
              borderRadius:10,padding:"10px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:8}}>
              <X size={13} color="#f87171"/>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#f87171"}}>{error}</p>
            </div>
          )}

          {/* Search */}
          {books.length>0&&(
            <div className="search-wrap" style={{position:"relative",marginBottom:10}}>
              <Search size={15} color="rgba(74,58,104,0.8)"
                style={{position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none"}}/>
              <input placeholder="Search by title or author…" value={searchQ}
                onChange={e=>setSearchQ(e.target.value)}/>
            </div>
          )}

          {/* Category chips */}
          {books.length>0&&(
            <div style={{display:"flex",gap:8,overflowX:"auto",paddingBottom:4,marginBottom:"1.5rem",scrollbarWidth:"none"}}>
              {presentCats.map(c=>(
                <button key={c} className={`chip ${filterCat===c?"on":""}`} onClick={()=>setFilterCat(c)}>
                  {c!=="All"&&<Tag size={10}/>}{c}
                </button>
              ))}
            </div>
          )}

          {/* Book list */}
          {loadingBooks?(
            <div style={{textAlign:"center",padding:"3rem"}}>
              <div style={{width:28,height:28,border:"2px solid rgba(124,58,237,0.7)",
                borderTopColor:"transparent",borderRadius:"50%",margin:"0 auto",animation:"spin 0.8s linear infinite"}}/>
            </div>
          ):filteredBooks.length===0?(
            <div style={{textAlign:"center",padding:"4rem 1rem"}}>
              <BookOpen size={40} color="rgba(45,31,74,0.6)" style={{margin:"0 auto 16px"}}/>
              <p style={{color:"rgba(45,31,74,0.9)",fontSize:14,fontFamily:"'Space Mono',monospace"}}>
                {books.length===0?"No books yet — upload your first PDF above":"No books match your search"}
              </p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filteredBooks.map((book,i)=>{
                const prog=book.reading_progress?.[0];
                const pct=book.chunk_count?Math.round(((prog?.current_chunk||0)/book.chunk_count)*100):0;
                const last=prog?.last_opened?new Date(prog.last_opened).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
                const fin=book.status==="finished";
                return (
                  <div key={book.id} className="book-card fade-up"
                    style={{animationDelay:`${i*0.06}s`}} onClick={()=>openBook(book)}>
                    <button className="delete-btn" onClick={e=>deleteBook(e,book.id,book.file_path)}>
                      <Trash2 size={13}/>
                    </button>
                    <div style={{display:"flex",gap:14,alignItems:"flex-start"}}>
                      <BookCover book={book} size="sm" onClick={()=>openBook(book)}/>
                      <div style={{flex:1,minWidth:0,paddingRight:20}}>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:5}}>
                          <p style={{fontSize:"1rem",fontWeight:600,color:"#f5f0ff",lineHeight:1.3}}>{book.title}</p>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:11,flexShrink:0,marginLeft:8,
                            color:fin?"#34d399":pct>0?"#c084fc":"rgba(61,47,92,0.9)"}}>
                            {fin?<CheckCircle2 size={14}/>:`${pct}%`}
                          </span>
                        </div>
                        {book.author&&book.author!=="Unknown Author"&&(
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                            <User size={10} color="rgba(124,100,154,0.7)"/>
                            <p style={{fontSize:12,color:"rgba(124,100,154,0.8)",fontStyle:"italic"}}>{book.author}</p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                          {book.category&&book.category!=="Uncategorized"&&(
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(124,58,237,0.9)",
                              background:"rgba(124,58,237,0.1)",borderRadius:10,padding:"2px 8px",
                              display:"flex",alignItems:"center",gap:4}}>
                              <Tag size={8}/>{book.category}
                            </span>
                          )}
                          {last&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)"}}>{last}</span>}
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(61,47,92,0.9)"}}>
                            {(book.word_count||0).toLocaleString()} words
                          </span>
                        </div>
                        <div className="prog-track">
                          <div className={`prog-fill ${fin?"green":""}`} style={{width:`${fin?100:pct}%`,transition:"none"}}/>
                        </div>
                        <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(61,47,92,0.9)",marginTop:5}}>
                          {fin?"complete":pct===0?"not started":"in progress"}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote */}
          <div style={{background:"rgba(124,58,237,0.05)",border:"0.5px solid rgba(124,58,237,0.12)",
            borderRadius:16,padding:"1.4rem 1.6rem",marginTop:"1.75rem",
            position:"relative",overflow:"hidden"}}>
            <div style={{position:"absolute",top:-20,right:-20,width:80,height:80,
              borderRadius:"50%",background:"rgba(124,58,237,0.06)",filter:"blur(20px)"}}/>
            <p style={{fontFamily:"'Crimson Pro',serif",fontSize:"1.05rem",fontStyle:"italic",
              color:"rgba(155,124,200,0.9)",lineHeight:1.7,marginBottom:10}}>"{quote.text}"</p>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)",
              letterSpacing:"0.1em"}}>— {quote.author}</p>
          </div>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ PLAYER */}
      {screen==="player"&&(
        <div style={{maxWidth:500,margin:"0 auto",padding:"2rem 1rem",position:"relative",zIndex:1}}>
          <button className="btn-ghost" onClick={()=>{
            setScreen(fromScreen);setIsPlaying(false);audioRef.current?.pause();
            saveProgress(currentChunk,audioRef.current?.currentTime||0);fetchBooks();
          }} style={{marginBottom:"2rem",gap:8}}>
            <ArrowLeft size={14}/> {fromScreen==="shelf"?"Shelf":"Library"}
          </button>

          {/* Book cover + info */}
          <div style={{display:"flex",flexDirection:"column",alignItems:"center",marginBottom:"2rem"}}>
            <div style={{marginBottom:"1.25rem",animation:"popIn 0.5s cubic-bezier(0.34,1.56,0.64,1)"}}>
              <BookCover book={activeBook||{title:""}} size="lg"/>
            </div>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.2em",
              color:"rgba(192,132,252,0.8)",textTransform:"uppercase",marginBottom:8}}>Now playing</p>
            <h2 style={{fontSize:"clamp(1.1rem,4vw,1.5rem)",fontWeight:300,color:"#f5f0ff",
              lineHeight:1.3,textAlign:"center",marginBottom:5,maxWidth:340}}>
              {activeBook?.title}
            </h2>
            {activeBook?.author&&activeBook.author!=="Unknown Author"&&(
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                <User size={11} color="rgba(124,100,154,0.7)"/>
                <p style={{fontSize:13,color:"rgba(124,100,154,0.8)",fontStyle:"italic"}}>{activeBook.author}</p>
              </div>
            )}
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)"}}>
              {(activeBook?.word_count||0).toLocaleString()} words · {chunks.length} parts
              {cachedCount>0&&<span style={{color:allCached?"#34d399":"#c084fc"}}> · {cachedCount}/{chunks.length} ready</span>}
            </p>
          </div>

          {/* Waveform visualizer */}
          <div style={{marginBottom:"1.5rem"}}>
            <Waveform playing={isPlaying}/>
          </div>

          {/* Voice selector */}
          <div style={{marginBottom:"1.25rem",position:"relative"}} ref={voiceDropRef}>
            <label className="label-sm" style={{display:"flex",alignItems:"center",gap:5,marginBottom:8}}>
              <Mic2 size={11}/> Voice
            </label>
            <button className="btn-glass" onClick={()=>setShowVoiceDrop(v=>!v)}
              style={{width:"100%",justifyContent:"space-between",padding:"11px 14px",
                borderColor:showVoiceDrop?"rgba(192,132,252,0.45)":"rgba(45,31,74,0.8)",
                color:showVoiceDrop?"#c084fc":"rgba(167,139,202,0.9)"}}>
              <span style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontSize:14,color:"#f5f0ff",fontFamily:"'Crimson Pro',serif"}}>{voice.label}</span>
                <span style={{fontSize:10}}>{voice.desc}</span>
              </span>
              {showVoiceDrop?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
            </button>
            {showVoiceDrop&&(
              <div className="voice-dropdown">
                {VOICES.map(v=>(
                  <div key={v.id} className={`voice-opt ${voice.id===v.id?"on":""}`}
                    onClick={()=>{setVoice(v);setShowVoiceDrop(false);setIsPlaying(false);audioRef.current?.pause();}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <div style={{width:6,height:6,borderRadius:"50%",
                        background:voice.id===v.id?"#c084fc":"rgba(45,31,74,0.8)"}}/>
                      <div>
                        <p style={{fontSize:14,color:"#f5f0ff",fontFamily:"'Crimson Pro',serif",marginBottom:1}}>{v.label}</p>
                        <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)"}}>{v.desc} · {v.lang}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Progress */}
          <div className="card" style={{marginBottom:"1rem"}}>
            <div style={{marginBottom:"1.1rem"}}>
              <div className="prog-track thick">
                <div className="prog-fill" style={{width:`${progress}%`}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:6}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)"}}>
                  Part {currentChunk+1} of {chunks.length}
                </span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)"}}>
                  {Math.round(progress)}%
                </span>
              </div>
            </div>

            {/* Scrubber */}
            <div style={{marginBottom:"1.25rem"}}>
              <div className="prog-track" onClick={e=>{
                if(!audioRef.current||!duration) return;
                const rect=e.currentTarget.getBoundingClientRect();
                audioRef.current.currentTime=((e.clientX-rect.left)/rect.width)*duration;
              }} style={{cursor:"pointer"}}>
                <div className="prog-fill" style={{width:`${duration?(currentTime/duration)*100:0}%`}}/>
              </div>
              <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(61,47,92,0.9)"}}>{fmt(currentTime)}</span>
                <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(61,47,92,0.9)"}}>{fmt(duration)}</span>
              </div>
            </div>

            {/* Controls */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:"1.25rem"}}>
              <button className="btn-ghost" onClick={()=>{if(currentChunk>0)playChunk(currentChunk-1);}}
                disabled={currentChunk===0} style={{padding:"9px 10px"}}>
                <SkipBack size={16}/>
              </button>
              <button className="btn-ghost" onClick={()=>handleSkip(-10)} style={{padding:"9px 10px"}}>
                <Rewind size={16}/>
              </button>
              <button className="btn-primary" onClick={handlePlay} disabled={isLoading}
                style={{width:68,height:68,fontSize:20}}>
                {isLoading
                  ?<div style={{width:22,height:22,border:"2.5px solid rgba(245,240,255,0.9)",
                      borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
                  :isPlaying?<Pause size={24} fill="currentColor"/>:<Play size={24} fill="currentColor" style={{marginLeft:3}}/>}
              </button>
              <button className="btn-ghost" onClick={()=>handleSkip(10)} style={{padding:"9px 10px"}}>
                <FastForward size={16}/>
              </button>
              <button className="btn-ghost" onClick={()=>{if(currentChunk<chunks.length-1)playChunk(currentChunk+1);}}
                disabled={currentChunk===chunks.length-1} style={{padding:"9px 10px"}}>
                <SkipForward size={16}/>
              </button>
            </div>

            {/* Speed */}
            <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6}}>
              <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(61,47,92,0.9)",marginRight:4}}>SPEED</span>
              {[0.75,1,1.25,1.5,1.75,2].map(s=>(
                <button key={s} className={`speed-btn ${speed===s?"active":""}`}
                  onClick={()=>{setSpeed(s);if(audioRef.current)audioRef.current.playbackRate=s;}}>{s}×</button>
              ))}
            </div>

            {isLoading&&loadingMsg&&(
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc",
                textAlign:"center",marginTop:"1rem",animation:"pulse 1.5s ease infinite"}}>{loadingMsg}</p>
            )}
          </div>

          {showRegenConfirm&&(
            <div style={{background:"rgba(192,132,252,0.05)",border:"0.5px solid rgba(192,132,252,0.18)",
              borderRadius:12,padding:"14px",marginBottom:10}}>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#c084fc",marginBottom:10}}>
                Regenerate all audio as {voice.label}?
              </p>
              <div style={{display:"flex",gap:8}}>
                <button className="btn-ghost" onClick={()=>setShowRegenConfirm(false)} style={{flex:1}}>Cancel</button>
                <button className="btn-danger" onClick={()=>handlePregenerate(true)} style={{flex:1}}>Regenerate</button>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:12}}>
            <button className="btn-glass" onClick={()=>handlePregenerate(false)}
              disabled={!!pregenProgress||allCached} style={{fontSize:10}}>
              {pregenProgress?<><div style={{width:11,height:11,border:"1.5px solid #c084fc",borderTopColor:"transparent",
                borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> {pregenProgress.done}/{pregenProgress.total}</>
              :allCached?<><CheckCircle2 size={12}/> All ready</>:<><Zap size={12}/> Pre-buffer all</>}
            </button>
            <button className="btn-danger" onClick={()=>setShowRegenConfirm(true)}
              disabled={!!pregenProgress} style={{fontSize:10}}>
              <RefreshCw size={12}/> Regenerate
            </button>
            <button className="btn-glass" onClick={handleDownload}
              disabled={isLoading||cachedCount===0} style={{gridColumn:"1/-1",fontSize:10}}>
              <Download size={12}/> Download MP3 — {voice.label}
            </button>
          </div>

          {error&&(
            <div style={{background:"rgba(200,60,60,0.07)",border:"0.5px solid rgba(200,60,60,0.2)",
              borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",alignItems:"center",gap:8}}>
              <X size={13} color="#f87171"/>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"#f87171"}}>{error}</p>
            </div>
          )}

          <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(30,21,48,0.9)",
            textAlign:"center",marginTop:6}}>
            3 chunks pre-buffered · progress auto-saved
          </p>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ SHELF */}
      {screen==="shelf"&&(
        <div style={{maxWidth:600,margin:"0 auto",padding:"2.5rem 1rem 1rem",position:"relative",zIndex:1}}>
          <div style={{marginBottom:"1.75rem"}}>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.25em",
              color:"rgba(192,132,252,0.8)",textTransform:"uppercase",marginBottom:8}}>finished books</p>
            <h2 style={{fontSize:"clamp(1.4rem,5vw,2.2rem)",fontWeight:300,color:"#f5f0ff",
              background:"linear-gradient(135deg,#f5f0ff,#c084fc)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Your Shelf
            </h2>
            {finishedCount>0&&(
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)",marginTop:6}}>
                {finishedCount} {finishedCount===1?"book":"books"} · ~{totalHours} hrs total
              </p>
            )}
          </div>

          {/* Sort */}
          {finishedCount>0&&(
            <div style={{display:"flex",gap:8,marginBottom:"1.5rem",flexWrap:"wrap"}}>
              {[{id:"date",label:"Recent"},{id:"rating",label:"Top rated"},{id:"author",label:"Author"},{id:"category",label:"Category"}].map(s=>(
                <button key={s.id} className={`chip ${shelfSort===s.id?"on":""}`} onClick={()=>setShelfSort(s.id)}>{s.label}</button>
              ))}
            </div>
          )}

          {finishedCount===0?(
            <div style={{textAlign:"center",padding:"5rem 1rem"}}>
              <div style={{width:80,height:80,borderRadius:"50%",margin:"0 auto 20px",
                background:"rgba(124,58,237,0.08)",border:"0.5px solid rgba(124,58,237,0.15)",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Archive size={36} color="rgba(45,31,74,0.8)"/>
              </div>
              <p style={{color:"rgba(61,47,92,0.9)",fontSize:14,fontFamily:"'Crimson Pro',serif",
                fontStyle:"italic",marginBottom:6}}>Your shelf is empty</p>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:11,color:"rgba(45,31,74,0.8)"}}>
                Finish a book to see it here
              </p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sortedShelf.map((book,i)=>{
                const j=journals[book.id];
                const sel=selectedShelfBook?.id===book.id;
                const finDate=book.finished_at?new Date(book.finished_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):null;
                return (
                  <div key={book.id} className="fade-up" style={{animationDelay:`${i*0.05}s`,
                    background:"rgba(17,13,26,0.75)",borderRadius:16,overflow:"hidden",
                    border:`0.5px solid ${sel?"rgba(124,58,237,0.5)":"rgba(45,31,74,0.7)"}`,
                    transition:"border-color 0.2s,box-shadow 0.2s",
                    boxShadow:sel?"0 0 24px rgba(124,58,237,0.18)":"none",
                    backdropFilter:"blur(12px)"}}>
                    <div style={{display:"flex",gap:14,padding:"1.1rem",cursor:"pointer",alignItems:"flex-start"}}
                      onClick={()=>setSelectedShelfBook(sel?null:book)}>
                      <BookCover book={book} size="sm"/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontSize:"1rem",fontWeight:600,color:"#f5f0ff",lineHeight:1.3,marginBottom:4}}>
                          {book.title}
                        </p>
                        {book.author&&book.author!=="Unknown Author"&&(
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                            <User size={10} color="rgba(124,100,154,0.7)"/>
                            <p style={{fontSize:12,color:"rgba(124,100,154,0.8)",fontStyle:"italic"}}>{book.author}</p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:6,alignItems:"center",flexWrap:"wrap",marginBottom:8}}>
                          {book.category&&book.category!=="Uncategorized"&&(
                            <span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(124,58,237,0.9)",
                              background:"rgba(124,58,237,0.1)",borderRadius:10,padding:"2px 8px",
                              display:"flex",alignItems:"center",gap:4}}>
                              <Tag size={8}/>{book.category}
                            </span>
                          )}
                          {finDate&&<span style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)"}}>{finDate}</span>}
                        </div>
                        {j?.rating>0?<StarRow value={j.rating} readonly/>
                          :<p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(45,31,74,0.9)"}}>No rating yet</p>}
                      </div>
                      <div style={{color:"rgba(74,58,104,0.9)",flexShrink:0,marginTop:4}}>
                        {sel?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                      </div>
                    </div>

                    {sel&&(
                      <div style={{borderTop:"0.5px solid rgba(45,31,74,0.7)",padding:"1rem",
                        animation:"dropIn 0.18s ease",background:"rgba(12,8,22,0.5)"}}>
                        {j&&(j.learned||j.takeaways)&&(
                          <div style={{marginBottom:12,padding:"10px 12px",
                            background:"rgba(124,58,237,0.06)",borderRadius:10,
                            borderLeft:"2px solid rgba(192,132,252,0.3)"}}>
                            <p style={{fontFamily:"'Crimson Pro',serif",fontSize:13,color:"rgba(155,124,200,0.9)",
                              lineHeight:1.6,fontStyle:"italic"}}>
                              "{(j.learned||j.takeaways).substring(0,140)}{(j.learned||j.takeaways).length>140?"…":""}"
                            </p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <button onClick={()=>openBook(book)} className="btn-glass" style={{flex:1,fontSize:10,minWidth:100}}>
                            <Play size={12}/> Listen again
                          </button>
                          <button onClick={()=>openJournal(book)} className="btn-glass" style={{flex:1,fontSize:10,minWidth:100}}>
                            <PenLine size={12}/> {j?"View journal":"Write journal"}
                          </button>
                          <button onClick={()=>{if(confirm("Restart this book? Progress will reset."))repeatBook(book);}}
                            className="btn-ghost" style={{flex:1,fontSize:10,minWidth:100}}>
                            <RotateCcw size={12}/> Restart
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ JOURNAL */}
      {screen==="journal"&&journalBook&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"2rem 1rem",position:"relative",zIndex:1}}>
          <button className="btn-ghost" onClick={()=>setScreen(fromScreen)} style={{marginBottom:"1.75rem",gap:8}}>
            <ArrowLeft size={14}/> Back
          </button>

          <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:"2rem"}}>
            <BookCover book={journalBook} size="md"/>
            <div>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.2em",
                color:"rgba(192,132,252,0.8)",textTransform:"uppercase",marginBottom:8,
                display:"flex",alignItems:"center",gap:6}}><PenLine size={11}/> Book journal</p>
              <h2 style={{fontSize:"clamp(1rem,3.5vw,1.4rem)",fontWeight:300,color:"#f5f0ff",
                lineHeight:1.3,marginBottom:6}}>{journalBook.title}</h2>
              {journalBook.author&&journalBook.author!=="Unknown Author"&&(
                <p style={{fontSize:13,color:"rgba(124,100,154,0.8)",fontStyle:"italic",marginBottom:12}}>{journalBook.author}</p>
              )}
              <StarRow value={journalForm.rating} onChange={r=>setJournalForm(p=>({...p,rating:r}))}/>
            </div>
          </div>

          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {[
              {key:"learned", Icon:Lightbulb, title:"What I learned", hint:"New ideas and perspectives this book gave you"},
              {key:"takeaways", Icon:Star, title:"Key takeaways", hint:"Quotes, moments, and concepts to remember"},
              {key:"actions", Icon:Rocket, title:"Action steps", hint:"What will you actually do differently now?"},
            ].map(({key,Icon,title,hint})=>(
              <div key={key}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:12}}>
                  <div style={{width:34,height:34,borderRadius:10,
                    background:"rgba(124,58,237,0.15)",border:"0.5px solid rgba(124,58,237,0.2)",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon size={16} color="rgba(192,132,252,0.9)"/>
                  </div>
                  <div>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc",
                      textTransform:"uppercase",letterSpacing:"0.14em",marginBottom:2}}>{title}</p>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)"}}>{hint}</p>
                  </div>
                </div>
                <textarea className="journal-ta" rows={4}
                  value={journalForm[key]}
                  onChange={e=>setJournalForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={
                    key==="learned"?"What shifted in your thinking after reading this?":
                    key==="takeaways"?"• Memorable quotes or passages\n• Concepts to remember":
                    "1. Start doing…\n2. Stop doing…\n3. Change how I…"
                  }/>
              </div>
            ))}
          </div>

          <button onClick={saveJournal} disabled={savingJournal}
            style={{width:"100%",marginTop:"1.75rem",
              background:"linear-gradient(135deg,#7c3aed,#9333ea)",border:"none",borderRadius:14,
              color:"#f5f0ff",cursor:"pointer",padding:"15px",
              fontFamily:"'Space Mono',monospace",fontSize:11,fontWeight:700,
              display:"flex",alignItems:"center",justifyContent:"center",gap:9,
              opacity:savingJournal?0.65:1,transition:"opacity 0.2s,transform 0.15s"}}>
            {savingJournal
              ?<><div style={{width:13,height:13,border:"2px solid #f5f0ff",borderTopColor:"transparent",
                  borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/> Saving…</>
              :<><CheckCircle2 size={14}/> Save journal entry</>}
          </button>
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ GOALS */}
      {screen==="goals"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"2.5rem 1rem 1rem",position:"relative",zIndex:1}}>
          <div style={{marginBottom:"1.75rem"}}>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.25em",
              color:"rgba(192,132,252,0.8)",textTransform:"uppercase",marginBottom:8}}>reading goals</p>
            <h2 style={{fontSize:"clamp(1.4rem,5vw,2.2rem)",fontWeight:300,color:"#f5f0ff",
              background:"linear-gradient(135deg,#f5f0ff,#c084fc)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              {thisYear} Goal
            </h2>
          </div>

          {/* Ring */}
          <div className="card" style={{display:"flex",flexDirection:"column",alignItems:"center",
            marginBottom:14,padding:"2.5rem 2rem",animation:"fadeUp 0.4s ease both"}}>
            <div style={{position:"relative",marginBottom:"1.75rem"}}>
              <CircleRing value={booksThisYear.length} max={GOAL} size={170} stroke={14}/>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center"}}>
                <p style={{fontSize:"3rem",fontWeight:300,color:"#f5f0ff",lineHeight:1,
                  background:"linear-gradient(135deg,#f5f0ff,#c084fc)",
                  WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                  {booksThisYear.length}
                </p>
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(124,100,154,0.8)"}}>of {GOAL}</p>
              </div>
            </div>
            <p style={{fontFamily:"'Crimson Pro',serif",fontSize:"1.1rem",color:"rgba(155,124,200,0.9)",
              fontStyle:"italic",textAlign:"center",marginBottom:8}}>
              {booksThisYear.length===0?"Your journey starts with the first page"
                :booksThisYear.length<GOAL/2?"You're building momentum, Victory!"
                :booksThisYear.length<GOAL?`${GOAL-booksThisYear.length} more to go — you've got this!`
                :"Goal achieved! You're a reading queen"}
            </p>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(74,58,104,0.9)"}}>
              {Math.round(booksThisYear.length/GOAL*100)}% complete
            </p>

            {/* Milestones */}
            <div style={{display:"flex",gap:20,marginTop:"2rem",justifyContent:"center"}}>
              {[{n:3,Icon:TrendingUp,label:"Momentum"},{n:6,Icon:Star,label:"Halfway"},{n:9,Icon:BarChart2,label:"Almost"},{n:12,Icon:Trophy,label:"Champion"}].map(m=>{
                const done=booksThisYear.length>=m.n;
                return (
                  <div key={m.n} style={{textAlign:"center",transition:"opacity 0.4s",
                    opacity:done?1:0.25,filter:done?"none":"grayscale(1)"}}>
                    <div style={{width:44,height:44,borderRadius:12,margin:"0 auto 6px",
                      background:done?"linear-gradient(135deg,#7c3aed,#c084fc)":"rgba(45,31,74,0.5)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:done?"0 0 16px rgba(192,132,252,0.35)":"none",
                      transition:"all 0.4s"}}>
                      <m.Icon size={20} color={done?"#f5f0ff":"rgba(74,58,104,0.8)"}/>
                    </div>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:8,
                      color:done?"rgba(192,132,252,0.9)":"rgba(74,58,104,0.8)"}}>{m.label}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly bars */}
          <div className="card" style={{marginBottom:14}}>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(124,100,154,0.8)",
              textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"1.5rem",
              display:"flex",alignItems:"center",gap:6}}>
              Monthly breakdown
            </p>
            <div style={{display:"flex",gap:6,alignItems:"flex-end",height:80}}>
              {monthBreak.map((m,i)=>{
                const past=i<=new Date().getMonth();
                const barH=m.count>0?Math.max(16,(m.count/maxMo)*68):past?3:2;
                return (
                  <div key={m.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                    <div style={{width:"100%",height:barH,borderRadius:4,
                      background:m.count>0?"linear-gradient(180deg,#c084fc,#7c3aed)":past?"rgba(45,31,74,0.5)":"rgba(30,21,48,0.5)",
                      transition:"height 0.8s cubic-bezier(.34,1.56,.64,1)",minHeight:2}}/>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:7,
                      color:m.count>0?"rgba(192,132,252,0.9)":past?"rgba(61,47,92,0.9)":"rgba(45,31,74,0.7)"}}>{m.label}</p>
                    {m.count>0&&<p style={{fontFamily:"'Space Mono',monospace",fontSize:7,color:"rgba(124,100,154,0.9)"}}>{m.count}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* All-time stats */}
          {finishedCount>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {Icon:BookOpen,label:"All-time",value:finishedCount},
                {Icon:Clock,label:"Hours",value:`${totalHours}h`},
                {Icon:TrendingUp,label:"Per month",value:(finishedCount/Math.max(1,new Date().getMonth()+1)).toFixed(1)},
                {Icon:Trophy,label:"This year",value:booksThisYear.length},
              ].map((s,i)=>(
                <div key={i} className="card" style={{textAlign:"center",padding:"1.25rem",
                  animation:`fadeUp 0.4s ease ${i*0.08}s both`}}>
                  <s.Icon size={18} color="rgba(192,132,252,0.6)" style={{margin:"0 auto 8px"}}/>
                  <p style={{fontSize:"2rem",fontWeight:300,color:"#c084fc",lineHeight:1,marginBottom:6,
                    background:"linear-gradient(135deg,#c084fc,#a855f7)",
                    WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>{s.value}</p>
                  <p style={{fontFamily:"'Space Mono',monospace",fontSize:9,color:"rgba(74,58,104,0.9)"}}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════════════════════════════════════════════════════════ WRAPPED */}
      {screen==="wrapped"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"2.5rem 1rem 1rem",position:"relative",zIndex:1}}>
          <div style={{marginBottom:"1.5rem"}}>
            <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,letterSpacing:"0.25em",
              color:"rgba(192,132,252,0.8)",textTransform:"uppercase",marginBottom:8}}>analytics</p>
            <h2 style={{fontSize:"clamp(1.4rem,5vw,2.2rem)",fontWeight:300,color:"#f5f0ff",
              background:"linear-gradient(135deg,#f5f0ff,#c084fc)",
              WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
              Victory Wrapped
            </h2>
          </div>

          {/* Period selector */}
          <div style={{display:"flex",gap:8,marginBottom:"1.75rem"}}>
            {["week","month","quarter","year"].map(p=>(
              <button key={p} className={`chip ${wrappedPeriod===p?"on":""}`}
                onClick={()=>setWrappedPeriod(p)} style={{flex:1,justifyContent:"center",textTransform:"capitalize"}}>
                {p}
              </button>
            ))}
          </div>

          {periodBooks.length===0?(
            <div style={{textAlign:"center",padding:"4rem 1rem"}}>
              <div style={{width:72,height:72,borderRadius:"50%",margin:"0 auto 18px",
                background:"rgba(124,58,237,0.08)",border:"0.5px solid rgba(124,58,237,0.15)",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <BarChart2 size={32} color="rgba(45,31,74,0.8)"/>
              </div>
              <p style={{color:"rgba(61,47,92,0.9)",fontFamily:"'Crimson Pro',serif",
                fontSize:"1.05rem",fontStyle:"italic",marginBottom:6}}>
                No finished books this {wrappedPeriod}
              </p>
              <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(45,31,74,0.8)"}}>
                Keep listening — your stats will appear here
              </p>
            </div>
          ):(
            <>
              {[
                {bg:"linear-gradient(145deg,#1a0536,#3b0764)",accent:"rgba(192,132,252,0.75)",
                  Icon:BookOpen,label:"Books read",value:periodBooks.length,
                  sub:periodBooks.length===1?"One down, many to go":"books of pure wisdom"},
                {bg:"linear-gradient(145deg,#0c1445,#1e3a8a)",accent:"rgba(147,197,253,0.75)",
                  Icon:Clock,label:"Hours absorbed",value:periodHours,
                  sub:"hours of knowledge, Victory"},
                topCats.length>0&&{bg:"linear-gradient(145deg,#0a2014,#14532d)",accent:"rgba(134,239,172,0.75)",
                  Icon:Tag,label:"Top category",value:topCats[0][0],
                  sub:`${topCats[0][1]} ${topCats[0][1]===1?"book":"books"} in this category`,isText:true},
                topAuthors.length>0&&{bg:"linear-gradient(145deg,#2d0836,#581c87)",accent:"rgba(216,180,254,0.75)",
                  Icon:User,label:"Favourite author",value:topAuthors[0][0],
                  sub:`${topAuthors[0][1]} ${topAuthors[0][1]===1?"book":"books"} listened`,isText:true},
                wrappedPeriod==="year"&&{bg:"linear-gradient(145deg,#1c1917,#44403c)",accent:"rgba(214,211,209,0.75)",
                  Icon:Trophy,label:"Goal progress",value:`${Math.round(booksThisYear.length/GOAL*100)}%`,
                  sub:`${booksThisYear.length} of ${GOAL} books`,isText:true},
              ].filter(Boolean).map((card,i)=>(
                <div key={i} className="wrapped-card fade-up" style={{background:card.bg,animationDelay:`${i*0.08}s`}}>
                  <div style={{position:"absolute",top:-30,right:-30,width:120,height:120,
                    borderRadius:"50%",background:"rgba(255,255,255,0.03)",filter:"blur(20px)"}}/>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:12}}>
                    <card.Icon size={14} color={card.accent}/>
                    <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:card.accent,
                      textTransform:"uppercase",letterSpacing:"0.18em"}}>{card.label}</p>
                  </div>
                  <p style={{fontSize:card.isText?"2rem":"4rem",fontWeight:300,color:"#f5f0ff",
                    lineHeight:1.1,marginBottom:10}}>{card.value}</p>
                  <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:card.accent}}>{card.sub}</p>
                </div>
              ))}

              {/* Category breakdown */}
              {topCats.length>1&&(
                <div className="card" style={{marginBottom:12}}>
                  <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(124,100,154,0.8)",
                    textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"1.25rem",
                    display:"flex",alignItems:"center",gap:6}}><Tag size={11}/>Categories</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {topCats.map(([cat,cnt])=>(
                      <div key={cat}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"#f5f0ff"}}>{cat}</span>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc"}}>{cnt}</span>
                        </div>
                        <div className="prog-track thick">
                          <div className="prog-fill" style={{width:`${(cnt/topCats[0][1])*100}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Author breakdown */}
              {topAuthors.length>1&&(
                <div className="card" style={{marginBottom:12}}>
                  <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(124,100,154,0.8)",
                    textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"1.25rem",
                    display:"flex",alignItems:"center",gap:6}}><User size={11}/>Authors</p>
                  <div style={{display:"flex",flexDirection:"column",gap:12}}>
                    {topAuthors.map(([auth,cnt])=>(
                      <div key={auth}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
                          <span style={{fontFamily:"'Crimson Pro',serif",fontSize:15,color:"#f5f0ff"}}>{auth}</span>
                          <span style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"#c084fc"}}>{cnt}</span>
                        </div>
                        <div className="prog-track thick">
                          <div className="prog-fill" style={{width:`${(cnt/topAuthors[0][1])*100}%`}}/>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cover strip */}
              <div className="card">
                <p style={{fontFamily:"'Space Mono',monospace",fontSize:10,color:"rgba(124,100,154,0.8)",
                  textTransform:"uppercase",letterSpacing:"0.15em",marginBottom:"1.25rem",
                  display:"flex",alignItems:"center",gap:6}}>
                  <BookOpen size={11}/> Finished this {wrappedPeriod}
                </p>
                <div style={{display:"flex",gap:10,overflowX:"auto",paddingBottom:6}}>
                  {periodBooks.map(b=>(
                    <BookCover key={b.id} book={b} size="sm"
                      onClick={()=>{setSelectedShelfBook(b);setScreen("shelf");}}/>
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
