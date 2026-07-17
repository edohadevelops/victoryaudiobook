import { useState, useRef, useCallback, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";
import {
  Library, Archive, Target, Sparkles, Play, Pause,
  SkipBack, SkipForward, Rewind, FastForward, ArrowLeft,
  Search, X, Trash2, Zap, Download, RefreshCw, CheckCircle2,
  Lightbulb, Star, Rocket, PenLine, Mic2, BookOpen, Clock,
  TrendingUp, Trophy, Upload, RotateCcw, Tag, User, BarChart2,
  ChevronDown, ChevronUp, Edit2, Sun, Moon, Camera, ImagePlus,
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
  { text:"A reader lives a thousand lives before she dies.", author:"George R.R. Martin" },
  { text:"There is no friend as loyal as a book.", author:"Ernest Hemingway" },
  { text:"Books are a uniquely portable magic.", author:"Stephen King" },
  { text:"She is too fond of books, and it has turned her brain.", author:"Louisa May Alcott" },
  { text:"A book is a dream you hold in your hands.", author:"Neil Gaiman" },
  { text:"Reading is the quietest form of courage.", author:"Unknown" },
];

const VOICES = [
  { id:"en-US-Neural2-F", label:"Naomi",    desc:"Warm American female",    lang:"en-US", gender:"FEMALE" },
  { id:"en-US-Neural2-H", label:"Serena",   desc:"Clear American female",   lang:"en-US", gender:"FEMALE" },
  { id:"en-GB-Wavenet-C", label:"Victoria", desc:"Elegant British female",  lang:"en-GB", gender:"FEMALE" },
  { id:"en-US-Neural2-D", label:"Marcus",   desc:"Warm American male",      lang:"en-US", gender:"MALE" },
  { id:"en-US-Neural2-I", label:"DeShawn",  desc:"Deep rich American male", lang:"en-US", gender:"MALE" },
  { id:"en-US-Wavenet-B", label:"Franklin", desc:"Authoritative male",      lang:"en-US", gender:"MALE" },
  { id:"en-GB-Wavenet-B", label:"Edmund",   desc:"Deep British male",       lang:"en-GB", gender:"MALE" },
  { id:"en-AU-Wavenet-B", label:"Bruce",    desc:"Deep Australian male",    lang:"en-AU", gender:"MALE" },
];

const PALETTES = [
  ["#0d3320","#1a6640"],["#0a1f3d","#1a4080"],["#2a0a3d","#6020a0"],
  ["#3d1a0a","#804020"],["#3d0a1a","#802040"],["#1a1a0a","#404020"],
  ["#0a2a2a","#205050"],["#1a0a2a","#402060"],["#2a1a0a","#604020"],
  ["#0d2a1a","#1a5533"],["#0a0d2a","#1a2080"],["#2a0a10","#801020"],
];

const CONFETTI = Array.from({length:55},(_,i)=>({
  left:(i*37+11)%100, delay:(i*0.12)%3, dur:2.5+(i*0.07)%2,
  size:5+(i*3)%8, rot:(i*47)%360, shape:i%3,
  color:["#1DB954","#17a348","#21cf5f","#ffffff","#a0f0b8","#fbbf24","#60a5fa","#f0abfc"][i%8],
}));

const WAVE_H = [20,38,15,52,28,44,12,35,58,22,40,50,14,42,26,32,55,18,38,12,48,25,42,15,32,52,20,38,48,14,42,26,34,52,20,36,14,46,24,42];

// ─── Helpers ────────────────────────────────────────────────────────────────

function bookGradient(title) {
  let h=0;
  for(let i=0;i<title.length;i++) h=title.charCodeAt(i)+((h<<5)-h);
  return PALETTES[Math.abs(h)%PALETTES.length];
}

function chunkText(text) {
  const paras=text.split(/\n+/).filter(p=>p.trim());
  const chunks=[]; let cur="";
  for(const p of paras){
    if((cur+" "+p).trim().length>CHUNK_SIZE){if(cur.trim())chunks.push(cur.trim());cur=p;}
    else cur=cur?cur+"\n\n"+p:p;
  }
  if(cur.trim())chunks.push(cur.trim());
  return chunks;
}

async function extractTextFromPDF(file) {
  return new Promise((res,rej)=>{
    const r=new FileReader();
    r.onload=async e=>{
      try{
        const lib=window.pdfjsLib;
        lib.GlobalWorkerOptions.workerSrc="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        const pdf=await lib.getDocument({data:new Uint8Array(e.target.result)}).promise;
        let text="";
        for(let i=1;i<=pdf.numPages;i++){
          const pg=await pdf.getPage(i);
          const ct=await pg.getTextContent();
          text+=ct.items.map(it=>it.str).join(" ")+"\n\n";
        }
        res(text.trim());
      }catch(err){rej(err);}
    };
    r.onerror=rej; r.readAsArrayBuffer(file);
  });
}

async function ttsGenerate(text, bookId, idx, voice, force=false) {
  if(!force){
    const {data:c}=await supabase.from("audio_chunks").select("audio_path")
      .eq("book_id",bookId).eq("chunk_index",idx).eq("voice_id",voice.id).single();
    if(c?.audio_path){
      const {data}=supabase.storage.from("audio").getPublicUrl(c.audio_path);
      return data.publicUrl;
    }
  }
  const r=await fetch(`https://texttospeech.googleapis.com/v1/text:synthesize?key=${API_KEY}`,{
    method:"POST",headers:{"Content-Type":"application/json"},
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

// ─── Design system CSS ───────────────────────────────────────────────────────

const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Crimson+Pro:ital,wght@0,400;0,600;1,400&display=swap');

*{box-sizing:border-box;margin:0;padding:0;-webkit-tap-highlight-color:transparent;}
html{scroll-behavior:smooth;}

:root{
  --green:#1DB954;
  --green-dim:rgba(29,185,84,0.15);
  --green-glow:rgba(29,185,84,0.28);
  --green-dark:#17a348;
  --sp:cubic-bezier(.34,1.56,.64,1);
  --ease:cubic-bezier(.16,1,.3,1);
}

/* ── Dark (default) ── */
.dark{
  --bg:#0a0a0a;
  --bg2:#111111;
  --bg3:rgba(255,255,255,0.04);
  --bg3h:rgba(255,255,255,0.08);
  --border:rgba(255,255,255,0.07);
  --borderh:rgba(255,255,255,0.15);
  --t1:#ffffff;
  --t2:rgba(255,255,255,0.62);
  --t3:rgba(255,255,255,0.32);
  --shadow:0 8px 32px rgba(0,0,0,0.55);
  --shadow2:0 20px 60px rgba(0,0,0,0.7);
}

/* ── Light ── */
.light{
  --bg:#f5f5f5;
  --bg2:#ffffff;
  --bg3:rgba(0,0,0,0.03);
  --bg3h:rgba(0,0,0,0.06);
  --border:rgba(0,0,0,0.07);
  --borderh:rgba(0,0,0,0.15);
  --t1:#0a0a0a;
  --t2:rgba(0,0,0,0.6);
  --t3:rgba(0,0,0,0.35);
  --shadow:0 8px 32px rgba(0,0,0,0.1);
  --shadow2:0 20px 60px rgba(0,0,0,0.15);
}

body{background:var(--bg);}

/* ── Keyframes ── */
@keyframes fadeUp{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:translateY(0)}}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes scaleIn{from{opacity:0;transform:scale(0.88)}to{opacity:1;transform:scale(1)}}
@keyframes slideUp{from{opacity:0;transform:translateY(100%)}to{opacity:1;transform:translateY(0)}}
@keyframes slideDown{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:translateY(0)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes pulse{0%,100%{opacity:1}50%{opacity:.35}}
@keyframes waveBar{0%,100%{transform:scaleY(.25);transform-origin:bottom}50%{transform:scaleY(1);transform-origin:bottom}}
@keyframes shimmer{0%{background-position:-600px 0}100%{background-position:600px 0}}
@keyframes confettiFall{to{transform:translateY(105vh) rotate(720deg);opacity:0}}
@keyframes miniSlide{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}
@keyframes greenPulse{0%,100%{box-shadow:0 0 0 0 var(--green-glow)}50%{box-shadow:0 0 0 10px transparent}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-8px)}}
@keyframes twinkle{0%,100%{opacity:.08}50%{opacity:.35}}

.fade-up{animation:fadeUp .38s var(--ease) both;}
.scale-in{animation:scaleIn .3s var(--sp) both;}

/* ── Typography ── */
.t-ui{font-family:'Inter',system-ui,sans-serif;}
.t-serif{font-family:'Crimson Pro',Georgia,serif;}

/* ── Card ── */
.card{
  background:var(--bg3);
  border:1px solid var(--border);
  border-radius:16px;
  padding:20px;
  transition:border-color .2s,background .2s,transform .2s var(--sp),box-shadow .2s;
}
.card-hover:hover{
  background:var(--bg3h);
  border-color:var(--borderh);
  transform:translateY(-2px);
  box-shadow:var(--shadow);
}

/* ── Buttons ── */
.btn{
  display:inline-flex;align-items:center;justify-content:center;gap:7px;
  border:none;border-radius:10px;cursor:pointer;
  font-family:'Inter',system-ui,sans-serif;font-size:12px;font-weight:600;
  transition:transform .15s var(--sp),opacity .15s,background .15s,box-shadow .15s;
  user-select:none;
}
.btn:active{transform:scale(.93)!important;}
.btn-green{
  background:var(--green);color:#000;padding:11px 22px;border-radius:50px;
  letter-spacing:.02em;
}
.btn-green:hover{background:var(--green-dark);box-shadow:0 4px 20px var(--green-glow);}
.btn-ghost{
  background:var(--bg3);border:1px solid var(--border);
  color:var(--t2);padding:9px 16px;
}
.btn-ghost:hover{border-color:var(--borderh);color:var(--t1);}
.btn-icon{
  background:var(--bg3);border:1px solid var(--border);
  color:var(--t2);padding:9px;border-radius:10px;
}
.btn-icon:hover{border-color:var(--borderh);color:var(--t1);}
.btn-danger{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.2);color:#ef4444;padding:9px 16px;}
.btn-danger:hover{background:rgba(239,68,68,.16);}

/* ── Play button ── */
.play-btn{
  width:64px;height:64px;border-radius:50%;background:var(--green);
  color:#000;border:none;cursor:pointer;
  display:flex;align-items:center;justify-content:center;
  transition:transform .2s var(--sp),box-shadow .2s;
  animation:greenPulse 2.5s ease infinite;
}
.play-btn:hover{transform:scale(1.08);box-shadow:0 8px 32px var(--green-glow);}
.play-btn:active{transform:scale(.92);}
.play-btn:disabled{background:var(--bg3);color:var(--t3);cursor:not-allowed;animation:none;}

/* ── Book card ── */
.book-card{
  display:flex;gap:14px;align-items:flex-start;
  background:var(--bg3);border:1px solid var(--border);
  border-radius:14px;padding:14px;cursor:pointer;position:relative;
  transition:background .2s,border-color .2s,transform .18s var(--sp),box-shadow .2s;
}
.book-card:hover{background:var(--bg3h);border-color:var(--borderh);transform:translateY(-2px);box-shadow:var(--shadow);}
.book-card .del-btn{
  position:absolute;top:10px;right:10px;
  background:none;border:none;color:var(--t3);cursor:pointer;padding:5px;border-radius:7px;
  opacity:0;transition:opacity .2s,color .2s;
}
.book-card .edit-btn{
  position:absolute;top:10px;right:36px;
  background:none;border:none;color:var(--t3);cursor:pointer;padding:5px;border-radius:7px;
  opacity:0;transition:opacity .2s,color .2s;
}
.book-card:hover .del-btn,.book-card:hover .edit-btn{opacity:1;}
.book-card .del-btn:hover{color:#ef4444;}
.book-card .edit-btn:hover{color:var(--green);}

/* ── Chip ── */
.chip{
  display:inline-flex;align-items:center;gap:5px;
  background:var(--bg3);border:1px solid var(--border);
  border-radius:50px;padding:6px 14px;cursor:pointer;white-space:nowrap;
  font-family:'Inter',system-ui,sans-serif;font-size:11px;font-weight:500;color:var(--t2);
  transition:all .18s var(--sp);
}
.chip:hover{border-color:var(--borderh);color:var(--t1);transform:translateY(-1px);}
.chip.on{background:var(--green-dim);border-color:var(--green);color:var(--green);font-weight:700;}

/* ── Progress ── */
.prog{height:4px;background:var(--bg3);border-radius:4px;overflow:hidden;}
.prog-fill{height:100%;background:var(--green);border-radius:4px;transition:width .4s linear;}
.prog.thick{height:5px;}
.prog.scrub{height:4px;cursor:pointer;}
.prog.scrub .prog-fill{transition:none;}

/* ── Input / Textarea ── */
.inp{
  background:var(--bg3);border:1px solid var(--border);border-radius:10px;
  color:var(--t1);font-family:'Inter',system-ui,sans-serif;font-size:13px;
  padding:11px 14px;width:100%;outline:none;
  transition:border-color .2s,box-shadow .2s;
}
.inp:focus{border-color:var(--green);box-shadow:0 0 0 3px var(--green-dim);}
.inp::placeholder{color:var(--t3);}
.ta{resize:vertical;min-height:88px;line-height:1.7;font-size:14px;}
.sel{cursor:pointer;}

/* ── Search ── */
.search-wrap{position:relative;}
.search-wrap .ico{position:absolute;left:13px;top:50%;transform:translateY(-50%);color:var(--t3);pointer-events:none;}
.search-inp{padding-left:38px!important;}

/* ── Label ── */
.lbl{font-family:'Inter',system-ui,sans-serif;font-size:10px;font-weight:600;letter-spacing:.1em;text-transform:uppercase;color:var(--t3);display:block;margin-bottom:7px;}

/* ── Skeleton ── */
.skel{
  background:linear-gradient(90deg,var(--bg3) 25%,var(--bg3h) 50%,var(--bg3) 75%);
  background-size:600px 100%;animation:shimmer 1.5s infinite;border-radius:8px;
}
.skel-cover{width:72px;height:100px;border-radius:10px;flex-shrink:0;}
.skel-line{height:10px;margin-bottom:8px;}
.skel-line.w80{width:80%;}
.skel-line.w50{width:50%;}
.skel-line.w30{width:30%;}

/* ── Mini-player ── */
.mini-player{
  position:fixed;bottom:70px;left:0;right:0;z-index:90;
  background:var(--bg2);border-top:1px solid var(--border);
  animation:miniSlide .28s var(--sp);
}
.mini-inner{
  display:flex;align-items:center;gap:12px;
  padding:10px 16px;cursor:pointer;
}

/* ── Bottom nav ── */
.bnav{
  position:fixed;bottom:0;left:0;right:0;z-index:100;
  background:var(--bg2);border-top:1px solid var(--border);
  display:flex;height:70px;
}
.bnav-tab{
  flex:1;background:none;border:none;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:4px;
  color:var(--t3);transition:color .2s;position:relative;
}
.bnav-tab.on{color:var(--green);}
.bnav-tab span{font-family:'Inter',system-ui,sans-serif;font-size:9px;font-weight:600;letter-spacing:.04em;}
.bnav-indicator{
  position:absolute;top:0;height:2px;border-radius:0 0 3px 3px;
  background:var(--green);transition:left .32s var(--sp),width .32s var(--sp);
}

/* ── Voice dropdown ── */
.voice-drop{
  position:absolute;top:calc(100%+6px);left:0;right:0;z-index:60;
  background:var(--bg2);border:1px solid var(--border);border-radius:14px;
  overflow:hidden;animation:slideDown .2s var(--sp);
  box-shadow:var(--shadow2);max-height:260px;overflow-y:auto;
}
.voice-opt{padding:11px 14px;cursor:pointer;transition:background .15s;}
.voice-opt:hover{background:var(--bg3h);}
.voice-opt.on{background:var(--green-dim);}
.voice-drop::-webkit-scrollbar{width:3px;}
.voice-drop::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}

/* ── Modal overlay ── */
.modal-wrap{
  position:fixed;inset:0;z-index:200;
  background:rgba(0,0,0,.75);backdrop-filter:blur(16px);
  display:flex;align-items:flex-end;justify-content:center;
}
.modal-box{
  background:var(--bg2);border:1px solid var(--border);
  border-radius:24px 24px 0 0;padding:24px;width:100%;max-width:540px;
  animation:slideUp .3s var(--sp);max-height:92vh;overflow-y:auto;
}
.modal-box::-webkit-scrollbar{width:3px;}
.modal-box::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}

/* ── Theme toggle ── */
.theme-toggle{
  background:var(--bg3);border:1px solid var(--border);border-radius:50px;
  padding:6px;cursor:pointer;display:flex;align-items:center;gap:4px;
  transition:border-color .2s;
}
.theme-toggle:hover{border-color:var(--borderh);}
.tt-thumb{
  width:28px;height:28px;border-radius:50%;
  display:flex;align-items:center;justify-content:center;
  transition:transform .3s var(--sp),background .3s;
}
.tt-thumb.active{background:var(--green);color:#000;}
.tt-thumb:not(.active){color:var(--t3);}

/* ── Text view (lyrics-style) ── */
.text-view{
  position:fixed;inset:0;z-index:150;
  background:var(--bg);overflow-y:auto;
  padding:24px 24px 120px;
  animation:fadeIn .22s var(--ease);
}
.text-view::-webkit-scrollbar{width:3px;}
.text-view::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
.text-chunk{
  font-family:'Crimson Pro',Georgia,serif;
  font-size:1.35rem;line-height:1.95;
  padding:28px 0;border-bottom:1px solid var(--border);
  cursor:pointer;transition:color .25s;
  position:relative;
}
.text-chunk.active{color:var(--t1);}
.text-chunk:not(.active){color:var(--t3);}
.text-chunk:hover:not(.active){color:var(--t2);}
.text-chunk-num{
  font-family:'Inter',system-ui,sans-serif;font-size:10px;font-weight:700;
  letter-spacing:.1em;text-transform:uppercase;
  color:var(--green);margin-bottom:12px;display:flex;align-items:center;gap:8px;
}
.text-chunk-num .bar{width:24px;height:2px;background:var(--green);border-radius:2px;}

/* ── Waveform ── */
.wave{display:flex;align-items:center;gap:2.5px;height:44px;justify-content:center;}
.wave-bar{
  width:3px;border-radius:4px;transform-origin:bottom;
  transition:background .4s;
}

/* ── Drop zone ── */
.dropzone{
  border:1.5px dashed var(--border);border-radius:16px;
  padding:32px 24px;text-align:center;cursor:pointer;
  transition:all .25s;background:var(--bg3);
}
.dropzone:hover,.dropzone.over{
  border-color:var(--green);background:var(--green-dim);
}

/* ── Cover uploader in edit modal ── */
.cover-upload-area{
  width:100%;height:180px;border-radius:14px;overflow:hidden;
  position:relative;cursor:pointer;
  border:1.5px dashed var(--border);
  transition:border-color .2s;
}
.cover-upload-area:hover{border-color:var(--green);}
.cover-upload-overlay{
  position:absolute;inset:0;
  background:rgba(0,0,0,.55);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;
  opacity:0;transition:opacity .2s;
}
.cover-upload-area:hover .cover-upload-overlay{opacity:1;}

/* ── Waveform wrapped card ── */
.wrapped-hero{
  border-radius:20px;padding:28px;position:relative;overflow:hidden;margin-bottom:12px;
}
.wrapped-hero::after{
  content:'';position:absolute;inset:0;
  background:linear-gradient(135deg,rgba(255,255,255,.05) 0%,transparent 60%);
  pointer-events:none;
}

/* ── Speed btn ── */
.spd{
  background:none;border:1px solid var(--border);border-radius:8px;
  color:var(--t3);cursor:pointer;font-family:'Inter',system-ui,sans-serif;
  font-size:10px;font-weight:600;padding:5px 9px;
  transition:all .15s;
}
.spd:hover{border-color:var(--borderh);color:var(--t1);}
.spd.on{border-color:var(--green);color:var(--green);background:var(--green-dim);}

/* ── Stars ── */
.star-btn{background:none;border:none;cursor:pointer;padding:2px;transition:transform .15s var(--sp);}
.star-btn:hover{transform:scale(1.2);}

/* ── Scrollbar ── */
::-webkit-scrollbar{width:3px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border);border-radius:2px;}
`;

// ─── Sub-components ──────────────────────────────────────────────────────────

const STARS = Array.from({length:55},(_,i)=>({
  left:(i*71+13)%100, top:(i*47+23)%100,
  s:i%4===0?1.5:.8, op:.04+(i%6)*.04,
  dur:2+(i*.23)%3, delay:(i*.31)%5,
}));

const Starfield = ({dark}) => !dark ? null : (
  <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:0,overflow:"hidden"}}>
    {STARS.map((s,i)=>(
      <div key={i} style={{position:"absolute",left:`${s.left}%`,top:`${s.top}%`,
        width:s.s,height:s.s,borderRadius:"50%",background:"#1DB954",opacity:s.op,
        animation:`twinkle ${s.dur}s ease-in-out ${s.delay}s infinite alternate`}}/>
    ))}
  </div>
);

function BookCover({book,size="md",onClick,playing=false}) {
  const [c1,c2]=bookGradient(book.title);
  const dims={sm:{w:64,h:90},md:{w:96,h:136},lg:{w:200,h:200}}[size];
  const isLg=size==="lg";
  return (
    <div onClick={onClick}
      style={{width:dims.w,height:dims.h,borderRadius:isLg?12:8,overflow:"hidden",flexShrink:0,
        cursor:onClick?"pointer":"default",position:"relative",
        boxShadow:isLg?"0 20px 60px rgba(0,0,0,.7)":"0 4px 20px rgba(0,0,0,.5)",
        animation:isLg&&playing?"float 4s ease-in-out infinite":"none",
        transition:"transform .25s var(--sp),box-shadow .25s"}}
      onMouseEnter={e=>{if(onClick&&!isLg){e.currentTarget.style.transform="translateY(-4px) scale(1.02)";e.currentTarget.style.boxShadow="0 12px 40px rgba(0,0,0,.6)";}}}
      onMouseLeave={e=>{if(!isLg){e.currentTarget.style.transform="";e.currentTarget.style.boxShadow="0 4px 20px rgba(0,0,0,.5)";}}}>
      {book.cover_url
        ? <img src={book.cover_url} alt={book.title}
            style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
        : <div style={{width:"100%",height:"100%",
            background:`linear-gradient(145deg,${c1},${c2})`,
            display:"flex",flexDirection:"column",justifyContent:"flex-end",padding:"8px 7px"}}>
            <div style={{position:"absolute",inset:0,background:"linear-gradient(to bottom,transparent 40%,rgba(0,0,0,.55))"}}/>
            <p style={{position:"relative",fontSize:size==="sm"?7.5:9.5,fontWeight:700,
              color:"rgba(255,255,255,.95)",lineHeight:1.3,
              display:"-webkit-box",WebkitLineClamp:4,WebkitBoxOrient:"vertical",overflow:"hidden"}}>
              {book.title}
            </p>
          </div>}
    </div>
  );
}

const Waveform = ({playing,bars=36}) => (
  <div className="wave">
    {WAVE_H.slice(0,bars).map((h,i)=>(
      <div key={i} className="wave-bar"
        style={{height:`${h}%`,
          background:playing?"var(--green)":"var(--bg3h)",
          animation:playing?`waveBar ${.35+(i%7)*.1}s ease-in-out ${(i%5)*.07}s infinite alternate`:"none"}}/>
    ))}
  </div>
);

const CircleRing = ({value,max,size=164,stroke=13}) => {
  const r=(size-stroke)/2, circ=2*Math.PI*r;
  const off=circ-Math.min(value/max,1)*circ;
  return (
    <svg width={size} height={size}>
      <defs>
        <linearGradient id="rg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1DB954"/>
          <stop offset="100%" stopColor="#17a348"/>
        </linearGradient>
      </defs>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="var(--bg3)" strokeWidth={stroke}/>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="url(#rg)" strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={off} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`}
        style={{transition:"stroke-dashoffset 1.2s var(--ease)"}}/>
    </svg>
  );
};

const StarRow = ({value,onChange,readonly=false}) => (
  <div style={{display:"flex",gap:3}}>
    {[1,2,3,4,5].map(s=>(
      <button key={s} className="star-btn" onClick={()=>!readonly&&onChange?.(s)}>
        <Star size={17} fill={s<=value?"var(--green)":"none"}
          color={s<=value?"var(--green)":"var(--t3)"}/>
      </button>
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

function SkeletonCards() {
  return (
    <div style={{display:"flex",flexDirection:"column",gap:10}}>
      {[0,.07,.14].map(d=>(
        <div key={d} className="book-card" style={{pointerEvents:"none",animation:`fadeUp .4s var(--ease) ${d}s both`}}>
          <div className="skel skel-cover"/>
          <div style={{flex:1}}>
            <div className="skel skel-line w80"/>
            <div className="skel skel-line w50"/>
            <div style={{height:16}}/>
            <div className="skel skel-line w30"/>
          </div>
        </div>
      ))}
    </div>
  );
}

function ThemeToggle({theme,onToggle}) {
  return (
    <button className="theme-toggle t-ui" onClick={onToggle} aria-label="Toggle theme">
      <div className={`tt-thumb ${theme==="light"?"":"active"}`}>
        <Moon size={13}/>
      </div>
      <div className={`tt-thumb ${theme==="light"?"active":""}`}>
        <Sun size={13}/>
      </div>
    </button>
  );
}

function MiniPlayer({book,isPlaying,progress,onToggle,onOpen}) {
  const [c1,c2]=bookGradient(book.title);
  return (
    <div className="mini-player">
      <div style={{height:2,background:"var(--bg3)"}}>
        <div style={{height:"100%",width:`${progress}%`,background:"var(--green)",transition:"width .5s linear"}}/>
      </div>
      <div className="mini-inner" onClick={onOpen}>
        <div style={{width:38,height:38,borderRadius:8,overflow:"hidden",flexShrink:0}}>
          {book.cover_url
            ?<img src={book.cover_url} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
            :<div style={{width:"100%",height:"100%",background:`linear-gradient(135deg,${c1},${c2})`}}/>}
        </div>
        <div style={{flex:1,minWidth:0}}>
          <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:13,fontWeight:600,
            color:"var(--t1)",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>
            {book.title}
          </p>
          <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:11,color:"var(--t3)"}}>
            {book.author||"Unknown Author"}
          </p>
        </div>
        <button onClick={e=>{e.stopPropagation();onToggle();}}
          style={{background:"var(--green)",border:"none",borderRadius:"50%",width:36,height:36,
            cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",
            flexShrink:0,transition:"transform .15s var(--sp)"}}>
          {isPlaying?<Pause size={15} color="#000" fill="#000"/>:<Play size={15} color="#000" fill="#000" style={{marginLeft:2}}/>}
        </button>
      </div>
    </div>
  );
}

function TextViewPanel({chunks,currentChunk,isPlaying,onClose,onJumpTo,book,theme}) {
  const activeRef=useRef(null);

  // Scroll active chunk into view whenever it changes
  useEffect(()=>{
    if(activeRef.current){
      activeRef.current.scrollIntoView({behavior:"smooth",block:"center"});
    }
  },[currentChunk]);

  return (
    <div className="text-view">
      {/* Sticky header */}
      <div style={{position:"sticky",top:0,zIndex:10,
        background:"var(--bg)",paddingBottom:16,marginBottom:8,
        borderBottom:"1px solid var(--border)"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:10,fontWeight:700,
              letterSpacing:".12em",textTransform:"uppercase",color:"var(--green)",marginBottom:4}}>
              Now reading
            </p>
            <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:15,fontWeight:700,
              color:"var(--t1)",lineHeight:1.2}}>{book.title}</p>
          </div>
          <button onClick={onClose}
            style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:10,
              color:"var(--t2)",cursor:"pointer",padding:9,display:"flex",
              alignItems:"center",justifyContent:"center",
              transition:"border-color .2s,color .2s"}}
            onMouseEnter={e=>{e.currentTarget.style.borderColor="var(--borderh)";e.currentTarget.style.color="var(--t1)";}}
            onMouseLeave={e=>{e.currentTarget.style.borderColor="var(--border)";e.currentTarget.style.color="var(--t2)";}}>
            <X size={15}/>
          </button>
        </div>
        {/* Mini progress bar */}
        <div style={{height:2,background:"var(--bg3)",borderRadius:2,marginTop:14,overflow:"hidden"}}>
          <div style={{height:"100%",borderRadius:2,background:"var(--green)",
            width:`${((currentChunk+1)/chunks.length)*100}%`,
            transition:"width .5s var(--ease)"}}/>
        </div>
        <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:10,color:"var(--t3)",
          fontWeight:600,marginTop:6}}>
          Part {currentChunk+1} of {chunks.length}
        </p>
      </div>

      {/* Chunks */}
      {chunks.map((text,i)=>{
        const isActive=i===currentChunk;
        return (
          <div key={i} ref={isActive?activeRef:null}
            className={`text-chunk ${isActive?"active":""}`}
            onClick={()=>onJumpTo(i)}>
            {isActive&&(
              <div className="text-chunk-num">
                <div className="bar"/>
                <span>Part {i+1}</span>
                {isPlaying&&<span style={{display:"flex",alignItems:"center",gap:3,
                  fontWeight:400,color:"var(--green)",fontStyle:"italic"}}>
                  — playing
                </span>}
              </div>
            )}
            <p style={{whiteSpace:"pre-wrap",lineHeight:"inherit",
              fontSize:isActive?"1.4rem":"1.25rem",
              transition:"font-size .3s var(--ease)",
              fontWeight:isActive?400:400}}>
              {text}
            </p>
            {!isActive&&(
              <p style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:10,
                color:"var(--t3)",fontWeight:600,marginTop:10,opacity:.6}}>
                Part {i+1} · tap to jump here
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}

function BottomNav({screen,setScreen,finishedCount}) {
  const tabs=[
    {id:"library",Icon:Library,label:"Library"},
    {id:"shelf",  Icon:Archive, label:"Shelf", badge:finishedCount},
    {id:"goals",  Icon:Target,  label:"Goals"},
    {id:"wrapped",Icon:Sparkles,label:"Wrapped"},
  ];
  const activeIdx=tabs.findIndex(t=>t.id===screen);
  const pct=100/tabs.length;
  return (
    <nav className="bnav">
      <div className="bnav-indicator" style={{left:`${activeIdx*pct}%`,width:`${pct}%`}}/>
      {tabs.map(({id,Icon,label,badge},i)=>{
        const on=screen===id;
        return (
          <button key={id} className={`bnav-tab ${on?"on":""}`} onClick={()=>setScreen(id)}>
            {badge>0&&!on&&(
              <div style={{position:"absolute",top:12,right:"18%",width:7,height:7,
                borderRadius:"50%",background:"var(--green)"}}/>
            )}
            <div style={{transform:on?"scale(1.15)":"scale(1)",transition:"transform .25s var(--sp)"}}>
              <Icon size={20} strokeWidth={on?2.2:1.6}/>
            </div>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}

// ─── App ─────────────────────────────────────────────────────────────────────

export default function App() {
  const [theme,setTheme]=useState(()=>localStorage.getItem("theme")||"dark");
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
  const [voice,setVoice]=useState(VOICES[0]);
  const [showVoiceDrop,setShowVoiceDrop]=useState(false);
  const [showTextView,setShowTextView]=useState(false);
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
  const [editBook,setEditBook]=useState(null);
  const [editForm,setEditForm]=useState({title:"",author:"",category:"Uncategorized"});
  const [editCoverFile,setEditCoverFile]=useState(null);
  const [editCoverPreview,setEditCoverPreview]=useState(null);
  const [savingEdit,setSavingEdit]=useState(false);
  const [quoteIdx]=useState(()=>Math.floor((Date.now()/86400000)%QUOTES.length));

  const audioRef=useRef(null);
  const fileInputRef=useRef(null);
  const coverInputRef=useRef(null);
  const editCoverInputRef=useRef(null);
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

  useEffect(()=>{
    document.body.className=theme;
    localStorage.setItem("theme",theme);
  },[theme]);

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
    setError("");setIsLoading(true);setLoadingMsg("Extracting text…");
    try{
      const text=await extractTextFromPDF(file);
      if(!text) throw new Error("No readable text found.");
      setUploadPending({file,text,chunks:chunkText(text)});
      setUploadForm({title:file.name.replace(/\.pdf$/i,""),author:"",category:"Uncategorized"});
    }catch(e){setError(e.message);}
    setIsLoading(false);setLoadingMsg("");
  };

  const confirmUpload=async()=>{
    if(!uploadPending) return;
    setUploading(true);setLoadingMsg("Adding to collection…");
    try{
      const {file,text,chunks:c}=uploadPending;
      const fp=`${Date.now()}_${file.name}`;
      await supabase.storage.from("books").upload(fp,file);
      // Insert core columns first (always exist)
      const baseInsert={title:uploadForm.title||file.name.replace(/\.pdf$/i,""),
        file_path:fp,word_count:text.split(/\s+/).filter(Boolean).length,
        chunk_count:c.length,status:"reading"};
      // Try with optional columns; fall back to base if schema missing
      let bd,be;
      ({data:bd,error:be}=await supabase.from("books").insert({
        ...baseInsert,author:uploadForm.author||"Unknown Author",category:uploadForm.category,
      }).select().single());
      if(be&&(be.message?.includes("author")||be.message?.includes("category"))){
        ({data:bd,error:be}=await supabase.from("books").insert(baseInsert).select().single());
      }
      if(be) throw be;
      await supabase.from("reading_progress").insert({book_id:bd.id,current_chunk:0,current_position:0});
      await fetchBooks();
      setUploadPending(null);setUploading(false);setLoadingMsg("");
      openBook({...bd,reading_progress:[{current_chunk:0,current_position:0}]},c);
    }catch(e){setError(e.message);setUploading(false);setLoadingMsg("");}
  };

  // ── Edit book
  const openEdit=(e,book)=>{
    e.stopPropagation();
    setEditBook(book);
    setEditForm({title:book.title,author:book.author||"",category:book.category||"Uncategorized"});
    setEditCoverFile(null);
    setEditCoverPreview(book.cover_url||null);
  };

  const handleEditCoverPick=file=>{
    if(!file||!file.type.startsWith("image/")) return;
    setEditCoverFile(file);
    const reader=new FileReader();
    reader.onload=e=>setEditCoverPreview(e.target.result);
    reader.readAsDataURL(file);
  };

  const saveEdit=async()=>{
    if(!editBook) return;
    setSavingEdit(true);
    setError("");
    try{
      let cover_url=editBook.cover_url||null;
      if(editCoverFile){
        const ext=editCoverFile.name.split(".").pop();
        const path=`covers/${editBook.id}.${ext}`;
        const {error:upErr}=await supabase.storage.from("books").upload(path,editCoverFile,{upsert:true});
        if(!upErr){
          const {data:urlData}=supabase.storage.from("books").getPublicUrl(path);
          cover_url=urlData.publicUrl;
        }
      }

      // Build payload and strip columns that don't exist in the schema yet.
      // Try the full payload first; on a schema-cache error, retry with only title.
      const fullPayload={title:editForm.title||editBook.title};
      // Conditionally add optional columns — silently skip if they're missing
      const tryColumns=async(cols)=>{
        const p={...fullPayload,...cols};
        if(cover_url!==editBook.cover_url) p.cover_url=cover_url;
        const {error}=await supabase.from("books").update(p).eq("id",editBook.id);
        return error;
      };

      let err=await tryColumns({author:editForm.author||"Unknown Author",category:editForm.category});
      if(err){
        // Retry without author if that column is missing
        if(err.message?.toLowerCase().includes("author")){
          err=await tryColumns({category:editForm.category});
        }
        // Retry without category too if still failing
        if(err?.message?.toLowerCase().includes("category")){
          err=await tryColumns({});
        }
        if(err) throw err;
      }

      const merged={...fullPayload,author:editForm.author||"Unknown Author",
        category:editForm.category,cover_url};
      await fetchBooks();
      if(activeBook?.id===editBook.id) setActiveBook(p=>({...p,...merged}));
      setEditBook(null);
    }catch(e){
      const msg=e.message||String(e);
      if(msg.includes("author")||msg.includes("category")||msg.includes("cover_url")){
        setError("Missing columns in database. Run this SQL in Supabase → SQL Editor:\n\nALTER TABLE books ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Unknown Author';\nALTER TABLE books ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'Uncategorized';\nALTER TABLE books ADD COLUMN IF NOT EXISTS cover_url TEXT;");
      }else{
        setError(msg);
      }
    }
    setSavingEdit(false);
  };

  // ── Open book
  const openBook=async(book,preloaded=null)=>{
    setError("");setAudioUrls({});setIsPlaying(false);setActiveBook(book);
    setPregenProgress(null);setShowRegenConfirm(false);setShowBookComplete(false);
    setFromScreen(screen);
    let c=preloaded;
    if(!c){
      setIsLoading(true);setLoadingMsg("Loading book…");
      try{
        const {data}=await supabase.storage.from("books").download(book.file_path);
        const f=new File([data],book.title+".pdf",{type:"application/pdf"});
        c=chunkText(await extractTextFromPDF(f));
      }catch(e){setError(e.message);setIsLoading(false);return;}
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
    const book=bookRef.current,prog=book?.reading_progress?.[0];
    if(prog?.id) await supabase.from("reading_progress")
      .update({current_chunk:chunk,current_position:pos,last_opened:new Date().toISOString()})
      .eq("id",prog.id);
  },[]);

  const deleteBook=async(e,bookId,fp)=>{
    e.stopPropagation();
    if(!confirm("Remove this book from your collection?")) return;
    const {data:cd}=await supabase.from("audio_chunks").select("audio_path").eq("book_id",bookId);
    if(cd?.length) await supabase.storage.from("audio").remove(cd.map(c=>c.audio_path));
    await supabase.storage.from("books").remove([fp]);
    await supabase.from("books").delete().eq("id",bookId);
    if(activeBook?.id===bookId){setActiveBook(null);setIsPlaying(false);audioRef.current?.pause();}
    fetchBooks();
  };

  // ── Audio — seamless 4-chunk lookahead
  const preloadChunk=useCallback(async idx=>{
    const c=chunksRef.current,urls=urlsRef.current,book=bookRef.current,v=voiceRef.current;
    if(!API_KEY||!c[idx]||urls[idx]||!book) return;
    try{
      const url=await ttsGenerate(c[idx],book.id,idx,v);
      setAudioUrls(prev=>({...prev,[idx]:url}));
      setCachedChunks(prev=>({...prev,[idx]:true}));
      // pre-buffer bytes into browser cache
      const h=new Audio();h.preload="auto";h.src=url;h.load();
    }catch(e){}
  },[]);

  const playChunk=useCallback(async(idx,force=false)=>{
    const c=chunksRef.current,book=bookRef.current,v=voiceRef.current;
    if(!c[idx]) return;
    setCurrentChunk(idx);setError("");
    let url=!force&&urlsRef.current[idx]?urlsRef.current[idx]:null;
    if(!url){
      setIsLoading(true);
      setLoadingMsg(cachedChunks[idx]&&!force?`Loading part ${idx+1}…`:`Generating part ${idx+1} of ${c.length}…`);
      try{
        url=await ttsGenerate(c[idx],book.id,idx,v,force);
        setAudioUrls(prev=>({...prev,[idx]:url}));
        setCachedChunks(prev=>({...prev,[idx]:true}));
      }catch(e){setError(e.message);setIsLoading(false);setIsPlaying(false);return;}
      setIsLoading(false);setLoadingMsg("");
    }
    if(audioRef.current){
      audioRef.current.src=url;
      audioRef.current.playbackRate=speedRef.current;
      audioRef.current.play();
      setIsPlaying(true);
    }
    // pre-generate next 4 chunks so transitions are instant
    [1,2,3,4].forEach(off=>{
      const n=idx+off;
      if(c[n]&&!urlsRef.current[n]) setTimeout(()=>preloadChunk(n),off*600);
    });
  },[cachedChunks,preloadChunk]);

  const handlePlay=async()=>{
    if(!API_KEY){setError("VITE_GOOGLE_TTS_KEY not configured.");return;}
    if(!chunks.length) return;
    if(isPlaying){
      audioRef.current?.pause();setIsPlaying(false);
      saveProgress(currentChunk,audioRef.current?.currentTime||0);
    }else{
      if(audioRef.current?.src&&audioRef.current.paused){
        audioRef.current.playbackRate=speed;audioRef.current.play();setIsPlaying(true);
      }else playChunk(currentChunk);
    }
  };

  const handleEnded=useCallback(async()=>{
    const idx=chunkRef.current,c=chunksRef.current,book=bookRef.current;
    if(idx<c.length-1){
      playChunk(idx+1);
    }else{
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
        try{
          const url=await ttsGenerate(chunks[i],activeBook.id,i,voice,force);
          setAudioUrls(prev=>({...prev,[i]:url}));
          setCachedChunks(prev=>({...prev,[i]:true}));
          const h=new Audio();h.preload="auto";h.src=url;h.load();
        }catch(e){setError(`Part ${i+1}: ${e.message}`);setPregenProgress(null);return;}
      }
      setPregenProgress({done:i+1,total:chunks.length});
    }
    setPregenProgress(null);
  };

  const handleDownload=async()=>{
    if(!activeBook) return;
    setLoadingMsg("Preparing…");setIsLoading(true);
    try{
      const {data:cd}=await supabase.from("audio_chunks").select("chunk_index,audio_path")
        .eq("book_id",activeBook.id).eq("voice_id",voice.id).order("chunk_index");
      if(!cd?.length){setError("Generate audio first.");setIsLoading(false);setLoadingMsg("");return;}
      const blobs=[];
      for(const ch of cd){const {data}=await supabase.storage.from("audio").download(ch.audio_path);blobs.push(data);}
      const url=URL.createObjectURL(new Blob(blobs,{type:"audio/mp3"}));
      const a=document.createElement("a");a.href=url;a.download=`${activeBook.title}.mp3`;a.click();
      URL.revokeObjectURL(url);
    }catch(e){setError(e.message);}
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
  const showNav=!["player","journal"].includes(screen);
  const showMini=!!activeBook&&showNav;
  const contentPb=showNav?(showMini?140:72):0;

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
  const [c1pg,c2pg]=bookGradient(activeBook?.title||"");

  return (
    <div style={{minHeight:"100vh",background:"var(--bg)",color:"var(--t1)",
      fontFamily:"Inter,system-ui,sans-serif",paddingBottom:contentPb}}>
      <style>{CSS}</style>

      <audio ref={audioRef} onEnded={handleEnded} onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={()=>setDuration(audioRef.current?.duration||0)}/>

      <Starfield dark={theme==="dark"}/>
      {theme==="dark"&&<>
        <div style={{position:"fixed",top:-200,right:-200,width:500,height:500,borderRadius:"50%",
          background:"rgba(29,185,84,0.04)",filter:"blur(100px)",pointerEvents:"none",zIndex:0}}/>
        <div style={{position:"fixed",bottom:-150,left:-150,width:400,height:400,borderRadius:"50%",
          background:"rgba(29,185,84,0.03)",filter:"blur(80px)",pointerEvents:"none",zIndex:0}}/>
      </>}

      {/* ── Upload Modal */}
      {uploadPending&&(
        <div className="modal-wrap" onClick={e=>{if(e.target===e.currentTarget)setUploadPending(null);}}>
          <div className="modal-box">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <p className="lbl">New book</p>
                <h3 style={{fontSize:"1.3rem",fontWeight:600,color:"var(--t1)"}}>Customize your book</h3>
              </div>
              <BookCover book={{title:uploadForm.title||"Preview"}} size="sm"/>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:14,marginBottom:20}}>
              <div>
                <label className="lbl">Title</label>
                <input className="inp" value={uploadForm.title}
                  onChange={e=>setUploadForm(p=>({...p,title:e.target.value}))} placeholder="Book title…"/>
              </div>
              <div>
                <label className="lbl">Author</label>
                <input className="inp" value={uploadForm.author}
                  onChange={e=>setUploadForm(p=>({...p,author:e.target.value}))} placeholder="Author name…"/>
              </div>
              <div>
                <label className="lbl">Category</label>
                <select className="inp sel" value={uploadForm.category}
                  onChange={e=>setUploadForm(p=>({...p,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={()=>setUploadPending(null)} style={{flex:1}}>Cancel</button>
              <button onClick={confirmUpload} disabled={uploading}
                className="btn btn-green" style={{flex:2,borderRadius:10}}>
                {uploading?<><div style={{width:13,height:13,border:"2px solid #000",borderTopColor:"transparent",
                  borderRadius:"50%",animation:"spin .8s linear infinite"}}/> Adding…</>
                :<><BookOpen size={14}/> Add to library</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Book Modal */}
      {editBook&&(
        <div className="modal-wrap" onClick={e=>{if(e.target===e.currentTarget)setEditBook(null);}}>
          <div className="modal-box">
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
              <div>
                <p className="lbl">Customize book</p>
                <h3 style={{fontSize:"1.3rem",fontWeight:600,color:"var(--t1)"}}>Edit details</h3>
              </div>
              <button className="btn btn-icon" onClick={()=>setEditBook(null)}><X size={15}/></button>
            </div>

            {/* Cover upload */}
            <input ref={editCoverInputRef} type="file" accept="image/*" style={{display:"none"}}
              onChange={e=>handleEditCoverPick(e.target.files[0])}/>
            <div style={{marginBottom:18}}>
              <label className="lbl">Cover image</label>
              <div className="cover-upload-area" onClick={()=>editCoverInputRef.current?.click()}>
                {editCoverPreview
                  ?<img src={editCoverPreview} style={{width:"100%",height:"100%",objectFit:"cover"}}/>
                  :(()=>{const [a,b]=bookGradient(editBook.title);return(
                    <div style={{width:"100%",height:"100%",background:`linear-gradient(145deg,${a},${b})`,
                      display:"flex",alignItems:"center",justifyContent:"center"}}>
                      <ImagePlus size={28} color="rgba(255,255,255,.4)"/>
                    </div>
                  );})()}
                <div className="cover-upload-overlay">
                  <Camera size={22} color="#fff"/>
                  <span style={{fontFamily:"Inter,system-ui,sans-serif",fontSize:11,fontWeight:600,color:"#fff"}}>
                    {editCoverPreview?"Change photo":"Add cover photo"}
                  </span>
                </div>
              </div>
            </div>

            <div style={{display:"flex",flexDirection:"column",gap:13,marginBottom:20}}>
              <div>
                <label className="lbl">Display name</label>
                <input className="inp" value={editForm.title}
                  onChange={e=>setEditForm(p=>({...p,title:e.target.value}))} placeholder="How you want to call this book…"/>
              </div>
              <div>
                <label className="lbl">Author</label>
                <input className="inp" value={editForm.author}
                  onChange={e=>setEditForm(p=>({...p,author:e.target.value}))} placeholder="Author name…"/>
              </div>
              <div>
                <label className="lbl">Category</label>
                <select className="inp sel" value={editForm.category}
                  onChange={e=>setEditForm(p=>({...p,category:e.target.value}))}>
                  {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn btn-ghost" onClick={()=>setEditBook(null)} style={{flex:1}}>Cancel</button>
              <button onClick={saveEdit} disabled={savingEdit}
                className="btn btn-green" style={{flex:2,borderRadius:10}}>
                {savingEdit?<><div style={{width:13,height:13,border:"2px solid #000",borderTopColor:"transparent",
                  borderRadius:"50%",animation:"spin .8s linear infinite"}}/> Saving…</>
                :<><CheckCircle2 size={14}/> Save changes</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Book Complete */}
      {showBookComplete&&(
        <>
          <ConfettiBlast/>
          <div style={{position:"fixed",inset:0,background:"var(--bg)",zIndex:250,
            display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",
            padding:"2rem",textAlign:"center"}}>
            <div style={{animation:"scaleIn .5s var(--sp) .1s both",marginBottom:28}}>
              <div style={{width:96,height:96,borderRadius:"50%",margin:"0 auto",
                background:"var(--green)",display:"flex",alignItems:"center",justifyContent:"center",
                boxShadow:"0 0 60px var(--green-glow)"}}>
                <BookOpen size={44} color="#000"/>
              </div>
            </div>
            <p className="lbl" style={{animation:"fadeUp .3s var(--ease) .4s both",color:"var(--green)"}}>
              book complete
            </p>
            <h2 style={{fontSize:"clamp(1.8rem,6vw,2.8rem)",fontWeight:700,color:"var(--t1)",
              marginBottom:8,animation:"fadeUp .3s var(--ease) .5s both"}}>You did it, Victory!</h2>
            <p style={{fontSize:"1.1rem",color:"var(--t2)",fontFamily:"Crimson Pro,Georgia,serif",
              fontStyle:"italic",marginBottom:6,animation:"fadeUp .3s var(--ease) .6s both"}}>
              "{activeBook?.title}"
            </p>
            <p className="lbl" style={{marginBottom:36,animation:"fadeUp .3s var(--ease) .7s both"}}>
              ~{Math.round((activeBook?.word_count||0)/150/60*10)/10} hrs · {(activeBook?.word_count||0).toLocaleString()} words
            </p>
            <div style={{display:"flex",flexDirection:"column",gap:10,width:"100%",maxWidth:300,
              animation:"fadeUp .3s var(--ease) .8s both"}}>
              <button onClick={()=>{setShowBookComplete(false);openJournal(activeBook);}}
                className="btn btn-green" style={{width:"100%",padding:15,borderRadius:12,fontSize:13}}>
                <PenLine size={15}/> Write about it
              </button>
              <button className="btn btn-ghost" style={{width:"100%",padding:12,borderRadius:12}}
                onClick={()=>{setShowBookComplete(false);setScreen(fromScreen);fetchBooks();}}>
                Back to {fromScreen==="shelf"?"Shelf":"Library"}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ── Mini-player */}
      {showMini&&activeBook&&(
        <MiniPlayer book={activeBook} isPlaying={isPlaying} progress={progress}
          onToggle={handlePlay} onOpen={()=>{setFromScreen(screen);setScreen("player");}}/>
      )}

      {/* ── Bottom nav */}
      {showNav&&<BottomNav screen={screen} setScreen={setScreen} finishedCount={finishedCount}/>}

      {/* ════ LIBRARY ════════════════════════════════════════════════════════ */}
      {screen==="library"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"24px 16px 8px",position:"relative",zIndex:1}}>
          {/* Header */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:24}}>
            <div>
              <p className="lbl" style={{color:"var(--green)",marginBottom:6}}>your sanctuary</p>
              <h1 style={{fontSize:"clamp(1.7rem,6vw,2.4rem)",fontWeight:700,color:"var(--t1)",lineHeight:1.1}}>
                Good day, Victory
              </h1>
              <p style={{fontSize:13,color:"var(--t2)",marginTop:5,fontFamily:"Crimson Pro,Georgia,serif",fontStyle:"italic"}}>
                Victory's Book Collection
              </p>
            </div>
            <ThemeToggle theme={theme} onToggle={()=>setTheme(t=>t==="dark"?"light":"dark")}/>
          </div>

          {/* Stats bar */}
          {!loadingBooks&&books.length>0&&(
            <div style={{display:"flex",gap:8,marginBottom:20,animation:"fadeUp .4s var(--ease) .05s both"}}>
              {[
                {label:`${books.length}`,sub:"books"},
                finishedCount>0&&{label:`${finishedCount}`,sub:"finished"},
                totalHours>0&&{label:`${totalHours}h`,sub:"listened"},
              ].filter(Boolean).map((s,i)=>(
                <div key={i} style={{flex:1,background:"var(--bg3)",border:"1px solid var(--border)",
                  borderRadius:12,padding:"12px 10px",textAlign:"center"}}>
                  <p style={{fontSize:"1.3rem",fontWeight:700,color:"var(--green)",lineHeight:1}}>{s.label}</p>
                  <p style={{fontSize:10,color:"var(--t3)",fontWeight:600,letterSpacing:".07em",textTransform:"uppercase",marginTop:3}}>{s.sub}</p>
                </div>
              ))}
            </div>
          )}

          {/* Drop zone */}
          <input ref={fileInputRef} type="file" accept=".pdf" style={{display:"none"}}
            onChange={e=>handleFilePicked(e.target.files[0])}/>
          <div className={`dropzone ${dragOver?"over":""}`} style={{marginBottom:12,animation:"fadeUp .4s var(--ease) .1s both"}}
            onClick={()=>fileInputRef.current?.click()}
            onDragOver={e=>{e.preventDefault();setDragOver(true);}}
            onDragLeave={()=>setDragOver(false)}
            onDrop={e=>{e.preventDefault();setDragOver(false);handleFilePicked(e.dataTransfer.files[0]);}}>
            {isLoading&&loadingMsg.includes("Extract")?(
              <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:10}}>
                <div style={{width:22,height:22,border:"2px solid var(--green)",borderTopColor:"transparent",
                  borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                <p style={{fontSize:13,color:"var(--t2)",animation:"pulse 1.5s ease infinite"}}>{loadingMsg}</p>
              </div>
            ):(
              <>
                <div style={{width:48,height:48,borderRadius:"50%",margin:"0 auto 12px",
                  background:"var(--green-dim)",display:"flex",alignItems:"center",justifyContent:"center"}}>
                  <Upload size={22} color="var(--green)"/>
                </div>
                <p style={{fontSize:14,color:"var(--t1)",fontWeight:600,marginBottom:4}}>Add a book</p>
                <p style={{fontSize:12,color:"var(--t3)"}}>Drop a PDF here or click to browse</p>
              </>
            )}
          </div>

          {error&&(
            <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",
              borderRadius:10,padding:"10px 14px",marginBottom:12,display:"flex",gap:8,alignItems:"center"}}>
              <X size={13} color="#ef4444"/>
              <p style={{fontSize:12,color:"#ef4444",fontFamily:"Inter,system-ui,sans-serif"}}>{error}</p>
            </div>
          )}

          {/* Search */}
          {books.length>0&&(
            <div className="search-wrap" style={{marginBottom:10,animation:"fadeUp .4s var(--ease) .12s both"}}>
              <Search size={15} className="ico"/>
              <input className="inp search-inp" placeholder="Search books or authors…"
                value={searchQ} onChange={e=>setSearchQ(e.target.value)}/>
            </div>
          )}

          {/* Category chips */}
          {books.length>0&&(
            <div style={{display:"flex",gap:7,overflowX:"auto",paddingBottom:4,marginBottom:18,
              scrollbarWidth:"none",animation:"fadeUp .4s var(--ease) .14s both"}}>
              {presentCats.map(c=>(
                <button key={c} className={`chip ${filterCat===c?"on":""}`} onClick={()=>setFilterCat(c)}>
                  {c!=="All"&&<Tag size={9}/>}{c}
                </button>
              ))}
            </div>
          )}

          {/* Book list */}
          {loadingBooks?<SkeletonCards/>:filteredBooks.length===0?(
            <div style={{textAlign:"center",padding:"4rem 1rem"}}>
              <BookOpen size={40} color="var(--t3)" style={{margin:"0 auto 14px"}}/>
              <p style={{fontSize:14,color:"var(--t2)",marginBottom:4}}>
                {books.length===0?"No books yet — add your first PDF above":"No books match your search"}
              </p>
              {books.length>0&&searchQ&&(
                <button className="btn btn-ghost" onClick={()=>{setSearchQ("");setFilterCat("All");}} style={{marginTop:12}}>
                  Clear search
                </button>
              )}
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {filteredBooks.map((book,i)=>{
                const prog=book.reading_progress?.[0];
                const pct=book.chunk_count?Math.round(((prog?.current_chunk||0)/book.chunk_count)*100):0;
                const last=prog?.last_opened?new Date(prog.last_opened).toLocaleDateString("en-US",{month:"short",day:"numeric"}):null;
                const fin=book.status==="finished";
                return (
                  <div key={book.id} className="book-card fade-up" style={{animationDelay:`${i*.06}s`}}
                    onClick={()=>openBook(book)}>
                    <button className="del-btn" onClick={e=>deleteBook(e,book.id,book.file_path)}>
                      <Trash2 size={13}/>
                    </button>
                    <button className="edit-btn" onClick={e=>openEdit(e,book)}>
                      <Edit2 size={13}/>
                    </button>
                    <BookCover book={book} size="sm" onClick={()=>openBook(book)}/>
                    <div style={{flex:1,minWidth:0,paddingRight:52}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <p style={{fontWeight:600,fontSize:14,color:"var(--t1)",lineHeight:1.3}}>{book.title}</p>
                        <span style={{fontSize:12,fontWeight:700,color:fin?"var(--green)":pct>0?"var(--green)":"var(--t3)",
                          flexShrink:0,marginLeft:8}}>
                          {fin?<CheckCircle2 size={14} color="var(--green)"/>:`${pct}%`}
                        </span>
                      </div>
                      {book.author&&book.author!=="Unknown Author"&&(
                        <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                          <User size={10} color="var(--t3)"/>
                          <p style={{fontSize:12,color:"var(--t2)",fontStyle:"italic"}}>{book.author}</p>
                        </div>
                      )}
                      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                        {book.category&&book.category!=="Uncategorized"&&(
                          <span style={{background:"var(--green-dim)",borderRadius:20,padding:"2px 8px",
                            fontSize:10,fontWeight:600,color:"var(--green)",display:"flex",alignItems:"center",gap:3}}>
                            <Tag size={8}/>{book.category}
                          </span>
                        )}
                        {last&&<span style={{fontSize:10,color:"var(--t3)"}}>{last}</span>}
                        <span style={{fontSize:10,color:"var(--t3)"}}>
                          {(book.word_count||0).toLocaleString()}w
                        </span>
                      </div>
                      <div className={`prog ${fin?"":"thick"}`}>
                        <div className="prog-fill" style={{width:`${fin?100:pct}%`,transition:"none"}}/>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quote */}
          <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:16,
            padding:"20px 22px",marginTop:22,
            animation:"fadeUp .4s var(--ease) .2s both"}}>
            <p style={{fontFamily:"Crimson Pro,Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",
              color:"var(--t2)",lineHeight:1.7,marginBottom:10}}>"{quote.text}"</p>
            <p className="lbl" style={{margin:0}}>— {quote.author}</p>
          </div>
        </div>
      )}

      {/* ════ PLAYER ═════════════════════════════════════════════════════════ */}
      {screen==="player"&&activeBook&&(
        <div style={{maxWidth:480,margin:"0 auto",padding:"20px 16px",position:"relative",zIndex:1}}>
          {/* Dynamic bg */}
          <div style={{position:"fixed",inset:0,
            background:`radial-gradient(ellipse at top,rgba(29,185,84,.1) 0%,var(--bg) 65%)`,
            pointerEvents:"none",zIndex:0}}/>

          {/* ── Text / Lyrics view overlay */}
          {showTextView&&chunks.length>0&&(
            <TextViewPanel
              chunks={chunks}
              currentChunk={currentChunk}
              isPlaying={isPlaying}
              onClose={()=>setShowTextView(false)}
              onJumpTo={idx=>{playChunk(idx);}}
              book={activeBook}
              theme={theme}
            />
          )}

          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:24,position:"relative"}}>
            <button className="btn btn-icon"
              onClick={()=>{setScreen(fromScreen);fetchBooks();}}>
              <ArrowLeft size={16}/>
            </button>
            <button className="btn btn-icon"
              onClick={()=>setShowTextView(v=>!v)}
              title="Text view"
              style={{borderColor:showTextView?"var(--green)":"var(--border)",
                color:showTextView?"var(--green)":"var(--t2)"}}>
              <BookOpen size={15}/>
            </button>
          </div>

          {/* Cover art */}
          <div style={{display:"flex",justifyContent:"center",marginBottom:28,position:"relative"}}>
            <BookCover book={activeBook} size="lg" playing={isPlaying}/>
          </div>

          {/* Title + edit */}
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:6}}>
            <div style={{flex:1,minWidth:0}}>
              <h2 style={{fontSize:"1.35rem",fontWeight:700,color:"var(--t1)",lineHeight:1.3,marginBottom:4}}>
                {activeBook.title}
              </h2>
              {activeBook.author&&activeBook.author!=="Unknown Author"&&(
                <div style={{display:"flex",alignItems:"center",gap:5}}>
                  <User size={11} color="var(--t3)"/>
                  <p style={{fontSize:13,color:"var(--t2)",fontStyle:"italic"}}>{activeBook.author}</p>
                </div>
              )}
            </div>
            <button className="btn btn-icon" onClick={e=>openEdit(e,activeBook)} style={{marginLeft:10,flexShrink:0}}>
              <Edit2 size={14}/>
            </button>
          </div>

          <p style={{fontSize:11,color:"var(--t3)",fontWeight:600,letterSpacing:".06em",textTransform:"uppercase",
            marginBottom:20}}>
            Part {currentChunk+1}/{chunks.length}
            {cachedCount>0&&<span style={{color:allCached?"var(--green)":"var(--t3)",marginLeft:8}}>
              · {cachedCount}/{chunks.length} buffered
            </span>}
          </p>

          {/* Waveform */}
          <div style={{marginBottom:20}}>
            <Waveform playing={isPlaying}/>
          </div>

          {/* Overall progress */}
          <div style={{marginBottom:4}}>
            <div className="prog thick" style={{cursor:"pointer"}} onClick={e=>{
              const rect=e.currentTarget.getBoundingClientRect();
              const pct=(e.clientX-rect.left)/rect.width;
              const targetChunk=Math.floor(pct*chunks.length);
              if(targetChunk!==currentChunk) playChunk(targetChunk);
            }}>
              <div className="prog-fill" style={{width:`${progress}%`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontSize:10,color:"var(--t3)"}}>Book: {Math.round(progress)}%</span>
              <span style={{fontSize:10,color:"var(--t3)"}}>~{Math.round((100-progress)/100*(activeBook.word_count||0)/150/60*10)/10}h left</span>
            </div>
          </div>

          {/* Chunk scrubber */}
          <div style={{marginBottom:24}}>
            <div className="prog scrub" onClick={e=>{
              if(!audioRef.current||!duration) return;
              const rect=e.currentTarget.getBoundingClientRect();
              audioRef.current.currentTime=((e.clientX-rect.left)/rect.width)*duration;
            }}>
              <div className="prog-fill" style={{width:`${duration?(currentTime/duration)*100:0}%`}}/>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",marginTop:5}}>
              <span style={{fontSize:10,color:"var(--t3)"}}>{fmt(currentTime)}</span>
              <span style={{fontSize:10,color:"var(--t3)"}}>{fmt(duration)}</span>
            </div>
          </div>

          {/* Transport controls */}
          <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:24}}>
            <button className="btn btn-icon" onClick={()=>{if(currentChunk>0)playChunk(currentChunk-1);}}
              disabled={currentChunk===0}><SkipBack size={18}/></button>
            <button className="btn btn-icon" onClick={()=>handleSkip(-10)}><Rewind size={18}/></button>
            <button className="play-btn" onClick={handlePlay} disabled={isLoading}>
              {isLoading
                ?<div style={{width:22,height:22,border:"2.5px solid #000",borderTopColor:"transparent",
                    borderRadius:"50%",animation:"spin .8s linear infinite"}}/>
                :isPlaying
                  ?<Pause size={26} fill="#000"/>
                  :<Play size={26} fill="#000" style={{marginLeft:3}}/>}
            </button>
            <button className="btn btn-icon" onClick={()=>handleSkip(10)}><FastForward size={18}/></button>
            <button className="btn btn-icon" onClick={()=>{if(currentChunk<chunks.length-1)playChunk(currentChunk+1);}}
              disabled={currentChunk===chunks.length-1}><SkipForward size={18}/></button>
          </div>

          {isLoading&&loadingMsg&&(
            <p style={{fontSize:11,color:"var(--green)",textAlign:"center",marginBottom:16,
              animation:"pulse 1.5s ease infinite",fontWeight:600}}>{loadingMsg}</p>
          )}

          {/* Speed */}
          <div style={{display:"flex",alignItems:"center",gap:6,justifyContent:"center",marginBottom:20}}>
            <span style={{fontSize:10,color:"var(--t3)",fontWeight:600,letterSpacing:".06em",marginRight:4}}>SPEED</span>
            {[0.75,1,1.25,1.5,1.75,2].map(s=>(
              <button key={s} className={`spd ${speed===s?"on":""}`}
                onClick={()=>{setSpeed(s);if(audioRef.current)audioRef.current.playbackRate=s;}}>{s}×</button>
            ))}
          </div>

          {/* Voice selector */}
          <div style={{marginBottom:16,position:"relative"}} ref={voiceDropRef}>
            <label className="lbl"><Mic2 size={11} style={{display:"inline",marginRight:5}}/>Voice</label>
            <button className="btn btn-ghost" onClick={()=>setShowVoiceDrop(v=>!v)}
              style={{width:"100%",justifyContent:"space-between",padding:"11px 14px",borderRadius:10}}>
              <span>
                <span style={{fontWeight:600,color:"var(--t1)",marginRight:8}}>{voice.label}</span>
                <span style={{fontSize:11,color:"var(--t2)"}}>{voice.desc}</span>
              </span>
              {showVoiceDrop?<ChevronUp size={13}/>:<ChevronDown size={13}/>}
            </button>
            {showVoiceDrop&&(
              <div className="voice-drop">
                {VOICES.map(v=>(
                  <div key={v.id} className={`voice-opt ${voice.id===v.id?"on":""}`}
                    onClick={()=>{setVoice(v);setShowVoiceDrop(false);setIsPlaying(false);audioRef.current?.pause();}}>
                    <div style={{display:"flex",alignItems:"center",gap:10}}>
                      <div style={{width:7,height:7,borderRadius:"50%",
                        background:voice.id===v.id?"var(--green)":"var(--border)"}}/>
                      <div>
                        <p style={{fontWeight:600,fontSize:13,color:"var(--t1)",marginBottom:1}}>{v.label}</p>
                        <p style={{fontSize:10,color:"var(--t3)"}}>{v.desc} · {v.lang}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          {showRegenConfirm&&(
            <div style={{background:"var(--bg3)",border:"1px solid var(--border)",borderRadius:12,
              padding:14,marginBottom:12}}>
              <p style={{fontSize:12,color:"var(--t2)",marginBottom:12}}>
                Regenerate all audio as {voice.label}? This replaces cached audio.
              </p>
              <div style={{display:"flex",gap:8}}>
                <button className="btn btn-ghost" onClick={()=>setShowRegenConfirm(false)} style={{flex:1,padding:"9px 0"}}>Cancel</button>
                <button className="btn btn-danger" onClick={()=>handlePregenerate(true)} style={{flex:1,padding:"9px 0"}}>Regenerate</button>
              </div>
            </div>
          )}

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:10}}>
            <button className="btn btn-ghost" onClick={()=>handlePregenerate(false)}
              disabled={!!pregenProgress||allCached} style={{fontSize:11,padding:"10px 0"}}>
              {pregenProgress
                ?<><div style={{width:11,height:11,border:"1.5px solid var(--green)",borderTopColor:"transparent",
                    borderRadius:"50%",animation:"spin .8s linear infinite"}}/> {pregenProgress.done}/{pregenProgress.total}</>
                :allCached?<><CheckCircle2 size={12} color="var(--green)"/> All buffered</>
                :<><Zap size={12}/> Pre-buffer all</>}
            </button>
            <button className="btn btn-ghost" onClick={()=>setShowRegenConfirm(true)}
              disabled={!!pregenProgress} style={{fontSize:11,padding:"10px 0"}}>
              <RefreshCw size={12}/> Regen voice
            </button>
            <button className="btn btn-ghost" onClick={handleDownload}
              disabled={isLoading||cachedCount===0} style={{gridColumn:"1/-1",fontSize:11,padding:"10px 0"}}>
              <Download size={12}/> Download full MP3
            </button>
          </div>

          {error&&(
            <div style={{background:"rgba(239,68,68,.07)",border:"1px solid rgba(239,68,68,.2)",
              borderRadius:10,padding:"10px 14px",display:"flex",gap:8,alignItems:"center",marginBottom:10}}>
              <X size={13} color="#ef4444"/>
              <p style={{fontSize:12,color:"#ef4444"}}>{error}</p>
            </div>
          )}
        </div>
      )}

      {/* ════ SHELF ══════════════════════════════════════════════════════════ */}
      {screen==="shelf"&&(
        <div style={{maxWidth:580,margin:"0 auto",padding:"24px 16px 8px",position:"relative",zIndex:1}}>
          <div style={{marginBottom:20}}>
            <p className="lbl" style={{color:"var(--green)"}}>finished books</p>
            <h2 style={{fontSize:"clamp(1.4rem,5vw,2rem)",fontWeight:700,color:"var(--t1)"}}>Your Shelf</h2>
            {finishedCount>0&&<p style={{fontSize:12,color:"var(--t3)",marginTop:5}}>
              {finishedCount} book{finishedCount===1?"":"s"} · ~{totalHours}h total
            </p>}
          </div>

          {finishedCount>0&&(
            <div style={{display:"flex",gap:7,marginBottom:20,flexWrap:"wrap"}}>
              {[{id:"date",l:"Recent"},{id:"rating",l:"Top rated"},{id:"author",l:"Author"},{id:"category",l:"Category"}].map(s=>(
                <button key={s.id} className={`chip ${shelfSort===s.id?"on":""}`} onClick={()=>setShelfSort(s.id)}>{s.l}</button>
              ))}
            </div>
          )}

          {finishedCount===0?(
            <div style={{textAlign:"center",padding:"5rem 1rem"}}>
              <Archive size={44} color="var(--t3)" style={{margin:"0 auto 16px"}}/>
              <p style={{fontSize:14,color:"var(--t2)",marginBottom:4}}>Your shelf is empty</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Finish a book to see it here</p>
            </div>
          ):(
            <div style={{display:"flex",flexDirection:"column",gap:10}}>
              {sortedShelf.map((book,i)=>{
                const j=journals[book.id];
                const sel=selectedShelfBook?.id===book.id;
                const finDate=book.finished_at?new Date(book.finished_at).toLocaleDateString("en-US",{month:"short",day:"numeric",year:"numeric"}):null;
                return (
                  <div key={book.id} className="fade-up" style={{animationDelay:`${i*.05}s`,
                    background:"var(--bg3)",border:`1px solid ${sel?"var(--green)":"var(--border)"}`,
                    borderRadius:16,overflow:"hidden",
                    transition:"border-color .2s,box-shadow .2s",
                    boxShadow:sel?"0 0 0 3px var(--green-dim)":"none"}}>
                    <div style={{display:"flex",gap:14,padding:14,cursor:"pointer",alignItems:"flex-start"}}
                      onClick={()=>setSelectedShelfBook(sel?null:book)}>
                      <BookCover book={book} size="sm"/>
                      <div style={{flex:1,minWidth:0}}>
                        <p style={{fontWeight:600,fontSize:14,color:"var(--t1)",lineHeight:1.3,marginBottom:4}}>{book.title}</p>
                        {book.author&&book.author!=="Unknown Author"&&(
                          <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:6}}>
                            <User size={10} color="var(--t3)"/>
                            <p style={{fontSize:12,color:"var(--t2)",fontStyle:"italic"}}>{book.author}</p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:6,flexWrap:"wrap",marginBottom:8}}>
                          {book.category&&book.category!=="Uncategorized"&&(
                            <span style={{background:"var(--green-dim)",borderRadius:20,padding:"2px 8px",
                              fontSize:10,fontWeight:600,color:"var(--green)",display:"flex",alignItems:"center",gap:3}}>
                              <Tag size={8}/>{book.category}
                            </span>
                          )}
                          {finDate&&<span style={{fontSize:10,color:"var(--t3)"}}>{finDate}</span>}
                        </div>
                        {j?.rating>0?<StarRow value={j.rating} readonly/>
                          :<p style={{fontSize:10,color:"var(--t3)"}}>No rating yet</p>}
                      </div>
                      <div style={{color:"var(--t3)",flexShrink:0,marginTop:4}}>
                        {sel?<ChevronUp size={14}/>:<ChevronDown size={14}/>}
                      </div>
                    </div>
                    {sel&&(
                      <div style={{borderTop:"1px solid var(--border)",padding:14,
                        animation:"slideDown .18s var(--sp)"}}>
                        {j&&(j.learned||j.takeaways)&&(
                          <div style={{background:"var(--bg3)",borderLeft:"2px solid var(--green)",
                            borderRadius:"0 8px 8px 0",padding:"10px 12px",marginBottom:12}}>
                            <p style={{fontFamily:"Crimson Pro,Georgia,serif",fontSize:13,color:"var(--t2)",
                              fontStyle:"italic",lineHeight:1.6}}>
                              "{(j.learned||j.takeaways).substring(0,140)}{(j.learned||j.takeaways).length>140?"…":""}"
                            </p>
                          </div>
                        )}
                        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                          <button onClick={()=>openBook(book)} className="btn btn-ghost" style={{flex:1,minWidth:90,padding:"9px 0",fontSize:11}}>
                            <Play size={12}/> Listen
                          </button>
                          <button onClick={()=>openJournal(book)} className="btn btn-ghost" style={{flex:1,minWidth:90,padding:"9px 0",fontSize:11}}>
                            <PenLine size={12}/> {j?"Journal":"Write"}
                          </button>
                          <button onClick={()=>{if(confirm("Restart this book?"))repeatBook(book);}}
                            className="btn btn-ghost" style={{flex:1,minWidth:90,padding:"9px 0",fontSize:11}}>
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

      {/* ════ JOURNAL ════════════════════════════════════════════════════════ */}
      {screen==="journal"&&journalBook&&(
        <div style={{maxWidth:560,margin:"0 auto",padding:"20px 16px",position:"relative",zIndex:1}}>
          <button className="btn btn-icon" onClick={()=>setScreen(fromScreen)} style={{marginBottom:22}}>
            <ArrowLeft size={16}/>
          </button>
          <div style={{display:"flex",gap:14,alignItems:"flex-start",marginBottom:24}}>
            <BookCover book={journalBook} size="md"/>
            <div>
              <p className="lbl" style={{color:"var(--green)"}}>book journal</p>
              <h2 style={{fontSize:"1.2rem",fontWeight:700,color:"var(--t1)",lineHeight:1.3,marginBottom:5}}>{journalBook.title}</h2>
              {journalBook.author&&journalBook.author!=="Unknown Author"&&(
                <p style={{fontSize:12,color:"var(--t2)",fontStyle:"italic",marginBottom:12}}>{journalBook.author}</p>
              )}
              <StarRow value={journalForm.rating} onChange={r=>setJournalForm(p=>({...p,rating:r}))}/>
            </div>
          </div>
          <div style={{display:"flex",flexDirection:"column",gap:20}}>
            {[
              {key:"learned",Icon:Lightbulb,title:"What I learned",hint:"New ideas and perspectives"},
              {key:"takeaways",Icon:Star,title:"Key takeaways",hint:"Quotes and moments to remember"},
              {key:"actions",Icon:Rocket,title:"Action steps",hint:"What will you actually do differently?"},
            ].map(({key,Icon,title,hint})=>(
              <div key={key}>
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <div style={{width:34,height:34,borderRadius:10,background:"var(--green-dim)",
                    display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                    <Icon size={16} color="var(--green)"/>
                  </div>
                  <div>
                    <p style={{fontWeight:600,fontSize:13,color:"var(--t1)",marginBottom:2}}>{title}</p>
                    <p style={{fontSize:11,color:"var(--t3)"}}>{hint}</p>
                  </div>
                </div>
                <textarea className="inp ta" rows={4} value={journalForm[key]}
                  onChange={e=>setJournalForm(p=>({...p,[key]:e.target.value}))}
                  placeholder={key==="learned"?"What shifted in your thinking…":
                    key==="takeaways"?"• Notable passages\n• Key concepts…":
                    "1. Start doing…\n2. Stop doing…"}/>
              </div>
            ))}
          </div>
          <button onClick={saveJournal} disabled={savingJournal}
            className="btn btn-green" style={{width:"100%",marginTop:24,padding:14,borderRadius:12,fontSize:13}}>
            {savingJournal?<><div style={{width:13,height:13,border:"2px solid #000",borderTopColor:"transparent",
              borderRadius:"50%",animation:"spin .8s linear infinite"}}/> Saving…</>
            :<><CheckCircle2 size={14}/> Save journal</>}
          </button>
        </div>
      )}

      {/* ════ GOALS ══════════════════════════════════════════════════════════ */}
      {screen==="goals"&&(
        <div style={{maxWidth:560,margin:"0 auto",padding:"24px 16px 8px",position:"relative",zIndex:1}}>
          <p className="lbl" style={{color:"var(--green)"}}>reading goals</p>
          <h2 style={{fontSize:"clamp(1.4rem,5vw,2rem)",fontWeight:700,color:"var(--t1)",marginBottom:24}}>{thisYear} Goal</h2>

          {/* Ring card */}
          <div className="card" style={{display:"flex",flexDirection:"column",alignItems:"center",
            marginBottom:12,padding:"2.5rem",animation:"fadeUp .4s var(--ease) both"}}>
            <div style={{position:"relative",marginBottom:20}}>
              <CircleRing value={booksThisYear.length} max={GOAL}/>
              <div style={{position:"absolute",inset:0,display:"flex",flexDirection:"column",
                alignItems:"center",justifyContent:"center"}}>
                <p style={{fontSize:"2.8rem",fontWeight:700,color:"var(--green)",lineHeight:1}}>
                  {booksThisYear.length}
                </p>
                <p style={{fontSize:11,color:"var(--t3)",fontWeight:600}}>of {GOAL}</p>
              </div>
            </div>
            <p style={{fontFamily:"Crimson Pro,Georgia,serif",fontSize:"1.05rem",color:"var(--t2)",
              fontStyle:"italic",textAlign:"center",marginBottom:6}}>
              {booksThisYear.length===0?"Start your journey, Victory":
                booksThisYear.length<6?"You're building momentum!":
                booksThisYear.length<12?`${GOAL-booksThisYear.length} more to go — keep going!`:
                "Goal achieved! You're unstoppable"}
            </p>
            <p style={{fontSize:12,color:"var(--t3)",fontWeight:600}}>{Math.round(booksThisYear.length/GOAL*100)}% complete</p>

            {/* Milestones */}
            <div style={{display:"flex",gap:16,marginTop:24,justifyContent:"center"}}>
              {[{n:3,Icon:TrendingUp,l:"Spark"},{n:6,Icon:Star,l:"Halfway"},{n:9,Icon:BarChart2,l:"Almost"},{n:12,Icon:Trophy,l:"Legend"}].map(m=>{
                const done=booksThisYear.length>=m.n;
                return (
                  <div key={m.n} style={{textAlign:"center",opacity:done?1:.25,
                    filter:done?"none":"grayscale(1)",transition:"opacity .5s,filter .5s"}}>
                    <div style={{width:44,height:44,borderRadius:12,margin:"0 auto 6px",
                      background:done?"var(--green)":"var(--bg3)",
                      display:"flex",alignItems:"center",justifyContent:"center",
                      boxShadow:done?"0 4px 20px var(--green-glow)":"none",transition:"all .5s"}}>
                      <m.Icon size={20} color={done?"#000":"var(--t3)"}/>
                    </div>
                    <p style={{fontSize:9,color:done?"var(--green)":"var(--t3)",fontWeight:700,
                      textTransform:"uppercase",letterSpacing:".06em"}}>{m.l}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly bars */}
          <div className="card" style={{marginBottom:12}}>
            <p className="lbl" style={{marginBottom:16}}>Monthly breakdown</p>
            <div style={{display:"flex",gap:5,alignItems:"flex-end",height:80}}>
              {monthBreak.map((m,i)=>{
                const past=i<=new Date().getMonth();
                const h=m.count>0?Math.max(18,(m.count/maxMo)*68):past?4:2;
                return (
                  <div key={m.label} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:5}}>
                    <div style={{width:"100%",height:h,borderRadius:4,
                      background:m.count>0?"var(--green)":past?"var(--bg3h)":"var(--bg3)",
                      transition:"height .8s var(--sp)",minHeight:2}}/>
                    <p style={{fontSize:7,fontWeight:600,color:m.count>0?"var(--green)":past?"var(--t3)":"var(--bg3h)",
                      textTransform:"uppercase",letterSpacing:".04em"}}>{m.label}</p>
                    {m.count>0&&<p style={{fontSize:8,color:"var(--green)",fontWeight:700}}>{m.count}</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Stats grid */}
          {finishedCount>0&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              {[
                {Icon:BookOpen,label:"All-time books",value:finishedCount},
                {Icon:Clock,label:"Hours listened",value:`${totalHours}h`},
                {Icon:TrendingUp,label:"Per month avg",value:(finishedCount/Math.max(1,new Date().getMonth()+1)).toFixed(1)},
                {Icon:Trophy,label:"This year",value:booksThisYear.length},
              ].map((s,i)=>(
                <div key={i} className="card" style={{textAlign:"center",padding:"18px 14px",
                  animation:`fadeUp .4s var(--ease) ${i*.07}s both`}}>
                  <s.Icon size={17} color="var(--green)" style={{margin:"0 auto 8px"}}/>
                  <p style={{fontSize:"2rem",fontWeight:700,color:"var(--green)",lineHeight:1,marginBottom:5}}>{s.value}</p>
                  <p style={{fontSize:9,color:"var(--t3)",fontWeight:600,textTransform:"uppercase",letterSpacing:".07em"}}>{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ════ WRAPPED ════════════════════════════════════════════════════════ */}
      {screen==="wrapped"&&(
        <div style={{maxWidth:560,margin:"0 auto",padding:"24px 16px 8px",position:"relative",zIndex:1}}>
          <p className="lbl" style={{color:"var(--green)"}}>analytics</p>
          <h2 style={{fontSize:"clamp(1.4rem,5vw,2rem)",fontWeight:700,color:"var(--t1)",marginBottom:16}}>
            Victory Wrapped
          </h2>

          {/* Period */}
          <div style={{display:"flex",gap:7,marginBottom:22}}>
            {["week","month","quarter","year"].map(p=>(
              <button key={p} className={`chip ${wrappedPeriod===p?"on":""}`}
                onClick={()=>setWrappedPeriod(p)} style={{flex:1,justifyContent:"center",textTransform:"capitalize"}}>
                {p}
              </button>
            ))}
          </div>

          {periodBooks.length===0?(
            <div style={{textAlign:"center",padding:"4rem 1rem"}}>
              <BarChart2 size={44} color="var(--t3)" style={{margin:"0 auto 16px"}}/>
              <p style={{fontSize:14,color:"var(--t2)",marginBottom:4}}>No data for this period</p>
              <p style={{fontSize:12,color:"var(--t3)"}}>Finish books to see your stats</p>
            </div>
          ):(
            <>
              {[
                {bg:"linear-gradient(135deg,#0a1f0a,#0d3320)",Icon:BookOpen,label:"Books read",value:periodBooks.length,sub:"in this period"},
                {bg:"linear-gradient(135deg,#0a0f1f,#0d1a40)",Icon:Clock,label:"Hours absorbed",value:periodHours,sub:"hours of knowledge"},
                topCats.length>0&&{bg:"linear-gradient(135deg,#1a0a1f,#2a0a40)",Icon:Tag,label:"Top category",value:topCats[0][0],sub:`${topCats[0][1]} books`},
                topAuthors.length>0&&{bg:"linear-gradient(135deg,#1a1a0a,#2a2a00)",Icon:User,label:"Fav author",value:topAuthors[0][0],sub:`${topAuthors[0][1]} books`},
              ].filter(Boolean).map((card,i)=>(
                <div key={i} className="wrapped-hero fade-up" style={{background:card.bg,animationDelay:`${i*.07}s`}}>
                  <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:10}}>
                    <card.Icon size={13} color="var(--green)"/>
                    <p className="lbl" style={{margin:0,color:"var(--green)"}}>{card.label}</p>
                  </div>
                  <p style={{fontSize:"2.8rem",fontWeight:700,color:"var(--t1)",lineHeight:1.1,marginBottom:8}}>
                    {card.value}
                  </p>
                  <p style={{fontSize:12,color:"var(--t2)"}}>{card.sub}</p>
                </div>
              ))}

              {topCats.length>1&&(
                <div className="card" style={{marginBottom:12}}>
                  <p className="lbl" style={{marginBottom:14}}><Tag size={11} style={{display:"inline",marginRight:5}}/>Categories</p>
                  {topCats.map(([cat,cnt])=>(
                    <div key={cat} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:14,color:"var(--t1)",fontFamily:"Crimson Pro,Georgia,serif"}}>{cat}</span>
                        <span style={{fontSize:11,color:"var(--green)",fontWeight:700}}>{cnt}</span>
                      </div>
                      <div className="prog"><div className="prog-fill" style={{width:`${(cnt/topCats[0][1])*100}%`}}/></div>
                    </div>
                  ))}
                </div>
              )}

              {topAuthors.length>1&&(
                <div className="card" style={{marginBottom:12}}>
                  <p className="lbl" style={{marginBottom:14}}><User size={11} style={{display:"inline",marginRight:5}}/>Authors</p>
                  {topAuthors.map(([auth,cnt])=>(
                    <div key={auth} style={{marginBottom:12}}>
                      <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}>
                        <span style={{fontSize:14,color:"var(--t1)",fontFamily:"Crimson Pro,Georgia,serif"}}>{auth}</span>
                        <span style={{fontSize:11,color:"var(--green)",fontWeight:700}}>{cnt}</span>
                      </div>
                      <div className="prog"><div className="prog-fill" style={{width:`${(cnt/topAuthors[0][1])*100}%`}}/></div>
                    </div>
                  ))}
                </div>
              )}

              <div className="card">
                <p className="lbl" style={{marginBottom:14}}><BookOpen size={11} style={{display:"inline",marginRight:5}}/>Finished this {wrappedPeriod}</p>
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
