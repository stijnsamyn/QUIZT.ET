/* ============================================================
   QUIZT.ET — frontend (vanilla JS + Supabase)
   ============================================================ */
"use strict";

/* ============================================================
   TEKST-OPMAAK — floating toolbar boven elke gefocuste <textarea>
   Formatteringen zijn identiek aan wat formatCommentBody() rendert:
   **vet**, *cursief*, `code`, "- " bullets, "1. " genummerd,
   \n voor volgende lijn, \n\n voor nieuwe paragraaf.
   Textareas met data-no-format="1" krijgen de toolbar niet.
   ============================================================ */
function fmtApply(ta, action){
  if(!ta || ta.tagName!=="TEXTAREA") return;
  const start=ta.selectionStart, end=ta.selectionEnd;
  const v=ta.value;
  const sel=v.slice(start,end);
  const before=v.slice(0,start), after=v.slice(end);
  const wrap=(l,r,ph)=>{
    const inside = sel || ph;
    const out = before + l + inside + r + after;
    ta.value=out; ta.focus();
    const p = sel ? start+l.length+inside.length+r.length : start+l.length+ph.length+r.length;
    const s = sel ? p : start+l.length;
    ta.setSelectionRange(sel?p:s, p);
    ta.dispatchEvent(new Event("input",{bubbles:true}));
  };
  const linePrefix=(prefixFn)=>{
    // Vind begin van huidige regel; als er selectie is, doe elke regel apart.
    const lineStart = before.lastIndexOf("\n")+1;
    const block = v.slice(lineStart, end);
    const lines = block.split("\n");
    let n=1;
    const transformed = lines.map((ln,i)=>{
      const p = prefixFn(n, ln); if(!ln.trim()) return ln;
      n++;
      // vermijd dubbele prefixen
      const cleaned = ln.replace(/^(\s*(?:[-*]\s+|\d+\.\s+))+/,"");
      return p + cleaned;
    }).join("\n");
    const out = v.slice(0,lineStart) + transformed + after;
    ta.value=out; ta.focus();
    const p = lineStart + transformed.length;
    ta.setSelectionRange(lineStart, p);
    ta.dispatchEvent(new Event("input",{bubbles:true}));
  };
  switch(action){
    case "bold":   wrap("**","**","vet");      break;
    case "italic": wrap("*","*","cursief");    break;
    case "code":   wrap("`","`","code");       break;
    case "bullet": linePrefix(()=> "- ");      break;
    case "number": linePrefix((n)=> n+". ");   break;
    case "br":     {
      const out = before + "  \n" + after;    // dubbele spatie + newline = harde regel
      ta.value=out; ta.focus();
      const p = start+3;
      ta.setSelectionRange(p,p);
      ta.dispatchEvent(new Event("input",{bubbles:true}));
      break;
    }
    case "para":   {
      const out = before + "\n\n" + after;
      ta.value=out; ta.focus();
      const p = start+2;
      ta.setSelectionRange(p,p);
      ta.dispatchEvent(new Event("input",{bubbles:true}));
      break;
    }
  }
}
let _fmtBar=null, _fmtTa=null, _fmtHideT=null;
function fmtEnsureBar(){
  if(_fmtBar) return _fmtBar;
  _fmtBar = document.createElement("div");
  _fmtBar.className="fmt-toolbar"; _fmtBar.hidden=true;
  _fmtBar.innerHTML=`
    <button type="button" data-fmt="bold"   title="Vet (Ctrl+B)"><b>B</b></button>
    <button type="button" data-fmt="italic" title="Cursief (Ctrl+I)"><i>I</i></button>
    <button type="button" data-fmt="code"   title="Code"><code>&lt;/&gt;</code></button>
    <span class="fmt-sep"></span>
    <button type="button" data-fmt="bullet" title="Opsomming">• Lijst</button>
    <button type="button" data-fmt="number" title="Genummerde lijst">1. Nr</button>
    <span class="fmt-sep"></span>
    <button type="button" data-fmt="br"     title="Nieuwe regel">↵</button>
    <button type="button" data-fmt="para"   title="Nieuwe paragraaf">¶</button>
    <span class="fmt-sep"></span>
    <button type="button" data-fmt-close title="Sluit (Esc)">×</button>`;
  document.body.appendChild(_fmtBar);
  // Voorkom dat een klik in de toolbar de focus van de textarea steelt
  _fmtBar.addEventListener("mousedown", e=>e.preventDefault());
  _fmtBar.addEventListener("click", e=>{
    if(e.target.closest("[data-fmt-close]")){ fmtHideNow(); return; }
    const btn = e.target.closest("[data-fmt]");
    if(!btn || !_fmtTa) return;
    fmtApply(_fmtTa, btn.dataset.fmt);
  });
  return _fmtBar;
}
function fmtPositionBar(ta){
  const bar = fmtEnsureBar();
  const r = ta.getBoundingClientRect();
  const barW = bar.offsetWidth  || 48;
  const barH = bar.offsetHeight || 220;
  const gap = 6;
  const spaceRight = window.innerWidth - r.right;
  const spaceLeft  = r.left;
  let left;
  if(spaceRight >= barW + gap + 4){
    left = window.scrollX + r.right + gap;
  } else if(spaceLeft >= barW + gap + 4){
    left = window.scrollX + r.left - barW - gap;
  } else {
    // Val terug op bovenaan als er geen ruimte is aan beide kanten
    left = window.scrollX + Math.max(4, r.right - barW);
  }
  // Verticaal: probeer bar bovenaan de textarea uit te lijnen, maar houd hem in het viewport
  let top = window.scrollY + Math.max(r.top, 8);
  const maxTop = window.scrollY + window.innerHeight - barH - 8;
  if(top > maxTop) top = maxTop;
  bar.style.left = left + "px";
  bar.style.top  = top + "px";
}
function fmtHideNow(){
  if(_fmtBar) _fmtBar.hidden=true;
  _fmtTa=null;
  clearTimeout(_fmtHideT);
}
function fmtShowFor(ta){
  if(ta.dataset.noFormat==="1" || ta.readOnly || ta.disabled) return;
  clearTimeout(_fmtHideT);
  _fmtTa = ta;
  const bar = fmtEnsureBar();
  bar.hidden = false;
  fmtPositionBar(ta);
}
function fmtScheduleHide(){
  clearTimeout(_fmtHideT);
  _fmtHideT = setTimeout(()=>{ if(_fmtBar){ _fmtBar.hidden=true; _fmtTa=null; } }, 180);
}
document.addEventListener("focusin", e=>{
  if(e.target && e.target.tagName==="TEXTAREA") fmtShowFor(e.target);
  else if(_fmtBar && !_fmtBar.hidden && (!_fmtTa || !document.body.contains(_fmtTa))) fmtHideNow();
});
document.addEventListener("focusout", e=>{
  if(e.target && e.target.tagName==="TEXTAREA") fmtScheduleHide();
});
// Klik buiten toolbar én buiten de gefocuste textarea → onmiddellijk verbergen
document.addEventListener("mousedown", e=>{
  if(!_fmtBar || _fmtBar.hidden) return;
  const t = e.target;
  if(_fmtBar.contains(t)) return;
  if(_fmtTa && (t===_fmtTa || (t.contains && t.contains(_fmtTa)))) return;
  fmtHideNow();
}, true);
// Verberg bij navigatie of route-wissel
window.addEventListener("hashchange", fmtHideNow);
window.addEventListener("scroll", ()=>{
  if(!_fmtTa || !_fmtBar || _fmtBar.hidden) return;
  if(!document.body.contains(_fmtTa)) return fmtHideNow();
  fmtPositionBar(_fmtTa);
}, {passive:true});
window.addEventListener("resize", ()=>{
  if(!_fmtTa || !_fmtBar || _fmtBar.hidden) return;
  if(!document.body.contains(_fmtTa)) return fmtHideNow();
  fmtPositionBar(_fmtTa);
});
document.addEventListener("keydown", e=>{
  if(e.key==="Escape" && _fmtBar && !_fmtBar.hidden){ fmtHideNow(); return; }
  if(!e.target || e.target.tagName!=="TEXTAREA") return;
  if(!(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if(k==="b"){ e.preventDefault(); fmtApply(e.target,"bold"); }
  else if(k==="i"){ e.preventDefault(); fmtApply(e.target,"italic"); }
  else if(k==="k"){ e.preventDefault(); fmtApply(e.target,"code"); }
});

/* Auto-grow voor textareas in de vraag-editor — fallback wanneer field-sizing niet werkt.
   Draait alleen wanneer het CSS-recept 'field-sizing:content' NIET ondersteund wordt. */
const _supportsFieldSizing = (()=>{ try{ return CSS && CSS.supports && CSS.supports("field-sizing: content"); }catch(_){ return false; } })();
function autoGrowTextarea(ta){
  if(_supportsFieldSizing) return;
  if(!ta || ta.tagName!=="TEXTAREA") return;
  ta.style.height = "auto";
  ta.style.height = (ta.scrollHeight + 2) + "px";
}
function bindAutoGrow(root){
  if(_supportsFieldSizing) return;
  const tas = (root||document).querySelectorAll(".qe-card textarea");
  tas.forEach(ta=>{
    if(ta.__autoGrowBound) return;
    ta.__autoGrowBound = true;
    ta.addEventListener("input", ()=>autoGrowTextarea(ta));
    // Initial sizing na een frame (zodat er content en juiste width is)
    requestAnimationFrame(()=>autoGrowTextarea(ta));
  });
}
document.addEventListener("input", e=>{
  if(_supportsFieldSizing) return;
  const t = e.target;
  if(t && t.tagName==="TEXTAREA" && t.closest && t.closest(".qe-card")) autoGrowTextarea(t);
});
// Wanneer een editor-card wordt gerenderd, bind alle textareas erin.
// We voegen dit toe aan wireQuestionEditor door bindAutoGrow op de card aan te roepen (zie hieronder).

/* ---------- Supabase client ---------- */
const CFG = window.CONFIG || {};
const configOk = CFG.SUPABASE_URL && !CFG.SUPABASE_URL.startsWith("VUL_") &&
                 CFG.SUPABASE_ANON_KEY && !CFG.SUPABASE_ANON_KEY.startsWith("VUL_");
const sb = configOk ? window.supabase.createClient(CFG.SUPABASE_URL, CFG.SUPABASE_ANON_KEY) : null;

/* ---------- State ---------- */
let ME = null;            // profiel {id, display_name, role}
let EDIT_FOCUS = null;    // {id, quiz} — vraag om naar te scrollen in de editor
let NOTIFY_COUNT = 0;     // nieuwe reacties bij vragen waar jij op reageerde
const app = document.getElementById("app");

/* ---------- Line-icons (subtiel, currentColor) ---------- */
const ICON = {
  person: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="3.5"/><path d="M5 20v-1a5 5 0 0 1 5-5h4a5 5 0 0 1 5 5v1"/></svg>`,
  robot: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><rect x="4.5" y="9" width="15" height="10" rx="2.5"/><path d="M12 9V5.5"/><circle cx="12" cy="4.2" r="1.1"/><path d="M9.5 13.5v1.5M14.5 13.5v1.5"/></svg>`,
  flag: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M6 21V4M6 4h11l-2.2 3.2L17 11H6"/></svg>`,
  chat: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 15a3 3 0 0 1-3 3H8l-4 3V6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3z"/></svg>`,
  clock: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>`,
  check: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`,
  info: `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5"/><circle cx="12" cy="7.7" r="0.6" fill="currentColor"/></svg>`,
};
// info-icoon met hover-tooltip
function infoTip(text){ return `<span class="infotip" tabindex="0" data-tip="${esc(text)}">${ICON.info}</span>`; }
// tags/badges voor een vraag
function questionTags(q){
  const t=[];
  if(q.validated===false) t.push(`<span class="tag tag-warn">Niet gevalideerd ${infoTip("Er is nog geen officieel juist antwoord. Kies via de opmerkingen wat volgens jou het juiste antwoord is, en gebruik de flags om erover in overleg te gaan.")}</span>`);
  else t.push(`<span class="tag tag-ok">Gevalideerd ${infoTip("Het juiste antwoord is nagekeken en bevestigd door een beheerder.")}</span>`);
  if(q.question_type==="matrix") t.push(`<span class="tag">Matrix ${infoTip("Kies per rij één antwoord in de bijhorende kolom.")}</span>`);
  else if(q.question_type==="open") t.push(`<span class="tag">Open vraag ${infoTip("Typ je antwoord in vrije tekst. Als er een modelantwoord is en jouw tekst komt exact overeen, wordt de vraag als juist geteld; anders komt hij als 'in overleg' binnen.")}</span>`);
  else if(q.multi || arr(q.correct_indexes).length>1) t.push(`<span class="tag">Meerkeuze ${infoTip("Er kunnen meerdere antwoorden juist zijn — kruis alle juiste aan.")}</span>`);
  if(q._show_docent && arr(q.docent_indexes).length && !setEq(q.docent_indexes, q.correct_indexes)) t.push(`<span class="tag tag-doc">👨‍🏫 Docent wijkt af ${infoTip("De docent koos een ander antwoord dan het wettelijk juiste. Beide worden getoond na je antwoord.")}</span>`);
  return t.join(" ");
}
// Normaliseer open antwoord voor vergelijking: trim, collapse whitespace, lowercase.
// Diacritics blijven staan — bewust: "artikel 34" ≠ "artkel 34" mag niet gelijk zijn.
function normalizeOpenText(s){ return String(s||"").toLowerCase().replace(/\s+/g," ").trim(); }
function isRight(q, chosen){
  const type=q&&q.question_type||"mcq";
  if(type==="matrix"){
    if(q.validated===false) return null;
    const rows=arr(q.matrix_rows), correct=arr(q.matrix_correct);
    if(!rows.length || !Array.isArray(chosen)) return null;
    // Als er geen enkele juiste kolom aangeduid is, kunnen we niet scoren
    if(!correct.some(c=>c>=0)) return null;
    // Elke rij die een juist antwoord heeft, moet overeenkomen
    for(let i=0;i<rows.length;i++){
      if(correct[i]==null || correct[i]<0) continue;   // rij zonder juist antwoord telt niet mee
      if(chosen[i]!==correct[i]) return false;
    }
    return true;
  }
  if(type==="open"){
    if(q.validated===false) return null;
    const model=String(q.open_answer||"").trim();
    const given=typeof chosen==="string" ? chosen : (chosen&&chosen.text)||"";
    if(!model || !given.trim()) return null;   // geen automatische score mogelijk
    return normalizeOpenText(model)===normalizeOpenText(given) ? true : null;
  }
  return q.validated===false ? null : setEq(chosen, q.correct_indexes);
}
function srcBadge(kind, src){
  const t = src === "ai" ? "Door AI bepaald" : "Door een mens bepaald";
  return `<span class="src ${src}" title="${kind}: ${t}">${src==="ai"?ICON.robot:ICON.person}</span>`;
}

/* ---------- Helpers ---------- */
const esc = s => (s==null?"":String(s)).replace(/[&<>"']/g, c => (
  {"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[c]));
const letter = i => String.fromCharCode(65 + i);
// Vertrouwde, door beheerders ingevoerde inhoud (uitleg, wettelijke basis, wettekst) mag als HTML.
const html = s => (s==null?"":String(s));
function fmtDate(d){ const x=new Date(d); return x.toLocaleDateString("nl-BE",{day:"numeric",month:"short",year:"numeric"})+" "+x.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"}); }
function toast(msg, kind){ const t=document.getElementById("toast"); t.className="toast "+(kind||""); t.textContent=msg; t.hidden=false; clearTimeout(t._t); t._t=setTimeout(()=>t.hidden=true, 3200); }
function go(hash){ if(location.hash===hash) route(); else location.hash=hash; }
const isEditor = () => ME && (ME.role==="beheerder"||ME.role==="admin");
const isAdmin  = () => ME && ME.role==="admin";
function pct(n,d){ return d? Math.round(n/d*100):0; }
const arr = v => Array.isArray(v)?v:(v==null?[]:[v]);
const setEq = (a,b)=>{ a=arr(a); b=arr(b); if(a.length!==b.length) return false; const s=new Set(a); return b.every(x=>s.has(x)); };
const inSet = (a,i)=>arr(a).includes(i);
const lettersOf = idxs => arr(idxs).slice().sort((x,y)=>x-y).map(letter).join(", ")||"—";
// In een lopende sessie zit de gebruiker naar een geschudde optie-volgorde te kijken.
// Deze helpers vertalen originele DB-indexen naar de LETTERS die de gebruiker ZELF ziet,
// zodat vote-bars, flag-pills en het reactie-formulier consistent blijven met de opties bovenaan.
function displayOrder(qid){ return (PLAY.optOrder && PLAY.optOrder[qid]) || null; }
function letterForOrig(qid, origIdx){
  const ord=displayOrder(qid);
  if(!ord) return letter(origIdx);
  const pos=ord.indexOf(origIdx);
  return pos>=0 ? letter(pos) : letter(origIdx);
}
function lettersOfForQ(qid, idxs){
  const ord=displayOrder(qid);
  const list=arr(idxs);
  if(!list.length) return "—";
  if(!ord) return list.slice().sort((a,b)=>a-b).map(letter).join(", ");
  return list.map(i=>({i, pos:ord.indexOf(i)}))
    .sort((a,b)=> (a.pos>=0?a.pos:999) - (b.pos>=0?b.pos:999))
    .map(x=>letter(x.pos>=0?x.pos:x.i)).join(", ");
}
// Minimale markdown-achtige opmaak voor commentaarvelden:
//   **vet**  → <strong>vet</strong>
//   *cursief* → <em>cursief</em>
//   `code` → <code>code</code>
//   Regels beginnend met "- " of "* " → bullet-lijst
//   Lege regel → nieuwe paragraaf; enkele newline → regelbreuk
// Volgorde: eerst translateOptRefs, dan escape (safety), dan opmaak toepassen.
function formatCommentBody(text, qid, qObj){
  if(!text) return "";
  let s = translateOptRefs(text, qid, qObj);
  s = esc(s);
  const applyInline = t => t
    .replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[^*])\*([^*\n]+?)\*(?!\*)/g, "$1<em>$2</em>")
    .replace(/`([^`\n]+)`/g, "<code>$1</code>");
  const paragraphs = s.split(/\n{2,}/);
  return paragraphs.map(p=>{
    const lines = p.split(/\n/);
    const bulletLines = lines.filter(l=>l.trim()!=="");
    const isList = bulletLines.length>0 && bulletLines.every(l=>/^\s*[-*]\s+/.test(l));
    if(isList){
      const items = bulletLines.map(l=>applyInline(l.replace(/^\s*[-*]\s+/,"").trim()));
      return `<ul class="cmt-list">${items.map(i=>`<li>${i}</li>`).join("")}</ul>`;
    }
    return `<p class="cmt-p">${lines.map(applyInline).join("<br>")}</p>`;
  }).join("");
}

// Vertaal placeholders in rijke tekst naar de LETTER(S) die de gebruiker in de huidige shuffle ziet.
//   {A}..{Z}   → verwijzing naar een specifieke optie op editor-positie (A = eerste optie enz.)
//   {juist}    → verwijzing naar het juiste antwoord van deze vraag (elke shuffle, elke gebruiker klopt)
//   {docent}   → verwijzing naar het antwoord dat de docent koos (indien ingevuld)
function translateOptRefs(text, qid, qObj){
  if(text==null) return text;
  let s = String(text);
  // Zoek de vraag in PLAY.all (indien beschikbaar) om {juist} en {docent} te kunnen resolven
  const q = qObj || (PLAY.all||[]).find(x=>x.id===qid);
  s = s.replace(/\{juist\}/gi, (m)=>{
    if(!q) return m;
    const idxs = arr(q.correct_indexes);
    if(!idxs.length) return m;
    return lettersOfForQ(qid, idxs);
  });
  s = s.replace(/\{docent\}/gi, (m)=>{
    if(!q) return m;
    const idxs = arr(q.docent_indexes);
    if(!idxs.length) return m;
    return lettersOfForQ(qid, idxs);
  });
  // Multi-verwijzing zoals {A,B,C} of {A, C} of {a,b} → "A, C" enz. Ook enkele letter {A}.
  s = s.replace(/\{([A-Za-z](?:\s*,\s*[A-Za-z])*)\}/g, (m, group)=>{
    const parts=group.split(/\s*,\s*/);
    const idxs=[]; let anyBad=false;
    for(const p of parts){
      const upper=p.toUpperCase();
      const origIdx=upper.charCodeAt(0)-65;
      if(origIdx<0||origIdx>25){ anyBad=true; break; }
      idxs.push(origIdx);
    }
    if(anyBad) return m;
    if(idxs.length===1){
      const l=letterForOrig(qid, idxs[0]);
      return parts[0]===parts[0].toUpperCase() ? l : l.toLowerCase();
    }
    // Meerdere letters: gebruik lettersOfForQ zodat volgorde en scheidingsteken consistent zijn met andere plekken
    return lettersOfForQ(qid, idxs);
  });
  return s;
}

/* ---------- Statistiek-hulpjes ---------- */
function scored(events){ return (events||[]).filter(e=>e.is_correct!=null); }  // enkel gevalideerde antwoorden
function dailyAccuracy(events){
  const byDay={};
  scored(events).forEach(e=>{ const d=(e.created_at||"").slice(0,10); if(!d)return; (byDay[d]=byDay[d]||{c:0,t:0}); byDay[d].t++; if(e.is_correct)byDay[d].c++; });
  return Object.keys(byDay).sort().map(d=>({label:d.slice(5), value:Math.round(byDay[d].c/byDay[d].t*100), n:byDay[d].t}));
}
function cumulativeAccuracy(events){
  const ev=scored(events).sort((a,b)=>(a.created_at||"")<(b.created_at||"")?-1:1);
  let c=0; return ev.map((e,i)=>{ if(e.is_correct)c++; return {label:String(i+1), value:Math.round(c/(i+1)*100)}; });
}
function improvement(events){ // eerste helft vs tweede helft
  const ev=scored(events).sort((a,b)=>(a.created_at||"")<(b.created_at||"")?-1:1);
  if(ev.length<6) return null;
  const h=Math.floor(ev.length/2);
  const acc=a=>Math.round(a.filter(e=>e.is_correct).length/a.length*100);
  return { first:acc(ev.slice(0,h)), last:acc(ev.slice(h)) };
}
function lineChartSVG(points, opts){
  opts=opts||{}; const color=opts.color||"#2952cc";
  const W=680,H=210,pL=30,pR=12,pT=12,pB=28,n=points.length;
  if(!n) return `<p class="muted">Nog geen gegevens — speel wat vragen om je curve te zien.</p>`;
  const X=i=> n===1? pL+(W-pL-pR)/2 : pL+i*(W-pL-pR)/(n-1);
  const Y=v=> pT+(1-v/100)*(H-pT-pB);
  const path=points.map((p,i)=>`${i?"L":"M"}${X(i).toFixed(1)},${Y(p.value).toFixed(1)}`).join(" ");
  const grid=[0,50,100].map(g=>`<line x1="${pL}" y1="${Y(g)}" x2="${W-pR}" y2="${Y(g)}" stroke="#dfe3ea"/><text x="2" y="${Y(g)+3}" font-size="9" fill="#5b6472">${g}</text>`).join("");
  const dots=points.map((p,i)=>`<circle cx="${X(i).toFixed(1)}" cy="${Y(p.value).toFixed(1)}" r="2.4" fill="${color}"><title>${esc(p.label)}: ${p.value}%${p.n?` (${p.n})`:""}</title></circle>`).join("");
  const step=Math.max(1,Math.ceil(n/8));
  const xl=points.map((p,i)=>(i%step===0||i===n-1)?`<text x="${X(i)}" y="${H-8}" font-size="9" fill="#5b6472" text-anchor="middle">${esc(p.label)}</text>`:"").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}<path d="${path}" fill="none" stroke="${color}" stroke-width="2"/>${dots}${xl}</svg>`;
}
function kpi(label,val,sub){ return `<div class="kpi"><div class="kpi-val">${val}</div><div class="kpi-lab">${esc(label)}</div>${sub?`<div class="kpi-sub">${esc(sub)}</div>`:""}</div>`; }
function dailyCounts(rows){
  const by={}; rows.forEach(r=>{ const d=(r.created_at||"").slice(0,10); if(d) by[d]=(by[d]||0)+1; });
  return Object.keys(by).sort().map(d=>({label:d.slice(5), value:by[d]}));
}
// laatste `hours` uur als aparte bins van 1 u, eindigend op het huidige uur
function hourlyCounts(rows, hours){
  const buckets=[]; const now=new Date(); now.setMinutes(0,0,0);
  const key=d=>d.toISOString().slice(0,13);   // YYYY-MM-DDTHH
  const idx={}; for(let i=hours-1;i>=0;i--){ const d=new Date(now.getTime()-i*3600000); const k=key(d); idx[k]=buckets.length; buckets.push({label:d.getHours().toString().padStart(2,"0")+"u", value:0, k}); }
  rows.forEach(r=>{ if(!r.created_at) return; const k=r.created_at.slice(0,13); if(k in idx) buckets[idx[k]].value++; });
  return buckets;
}
function barChartSVG(points, opts){
  opts=opts||{}; const color=opts.color||"#2952cc";
  const W=680,H=180,pL=30,pR=12,pT=12,pB=28,n=points.length;
  if(!n) return `<p class="muted">Nog geen gegevens.</p>`;
  const maxV=Math.max(1,...points.map(p=>p.value));
  const gap=(W-pL-pR)/n, bw=gap*0.68;
  const Y=v=>pT+(1-v/maxV)*(H-pT-pB), base=H-pB;
  const grid=[0,maxV].map(g=>`<line x1="${pL}" y1="${Y(g)}" x2="${W-pR}" y2="${Y(g)}" stroke="#dfe3ea"/><text x="2" y="${Y(g)+3}" font-size="9" fill="#5b6472">${g}</text>`).join("");
  const bars=points.map((p,i)=>{ const x=pL+i*gap+(gap-bw)/2, y=Y(p.value); return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${bw.toFixed(1)}" height="${(base-y).toFixed(1)}" rx="1.5" fill="${color}"><title>${esc(p.label)}: ${p.value}</title></rect>`; }).join("");
  const step=Math.max(1,Math.ceil(n/10));
  const xl=points.map((p,i)=>(i%step===0||i===n-1)?`<text x="${pL+i*gap+gap/2}" y="${H-8}" font-size="9" fill="#5b6472" text-anchor="middle">${esc(p.label)}</text>`:"").join("");
  return `<svg viewBox="0 0 ${W} ${H}" class="chart">${grid}${bars}${xl}</svg>`;
}

// PROM-cohorten: nu is PROM23 de nieuwste; vanaf 1 maart 2027 komt PROM24 erbij,
// daarna elk jaar op 1 maart één nummer hoger. Groeit dus vanzelf.
function promList(){
  const base=23, baseYear=2027;           // 1 maart 2027 → PROM24
  const now=new Date(), Y=now.getFullYear(), m=now.getMonth();  // maart = index 2
  const latest = base + Math.max(0, Y-baseYear) + ((Y>=baseYear && m>=2)?1:0);
  const out=[]; for(let n=latest;n>=base;n--) out.push("PROM"+n);
  return out;
}

/* ============================================================
   AUTH
   ============================================================ */
async function loadProfile(){
  const { data:{ user } } = await sb.auth.getUser();
  if(!user){ ME=null; return; }
  const { data } = await sb.from("profiles").select("*").eq("id", user.id).single();
  ME = data ? { ...data, email:user.email } : null;
}

async function viewLogin(){
  let regOpen = true;
  try{ const {data}=await sb.from("app_settings").select("registration_open").eq("id",1).single(); if(data) regOpen=data.registration_open; }catch(e){}
  app.innerHTML = `
    <div class="auth-wrap">
      <div class="card">
        <h1>QUIZT.ET</h1>
        <p class="muted" style="margin-bottom:1rem">Oefenquizzen</p>
        <div class="tabs">
          <button id="tabLogin" class="active">Inloggen</button>
          <button id="tabReg" ${regOpen?"":"disabled title='Registratie is afgesloten'"}>Registreren</button>
        </div>
        <div id="regNote" class="notice" hidden>
          <strong>Toegang enkel met een @police.belgium.eu e-mailadres.</strong>
          Registreer met je politie-e-mailadres; andere adressen worden geweigerd.
          <br><br>Sterk aangeraden: gebruik hier een wachtwoord dat je <strong>nog nooit ergens anders</strong> hebt gebruikt.
        </div>
        <form id="authForm">
          <div id="cohortRow" hidden>
            <label>Oorsprong</label>
            <select id="cohort">${promList().map(p=>`<option value="${p}">${p}</option>`).join("")}<option value="__ander">Andere…</option></select>
            <input id="cohortOther" placeholder="Vul je oorsprong in" hidden style="margin-top:.4rem">
          </div>
          <label>E-mail</label><input id="email" type="email" autocomplete="email" required>
          <label>Wachtwoord</label><input id="pw" type="password" autocomplete="current-password" required minlength="6">
          <div class="btnrow"><button class="btn btn-primary" type="submit" id="submitBtn" style="width:100%">Inloggen</button></div>
          <div id="forgotRow" style="text-align:center;margin-top:.7rem"><a class="ilink" id="forgotLink">Wachtwoord vergeten?</a></div>
        </form>
        ${regOpen?"":`<p class="muted" style="margin-top:.8rem">Registratie is momenteel afgesloten door een beheerder.</p>`}
      </div>
    </div>`;
  let mode="login";
  const setMode = m => { mode=m;
    document.getElementById("tabLogin").classList.toggle("active",m==="login");
    document.getElementById("tabReg").classList.toggle("active",m==="reg");
    document.getElementById("cohortRow").hidden = m!=="reg";
    document.getElementById("regNote").hidden = m!=="reg";
    document.getElementById("forgotRow").hidden = m!=="login";
    document.getElementById("submitBtn").textContent = m==="reg"?"Account aanmaken":"Inloggen";
  };
  document.getElementById("forgotLink").onclick=async()=>{
    const email=document.getElementById("email").value.trim();
    if(!email) return toast("Vul eerst je e-mailadres in","err");
    const { error }=await sb.auth.resetPasswordForEmail(email);
    if(error) return toast(error.message,"err");
    toast("Als e-mail is ingesteld, is er een reset-link verstuurd.","ok");
  };
  document.getElementById("cohort").onchange=e=>{
    document.getElementById("cohortOther").hidden = e.target.value!=="__ander";
  };
  document.getElementById("tabLogin").onclick=()=>setMode("login");
  document.getElementById("tabReg").onclick=()=>{ if(regOpen) setMode("reg"); };
  document.getElementById("authForm").onsubmit = async e=>{
    e.preventDefault();
    const email=document.getElementById("email").value.trim();
    const pw=document.getElementById("pw").value;
    const btn=document.getElementById("submitBtn"); btn.disabled=true;
    try{
      if(mode==="reg"){
        if(!email.toLowerCase().endsWith("@police.belgium.eu")){ toast("Registreren kan enkel met een @police.belgium.eu e-mailadres.","err"); btn.disabled=false; return; }
        let cohort=document.getElementById("cohort").value;
        if(cohort==="__ander") cohort=document.getElementById("cohortOther").value.trim();
        if(!cohort){ toast("Geef je oorsprong op.","err"); btn.disabled=false; return; }
        const { error } = await sb.auth.signUp({ email, password:pw, options:{ data:{ cohort } }});
        if(error) throw error;
        toast("Account aangemaakt. Je kan nu inloggen.","ok");
        setMode("login");
      }else{
        const { error } = await sb.auth.signInWithPassword({ email, password:pw });
        if(error) throw error;
        await boot();
      }
    }catch(err){ toast(err.message||"Er ging iets mis","err"); }
    finally{ btn.disabled=false; }
  };
}

async function doLogout(){ await sb.auth.signOut(); ME=null; location.hash=""; location.reload(); }

/* ============================================================
   HEADER / ROUTER
   ============================================================ */
let USER_COUNT=null;
async function fetchUserCount(){
  if(USER_COUNT!=null) return USER_COUNT;
  try{ const { count } = await sb.from("profiles").select("*",{count:"exact",head:true}); USER_COUNT=count||0; }
  catch(e){ USER_COUNT=0; }
  return USER_COUNT;
}
function renderHeader(){
  const h=document.getElementById("appHeader");
  if(!ME){ h.hidden=true; return; }
  h.hidden=false;
  const nav=document.getElementById("topnav");
  const usersLabel = isEditor() ? `Gebruikers${USER_COUNT!=null?` (${USER_COUNT})`:""}` : null;
  const notifyBadge = `<span id="notifyBadge" class="notify-badge" ${NOTIFY_COUNT>0?"":"hidden"}>${NOTIFY_COUNT}</span>`;
  const links=[["#/","Quizzen"],["#/stats/vragen","Statistiek"],["#/account","Mijn account"],["#/meldingen","Meldingen "+notifyBadge]];
  if(isEditor()) links.push(["#/stats/gebruikers",usersLabel]);
  if(isEditor()) links.push(["#/beheer","Beheer"]);
  if(isEditor()) links.push(["__handleiding","Handleiding"]);
  nav.innerHTML = links.map(([h,l])=>`<a data-nav="${h}">${l}</a>`).join("");
  if(isEditor() && USER_COUNT==null) fetchUserCount().then(renderHeader);
  const roleName = ME.role==="admin"?"admin":ME.role==="beheerder"?"beheerder":"speler";
  document.getElementById("userbox").innerHTML =
    `<span class="role ${ME.role}">${roleName}</span><span class="uname">${esc(ME.display_name)}</span>`+
    `<button class="btn btn-ghost btn-sm" id="logoutBtn" title="Uitloggen" aria-label="Uitloggen"><span class="hide-sm">Uitloggen</span><span class="only-sm">⎋</span></button>`;
  document.getElementById("logoutBtn").onclick=doLogout;
  const menuBtn=document.getElementById("navToggle");
  if(menuBtn) menuBtn.onclick=()=>{ h.classList.toggle("nav-open"); };
  document.querySelectorAll("[data-nav]").forEach(a=>a.onclick=e=>{
    h.classList.remove("nav-open");
    const t=a.dataset.nav;
    if(t==="__handleiding"){ openBeheerManual(); return; }
    go(t);
  });
  const cur = location.hash||"#/";
  nav.querySelectorAll("a").forEach(a=>a.classList.toggle("active", a.dataset.nav===cur || (a.dataset.nav==="#/"&&cur.startsWith("#/quiz"))));
}

let ROUTE_GEN = 0;
function currentRouteGen(){ return ROUTE_GEN; }
async function route(){
  if(!sb){ app.innerHTML=`<div class="card"><h1>Nog niet geconfigureerd</h1><p class="muted">Vul je Supabase-gegevens in <code>config.js</code> in. Zie SETUP.md.</p></div>`; return; }
  if(!ME){ document.getElementById("appHeader").hidden=true; return viewLogin(); }
  renderHeader();
  ROUTE_GEN++;
  const h=(location.hash||"#/").slice(1);
  const p=h.split("/").filter(Boolean);   // ["quiz","<id>","overzicht"]
  app.innerHTML=`<div class="loading">Laden…</div>`;
  try{
    if(p.length===0) return viewHome();
    if(p[0]==="quiz" && p[2]==="overzicht") return viewOverview(p[1]);
    if(p[0]==="quiz" && p[2]==="stats") return viewQuizStats(p[1]);
    if(p[0]==="quiz" && p[2]==="pogingen") return viewAttemptsList(p[1]);
    if(p[0]==="quiz" && p[2]==="poging" && p[3]==="nieuw") return viewNewAttempt(p[1]);
    if(p[0]==="quiz" && p[2]==="poging") return viewAttemptDetail(p[1], p[3]);
    if(p[0]==="quiz") return viewPlay(p[1]);
    if(p[0]==="stats" && p[1]==="vragen") return viewStatsVragen();
    if(p[0]==="stats" && p[1]==="gebruikers") return viewStatsGebruikers();
    if(p[0]==="tetris") return viewScorebord();
    if(p[0]==="scorebord") return viewScorebord();
    if(p[0]==="meldingen") return viewMeldingen();
    if(p[0]==="account") return viewAccount();
    if(p[0]==="beheer" && p[1]==="vraag") return viewEditQuestion(p[2]);
    if(p[0]==="beheer" && p[1]==="quiz" && p[3]==="audit") return viewBeheerAudit(p[2]);
    if(p[0]==="beheer" && p[1]==="quiz") return viewBeheerQuiz(p[2]);
    if(p[0]==="beheer" && p[1]==="import") return viewImport();
    if(p[0]==="beheer") return viewBeheer(p[1]||"quizzen");
    viewHome();
  }catch(err){ console.error(err); app.innerHTML=`<div class="card err">Fout: ${esc(err.message)}</div>`; }
}
window.addEventListener("hashchange", route);

/* ============================================================
   HOME — quizoverzicht
   ============================================================ */
async function viewHome(){
  const myGen = currentRouteGen();
  const stale = () => myGen !== currentRouteGen();
  const { data:quizzes, error } = await sb.from("quizzes").select("*").order("created_at");
  if(stale()) return;
  if(error) throw error;
  // aantal vragen per quiz + mijn voortgang
  const { data:qs } = await sb.from("questions").select("id,quiz_id");
  if(stale()) return;
  const counts={}, q2quiz={}; (qs||[]).forEach(q=>{ counts[q.quiz_id]=(counts[q.quiz_id]||0)+1; q2quiz[q.id]=q.quiz_id; });
  const myAns={};
  const qids=(qs||[]).map(q=>q.id);
  if(qids.length){ const {data:mine}=await sb.from("answers").select("question_id").eq("user_id",ME.id).in("question_id",qids);
    if(stale()) return;
    (mine||[]).forEach(a=>{ const qz=q2quiz[a.question_id]; if(qz) myAns[qz]=(myAns[qz]||0)+1; }); }
  const cards=(quizzes||[]).map(q=>{
    const tot=counts[q.id]||0, done=myAns[q.id]||0;
    const p=pct(done,tot);
    return `
    <div class="card quiz-card" data-open="${q.id}">
      <div class="quiz-card-top">
        <span class="badge ${q.status==="gepubliceerd"?"pub":"concept"}">${q.status}</span>
        <span class="muted quiz-card-q">${tot} vragen</span>
      </div>
      <h3>${esc(q.title)}</h3>
      <p class="quiz-card-desc muted">${esc(q.description||"—")}</p>
      <div class="quiz-card-progress">
        <div class="quiz-card-progress-lab">
          <span>Jouw voortgang</span>
          <span><strong>${done}</strong>/${tot} · ${p}%</span>
        </div>
        <div class="progress-thin"><span style="width:${p}%"></span></div>
      </div>
    </div>`;}).join("");
  // Paint de quizzen zo snel mogelijk; games-sectie wordt achteraf ingeladen zodat
  // trage game-queries de quizzen-lijst niet blokkeren en geen stale renders kunnen veroorzaken.
  if(stale()) return;
  app.innerHTML=`
    <div class="spread"><h1>Quizzen</h1>${isEditor()?`<button class="btn btn-primary btn-sm" data-nav="#/beheer">Beheer</button>`:""}</div>
    <div class="dev-note">${ICON.info} QUIZT.ET wordt nog volop ontwikkeld — vernieuw af en toe eens de pagina om de laatste functies te hebben. <button class="btn btn-ghost btn-sm" id="hardRefresh" style="margin-left:.5rem">Nu vernieuwen</button></div>
    ${quizzes&&quizzes.length?`<div class="grid" style="margin-top:1rem">${cards}</div>`:`<div class="empty">Nog geen quizzen.</div>`}
    <div id="gamesSection"></div>
    <div id="gamesTop"></div>`;
  app.querySelectorAll("[data-open]").forEach(c=>c.onclick=()=>go("#/quiz/"+c.dataset.open));
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const hr=document.getElementById("hardRefresh");
  if(hr) hr.onclick=()=>{ const base=location.href.split("?")[0].split("#")[0]; location.href=base+"?_="+Date.now()+location.hash; };
  // Games-sectie laden en achteraf inspuiten — enkel als de gebruiker nog steeds op home is
  (async()=>{
    try{
      await loadGamesConfig();
      if(stale()) return;
      const active=activeGames();
      const myStatsArr = active.length ? await Promise.all(active.map(g=>gameStats(g.id, "me"))) : [];
      if(stale()) return;
      const myStats={}; active.forEach((g,i)=>{ myStats[g.id]=myStatsArr[i]; });
      const gs = document.getElementById("gamesSection");
      if(gs){
        gs.innerHTML = renderGamesSection(myStats);
        gs.querySelectorAll("[data-play]").forEach(b=>b.onclick=()=>{
          const g=GAMES.find(x=>x.id===b.dataset.play); if(g && typeof g.open==="function") g.open();
        });
      }
      if(!stale()) renderGamesTop3();
    }catch(_){ /* stil falen op de games-sectie is oké */ }
  })();
}

async function bestPerUser(limit, since){
  let q=sb.from("tetris_scores").select("user_id,score,lines,level,created_at").order("score",{ascending:false}).limit(200);
  if(since) q=q.gte("created_at", since.toISOString());
  const { data:rows }=await q;
  const seen=new Set(); const best=[]; (rows||[]).forEach(r=>{ if(seen.has(r.user_id)) return; seen.add(r.user_id); best.push(r); });
  return best.slice(0, limit||best.length);
}

// Stats per game — één query per active game, ofwel voor mij ofwel voor iedereen
async function gameStats(gameId, userScope /* "me" | "all" */){
  const isTetris = gameId==="tetris";
  const tbl = isTetris ? "tetris_scores" : "game_scores";
  let q = sb.from(tbl).select("user_id,score,created_at");
  if(!isTetris) q = q.eq("game", gameId);
  if(userScope==="me" && ME) q = q.eq("user_id", ME.id);
  q = q.order("created_at",{ascending:false}).limit(5000);
  const { data } = await q;
  const rows = data || [];
  if(!rows.length) return { plays:0, best:0, last:null, players:0 };
  const best = rows.reduce((m,r)=>Math.max(m, r.score||0), 0);
  const players = new Set(rows.map(r=>r.user_id)).size;
  return { plays: rows.length, best, last: rows[0].created_at, players };
}

// Generieke best-per-user helper voor game_scores (snake/pong) — hoogste score per speler
async function bestGameScores(game, limit, since){
  let q=sb.from("game_scores").select("user_id,score,meta,created_at").eq("game",game).order("score",{ascending:false}).limit(200);
  if(since) q=q.gte("created_at", since.toISOString());
  const { data:rows }=await q;
  const seen=new Set(); const best=[]; (rows||[]).forEach(r=>{ if(seen.has(r.user_id)) return; seen.add(r.user_id); best.push(r); });
  return best.slice(0, limit||best.length);
}

// Compacte top-3 sectie op de home — één card per actieve game
async function renderGamesTop3(){
  const el=document.getElementById("gamesTop"); if(!el) return;
  const list=activeGames();
  if(!list.length){ el.innerHTML=""; return; }
  const fetches = list.map(g=>{
    const since=periodStart(gameResetMode(g.id));
    return g.id==="tetris" ? bestPerUser(3, since) : bestGameScores(g.id, 3, since);
  });
  const results = await Promise.all(fetches);
  const allIds = results.flat().map(t=>t.user_id);
  const names = allIds.length ? await namesFor(allIds) : {};
  const medals=["🥇","🥈","🥉"];
  const boards = list.map((g,i)=>{
    const top=results[i];
    const mode=gameResetMode(g.id);
    const label=periodLabel(mode);
    return `<div class="score-mini">
      <div class="score-mini-hd">${g.icon} <strong>${esc(g.name)}</strong>${label?` <span class="score-mini-reset" title="Scores worden gefilterd op periode">${label}</span>`:""}</div>
      ${top.length
        ? `<ol class="score-mini-list">${top.map((t,i)=>`<li><span class="score-mini-medal">${medals[i]}</span><span class="score-mini-name">${esc(names[t.user_id]||"?")}</span><span class="score-mini-num">${t.score}</span></li>`).join("")}</ol>`
        : `<p class="muted score-mini-empty">Nog geen scores.</p>`
      }
    </div>`;
  }).join("");
  el.innerHTML=`
    <div class="card score-mini-card">
      <div class="score-mini-top">
        <div class="score-mini-title">🏆 <strong>High scores</strong> <span class="muted" style="font-size:.78rem">— beste per speler</span></div>
        <a class="ilink" data-nav="#/scorebord" style="font-size:.85rem">Volledig scorebord →</a>
      </div>
      <div class="score-mini-grid">${boards}</div>
    </div>`;
  el.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
}

// Per-game metadata voor het scorebord: tabelkoppen, rij-render, uitleg
function scorebordMeta(gameId, names){
  const meRow=t=>t.user_id===ME.id?' style="background:var(--accent-soft)"':'';
  const meLbl=t=>t.user_id===ME.id?' <span class="muted" style="font-size:.72rem">(jij)</span>':'';
  const nm=t=>esc(names[t.user_id]||"?");
  const dt=t=>`<td class="muted" style="font-size:.75rem">${fmtDate(t.created_at)}</td>`;
  const base=(extraTh, extraTd, tip)=>({
    head:`<thead><tr><th>#</th><th>Naam</th><th>Score</th>${extraTh}<th>Datum</th></tr></thead>`,
    row:(t,i)=>`<tr${meRow(t)}><td><strong>${i+1}</strong></td><td>${nm(t)}${meLbl(t)}</td><td><strong>${t.score}</strong></td>${extraTd(t)}${dt(t)}</tr>`,
    tip,
  });
  switch(gameId){
    case "tetris":
      return { source:"tetris", empty:"Nog geen scores.",
        ...base("<th>Lijnen</th><th>Level</th>", t=>`<td>${t.lines}</td><td>${t.level}</td>`,
          "Ontgrendel Tetris via een oefensessie van ≥25 vragen met ≥80% juist (tenzij een beheerder de game vrij zet).") };
    case "snake":
      return { source:"game", empty:"Nog geen scores.",
        ...base("", ()=>"", "Score = het aantal punten dat je haalde. Elke appel is +10.") };
    case "pong":
      return { source:"game", empty:"Nog geen wedstrijden gewonnen.",
        ...base("<th>Setstand</th>", t=>`<td>${t.meta?`${t.meta.you||"?"}-${t.meta.cpu||"?"}`:"—"}</td>`,
          "Score = 70 − CPU-punten × 10. Schoner gewonnen = hoger. Verlies telt niet mee.") };
    case "g2048":
      return { source:"game", empty:"Nog geen scores.",
        ...base("<th>Hoogste tegel</th>", t=>`<td>${t.meta&&t.meta.best?t.meta.best:"—"}</td>`,
          "Score = som van alle samengevoegde waarden.") };
    case "breakout":
      return { source:"game", empty:"Nog geen scores.",
        ...base("<th>Levens over</th>", t=>`<td>${t.meta&&typeof t.meta.lives==="number"?t.meta.lives:"—"}</td>`,
          "Score = 10 per steen + 50 bonus per overgebleven leven bij shutout.") };
    default:
      return { source:"game", empty:"Nog geen scores.", ...base("", ()=>"", "") };
  }
}

async function viewScorebord(){
  app.innerHTML=`<div class="loading">Scorebord laden…</div>`;
  await loadGamesConfig();
  const list=activeGames();
  if(!list.length){
    app.innerHTML=`<a class="muted" data-nav="#/">← Quizzen</a>
      <h1 style="margin:.5rem 0">🏆 Scorebord</h1>
      <p class="muted">Nog geen games geactiveerd. Ga naar Beheer → Instellingen om er eentje aan te zetten.</p>`;
    app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
    return;
  }
  const sinces=list.map(g=>periodStart(gameResetMode(g.id)));
  const results=await Promise.all(list.map((g,i)=>g.id==="tetris" ? bestPerUser(50, sinces[i]) : bestGameScores(g.id, 50, sinces[i])));
  const allIds=results.flat().map(t=>t.user_id);
  const names = allIds.length ? await namesFor(allIds) : {};
  const fmtSince=d=>d?d.toLocaleDateString("nl-BE",{day:"2-digit",month:"short",year:"numeric"}):"";
  const periodPill=(mode,since)=>{
    const lbl=periodLabel(mode); if(!lbl) return "";
    return `<span class="score-period-pill">${lbl} · sinds ${fmtSince(since)}</span>`;
  };
  const sections=list.map((g,i)=>{
    const meta=scorebordMeta(g.id, names);
    const rows=results[i];
    const since=sinces[i], mode=gameResetMode(g.id);
    return `<details class="score-section" open>
      <summary><span class="score-section-hd">${g.icon} <strong>${esc(g.name)}</strong> <span class="muted" style="font-size:.78rem">(${rows.length})</span> ${periodPill(mode, since)}</span></summary>
      <div style="margin-top:.5rem">
        ${rows.length
          ? `<div class="card score-table-card"><table>${meta.head}<tbody>${rows.map(meta.row).join("")}</tbody></table></div>`
          : `<p class="muted">${meta.empty}</p>`
        }
        ${meta.tip?`<p class="muted" style="font-size:.78rem;margin-top:.4rem">${meta.tip}</p>`:""}
      </div>
    </details>`;
  }).join("");
  app.innerHTML=`
    <a class="muted" data-nav="#/">← Quizzen</a>
    <h1 style="margin:.5rem 0">🏆 Scorebord</h1>
    <p class="muted" style="font-size:.85rem;margin:.2rem 0 1rem 0">Beste score per speler, per game. Elke game telt — alleen je persoonlijke topscore staat in de ranglijst.</p>
    ${sections}
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
}

/* ============================================================
   PLAY — vraag per vraag
   ============================================================ */
const PLAY={ mode:"slim" };
function qStatus(q,answers){ const c=answers[q.id]; if(c==null) return "onbeantwoord"; const r=isRight(q,c); return r===false?"fout":r===true?"juist":"overleg"; }
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; }
// Volgorde-modi: nummer, willekeurig, foutEerst, gemistEerst (onbeantwoord eerst), slim (gewogen toeval)
function orderQuestions(all, answers, mode){
  const byNum=(a,b)=>a.sort_order-b.sort_order;
  if(mode==="nummer"||mode==="volgorde"||mode==="examen") return all.slice().sort(byNum);
  if(mode==="willekeurig") return shuffle(all);
  if(mode==="foutEerst"||mode==="gemistEerst"){
    const rank = mode==="foutEerst"
      ? {fout:0, onbeantwoord:1, overleg:2, juist:3}
      : {onbeantwoord:0, fout:1, overleg:2, juist:3};
    return all.slice().sort((a,b)=>(rank[qStatus(a,answers)]-rank[qStatus(b,answers)])||byNum(a,b));
  }
  // slim: gewogen willekeurig — nooit-beantwoord krijgt voorrang, dan fout, dan overleg, dan juist
  const weight=q=>{ const s=qStatus(q,answers); return s==="onbeantwoord"?4:s==="fout"?3:s==="overleg"?2:1; };
  return all.map(q=>({q,k:Math.random()/weight(q)})).sort((a,b)=>a.k-b.k).map(x=>x.q);
}
// Speelvoorkeuren per gebruiker onthouden (browser)
function loadPrefs(){ try{ return JSON.parse(localStorage.getItem("quiztet_play")||"{}"); }catch(e){ return {}; } }
function savePrefs(p){ try{ localStorage.setItem("quiztet_play", JSON.stringify(p)); }catch(e){} }
// Sessie-persistentie zodat browser-back / tab-close / crash je niet doet verliezen,
// en synchronisatie met Supabase zodat je gsm en laptop dezelfde sessie zien.
const SESSION_KEY = qid => `quiztet_session_${qid}`;
let _sessionSyncTimer=null;
function currentSessionState(){
  return {
    quizId:PLAY.quiz.id, session:PLAY.session||{}, mode:PLAY.mode||"slim",
    questionIds:PLAY.questions.map(q=>q.id), i:PLAY.i||0,
    answers:PLAY.answers||{}, optOrder:PLAY.optOrder||{},
    ts:Date.now(),
  };
}
function saveSession(){
  if(!PLAY.quiz || !PLAY.questions) return;
  const state=currentSessionState();
  try{ localStorage.setItem(SESSION_KEY(PLAY.quiz.id), JSON.stringify(state)); }catch(e){}
  // debounced upsert naar Supabase — één schrijfactie per seconde is meer dan genoeg
  clearTimeout(_sessionSyncTimer);
  _sessionSyncTimer=setTimeout(()=>{
    sb.from("play_sessions").upsert({ user_id:ME.id, quiz_id:PLAY.quiz.id, state, updated_at:new Date().toISOString() },{ onConflict:"user_id,quiz_id" }).then(()=>{},()=>{});
  }, 800);
}
function loadLocalSession(quizId){
  try{ const raw=localStorage.getItem(SESSION_KEY(quizId)); return raw?JSON.parse(raw):null; }catch(e){ return null; }
}
async function loadRemoteSession(quizId){
  try{
    const { data } = await sb.from("play_sessions").select("state,updated_at").eq("user_id",ME.id).eq("quiz_id",quizId).maybeSingle();
    if(!data) return null;
    // updated_at heeft prioriteit als tijdstempel — vervangt state.ts
    const state=data.state||{};
    state.ts = new Date(data.updated_at).getTime();
    return state;
  }catch(e){ return null; }
}
async function loadSession(quizId){
  // Neem de nieuwste van beide (lokaal + remote)
  const [local, remote] = await Promise.all([Promise.resolve(loadLocalSession(quizId)), loadRemoteSession(quizId)]);
  if(local && remote) return (local.ts||0) >= (remote.ts||0) ? local : remote;
  return local || remote || null;
}
function clearSession(quizId){
  try{ localStorage.removeItem(SESSION_KEY(quizId)); }catch(e){}
  clearTimeout(_sessionSyncTimer);
  sb.from("play_sessions").delete().eq("user_id",ME.id).eq("quiz_id",quizId).then(()=>{},()=>{});
}
function humanAgo(ms){ const s=Math.round((Date.now()-ms)/1000);
  if(s<60) return "net"; if(s<3600) return Math.round(s/60)+" min geleden";
  if(s<86400) return Math.round(s/3600)+" u geleden"; return Math.round(s/86400)+" d geleden"; }

/* ---------- Notifications ---------- */
// Melding wanneer iemand reageert op een vraag waar jij ook al op reageerde.
const NOTIFY_KEY = () => `quiztet_notify_seen_${(ME&&ME.id)||""}`;
function getLastNotifySeen(){
  try{ return localStorage.getItem(NOTIFY_KEY()) || "1970-01-01T00:00:00Z"; }catch(e){ return "1970-01-01T00:00:00Z"; }
}
function markNotifySeen(){
  try{ localStorage.setItem(NOTIFY_KEY(), new Date().toISOString()); }catch(e){}
}
// Vragen waar de gebruiker al een flag/reactie op heeft (elk type, ook commentaar)
async function fetchNewNotifications(){
  if(!ME) return [];
  const { data:myFlags } = await sb.from("flags").select("question_id").eq("user_id",ME.id).range(0,4999);
  const qids = [...new Set((myFlags||[]).map(f=>f.question_id))];
  if(!qids.length) return [];
  const since = getLastNotifySeen();
  const { data:newFlags } = await sb.from("flags").select("id,question_id,user_id,type,toelichting,created_at,parent_id")
    .in("question_id", qids).gt("created_at", since).neq("user_id", ME.id)
    .order("created_at",{ascending:false}).range(0,199);
  return newFlags || [];
}
async function refreshNotifyBadge(){
  try{
    const items = await fetchNewNotifications();
    // Toon aantal geïmpacteerde VRAGEN (niet totaal aantal comments) — spreekt beter uit hoeveel discussies je moet bekijken
    NOTIFY_COUNT = new Set(items.map(i=>i.question_id)).size;
    const el = document.getElementById("notifyBadge");
    if(el){ el.textContent = NOTIFY_COUNT; el.hidden = NOTIFY_COUNT===0; }
  }catch(e){}
}
async function viewPlay(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  // Docent-antwoorden zichtbaar? Attribuut op elke vraag zodat renderers dat lokaal kunnen checken.
  (questions||[]).forEach(q=>{ q._show_docent = !!(quiz && quiz.show_docent); });
  PLAY.quiz=quiz; PLAY.all=questions||[]; PLAY.i=0; PLAY.answers={}; PLAY.history={}; PLAY.everWrong=new Set();
  PLAY.savedSession = await loadSession(quizId);
  const ids=PLAY.all.map(q=>q.id);
  if(ids.length){
    const [{data:mine},{data:wrongEvents}]=await Promise.all([
      sb.from("answers").select("*").eq("user_id",ME.id).in("question_id",ids),
      sb.from("answer_events").select("question_id").eq("user_id",ME.id).eq("quiz_id",quizId).eq("is_correct",false),
    ]);
    const qById={}; (PLAY.all||[]).forEach(q=>qById[q.id]=q);
    (mine||[]).forEach(a=>{
      const q=qById[a.question_id];
      // Voor open vragen bewaren we de tekst als "chosen"; voor mcq/matrix de int-array
      let val;
      if(q && q.question_type==="open"){
        if(a.open_answer_text==null || !String(a.open_answer_text).trim()) return; // niet beantwoord
        val = a.open_answer_text;
      } else {
        val = a.chosen_indexes||[];
        if(!Array.isArray(val) || !val.length) return;                             // niet beantwoord
      }
      PLAY.answers[a.question_id]=val;
      PLAY.history[a.question_id]=val;
    });
    (wrongEvents||[]).forEach(e=>PLAY.everWrong.add(e.question_id));
  }
  // open flags voor deze quiz (voor iedereen zichtbaar op het startscherm)
  PLAY.openFlags=[]; PLAY.flagNames={};
  if(ids.length){ const {data:of}=await sb.from("flags").select("id,question_id,type,toelichting,created_at,user_id").eq("status","open").neq("type","juist").in("question_id",ids).order("type").order("created_at",{ascending:false});
    PLAY.openFlags=of||[]; PLAY.flagNames=await namesFor(PLAY.openFlags.map(f=>f.user_id)); }
  if(PLAY.pendingJump){
    const jid=PLAY.pendingJump; PLAY.pendingJump=null;
    PLAY.session={size:"alle",focus:"alle",order:"nummer"}; PLAY.mode="nummer";
    PLAY.investigating=true;   // Ge-jumpt vanuit een flag/overzicht — geen echte sessie
    PLAY.questions=orderQuestions(PLAY.all, PLAY.answers, "nummer");
    const idx=PLAY.questions.findIndex(x=>x.id===jid);
    PLAY.i=idx>=0?idx:0; renderQuestion();
  } else { PLAY.investigating=false; renderPlaySetup(); }
}

// Herstel een eerder onderbroken sessie (uit cache van viewPlay)
function resumeSavedSession(){
  const saved=PLAY.savedSession;
  if(!saved || !saved.questionIds || !saved.questionIds.length){ clearSession(PLAY.quiz.id); return; }
  const byId={}; PLAY.all.forEach(q=>byId[q.id]=q);
  const restored=saved.questionIds.map(id=>byId[id]).filter(Boolean);
  if(!restored.length){ clearSession(PLAY.quiz.id); return; }
  PLAY.session=saved.session||{size:"alle",focus:"alle",order:saved.mode||"slim"};
  PLAY.mode=saved.mode||"slim";
  PLAY.questions=restored;
  PLAY.answers=saved.answers||{};
  PLAY.optOrder=saved.optOrder||{};
  PLAY.i=Math.min(Math.max(0, saved.i||0), restored.length-1);
  renderQuestion();
}

function poolFor(focus){
  const A=PLAY.answers;
  if(focus==="foute")       return PLAY.all.filter(q=>A[q.id]!=null && isRight(q,A[q.id])===false);
  if(focus==="onbeantwoord")return PLAY.all.filter(q=>A[q.id]==null);
  if(focus==="nietjuist")   return PLAY.all.filter(q=>A[q.id]==null || isRight(q,A[q.id])===false);
  if(focus==="ooitFout")    return PLAY.all.filter(q=>PLAY.everWrong && PLAY.everWrong.has(q.id));
  return PLAY.all.slice();
}
function renderPlaySetup(){
  const total=PLAY.all.length;
  const wrong=poolFor("foute").length, todo=poolFor("onbeantwoord").length, nietjuist=poolFor("nietjuist").length, ooitFout=poolFor("ooitFout").length;
  const pr=loadPrefs();
  let size=pr.size||"25", focus=pr.focus||"alle", order=pr.order||"slim";
  PLAY.mode=order;
  const sizes=[
    ["10","10","Korte oefensessie van 10 vragen"],
    ["25","25","25 vragen — een halfuurtje oefenen"],
    ["50","50","50 vragen — flinke oefensessie"],
    ["100","100","100 vragen — grondig doorwerken"],
    ["alle",`Alle (${total})`,`Alle ${total} vragen uit deze quiz in één sessie`],
  ];
  const focuses=[
    ["alle","Alle vragen","Elke vraag komt in aanmerking, ongeacht of je hem al beantwoord hebt."],
    ["foute",`Enkel mijn foute (${wrong})`,`Vragen waar je huidige antwoord fout op is (${wrong} stuks). Als je die later juist beantwoordt, verdwijnen ze hier.`],
    ["onbeantwoord",`Nog niet beantwoord (${todo})`,`Alleen vragen die je in geen enkele sessie al hebt beantwoord (${todo} stuks).`],
    ["nietjuist",`Nog niet juist (${nietjuist})`,`Vragen die je fout had OF nog nooit beantwoordde (${nietjuist} stuks) — combinatie van 'foute' en 'nog niet beantwoord'.`],
    ["ooitFout",`Historisch fout (${ooitFout})`,`Alle vragen die je in het verleden ooit minstens één keer fout hebt beantwoord (${ooitFout} stuks). Ze blijven hier staan, ook als je ze later juist hebt beantwoord. "Voortgang wissen" laat deze lijst intact — enkel een beheerder kan de historiek uit de database halen.`],
  ];
  const orders=[
    ["slim","Slim oefenen","Nooit-beantwoorde vragen krijgen voorrang, dan fout beantwoorde, dan overleg, dan juist. Gewogen willekeurig."],
    ["nummer","Op nummer","Vragen op vraagnummer, van laag naar hoog."],
    ["willekeurig","Willekeurig","Volledig willekeurig geschud — geen voorkeur."],
    ["foutEerst","Fouten eerst","Eerst de vragen die je fout had, dan de rest."],
    ["gemistEerst","Gemiste eerst","Eerst de vragen die je nog nooit beantwoordde, dan de rest."],
    ["examen","Examen","Alle vragen, geen feedback per vraag. Je dient in en ziet dan pas je volledige score. Selectie en aantal worden vastgezet op alle vragen."],
  ];
  const chips=(grp,list,cur)=>list.map(([v,l,tip])=>`<button class="chip-toggle ${v===cur?"active":""}" data-${grp}="${v}" title="${esc(tip||"")}">${l}${tip?` <span class="infotip chip-i" tabindex="0" data-tip="${esc(tip)}" onclick="event.stopPropagation();">${ICON.info}</span>`:""}</button>`).join("");
  const focusLabel=f=>({alle:"alle vragen",foute:"je huidig foute vragen",onbeantwoord:"nog niet beantwoorde vragen",nietjuist:"nog niet juiste vragen",ooitFout:"historisch foute vragen"})[f];
  const orderLabel=o=>({slim:"slim geoefend",nummer:"op vraagnummer",willekeurig:"willekeurig",foutEerst:"fouten eerst",gemistEerst:"gemiste eerst",examen:"in examen-modus"})[o];
  const summaryStr=()=>{
    if(order==="examen"){
      return `Je start een <strong>examen</strong> met alle <strong>${total}</strong> vragen. Geen feedback per vraag — je ziet je volledige score pas na indienen.`;
    }
    const custom=parseInt((document.getElementById("sizeCustom")||{}).value,10);
    const n=custom>0?custom:(size==="alle"?total:parseInt(size,10));
    return `Je start met <strong>${n}</strong> ${focusLabel(focus)}, ${orderLabel(order)}.`;
  };
  const saved=PLAY.savedSession;
  const savedValid = saved && saved.questionIds && saved.questionIds.length && (saved.i||0) < saved.questionIds.length;
  const savedAnsCount = saved && saved.answers ? Object.keys(saved.answers).length : 0;
  const resumeBanner = savedValid ? `<div class="resume-banner">
    <div>
      <strong>${ICON.clock} Je had een sessie aan de gang</strong>
      <div class="muted" style="font-size:.82rem">Positie: vraag ${(saved.i||0)+1}/${saved.questionIds.length} · <strong>${savedAnsCount} beantwoord</strong> · ${humanAgo(saved.ts||Date.now())} · synct tussen je toestellen</div>
    </div>
    <div class="btnrow" style="margin:0">
      <button class="btn btn-primary btn-sm" id="resumeBtn">Hervat sessie</button>
      <button class="btn btn-ghost btn-sm" id="discardResumeBtn" title="Wis de opgeslagen sessie">Weggooien</button>
    </div>
  </div>`:"";
  app.innerHTML=`
    <a class="muted" data-nav="#/">← Quizzen</a>
    <h1 style="margin:.5rem 0">${esc(PLAY.quiz.title)}</h1>
    <p class="muted">${esc(PLAY.quiz.description||"")}</p>
    <div class="muted" style="font-size:.82rem;margin:.4rem 0 1.2rem">
      Meer over deze quiz: <a class="ilink" data-nav="#/quiz/${PLAY.quiz.id}/overzicht">Overzicht van alle vragen</a> · <a class="ilink" data-nav="#/quiz/${PLAY.quiz.id}/stats">Statistiek van deze quiz</a> · <a class="ilink" data-nav="#/quiz/${PLAY.quiz.id}/pogingen">📜 Historische pogingen</a>
    </div>
    ${resumeBanner}
    <div class="setup-panel">
      <div class="setup-panel-hd">
        <div class="spread" style="gap:.5rem;align-items:flex-start">
          <div>
            <div class="setup-panel-title">Nieuwe oefensessie</div>
            <div class="muted" style="font-size:.8rem">Kies hoeveel vragen, welke selectie en in welke volgorde.</div>
          </div>
          <button class="btn btn-ghost btn-sm" id="modesHelpBtn" title="Uitgebreide uitleg over alle modi">${ICON.info} Uitleg over alle modi</button>
        </div>
      </div>

      <div class="card setup-step">
        <div class="setup-hd"><span class="setup-num">1</span> Hoeveel vragen? ${infoTip("Bepaalt hoe lang je sessie is. Kies een chip of typ zelf een aantal.")}</div>
        <div class="btnrow" id="gSize">${chips("size",sizes,size)}</div>
        <div style="margin-top:.6rem;display:flex;align-items:center;gap:.5rem">
          <span class="muted" style="font-size:.82rem">of typ zelf:</span>
          <input id="sizeCustom" type="number" min="1" max="${total}" placeholder="bv. 40" style="width:120px" value="${pr.customSize||""}">
        </div>
      </div>

      <div class="card setup-step">
        <div class="setup-hd"><span class="setup-num">2</span> Welke vragen?</div>
        <div class="btnrow" id="gFocus">${chips("focus",focuses,focus)}</div>
      </div>

      <div class="card setup-step">
        <div class="setup-hd"><span class="setup-num">3</span> In welke volgorde? ${infoTip("Bepaalt in welke volgorde je de geselecteerde vragen te zien krijgt. 'Slim oefenen' is aangeraden.")}</div>
        <div class="btnrow" id="gOrder">${chips("order",orders,order)}</div>
      </div>

      <div class="setup-summary" id="setupSummary"></div>
      <button class="btn btn-primary btn-start" id="startBtn">Start oefensessie →</button>
      <div id="examNote" class="muted" style="font-size:.78rem;margin-top:.5rem;display:none">📝 In examen-modus krijg je alle vragen zonder tussentijdse feedback. Bij "Dien in" verschijnt je volledige score.</div>
    </div>
    <div class="card" style="margin-top:1rem">
      <div class="spread">
        <div><strong>Mijn voortgang</strong><div class="muted" style="font-size:.82rem">Beantwoord: ${total-todo}/${total} · juist: ${PLAY.all.filter(q=>isRight(q,PLAY.answers[q.id])===true).length}</div></div>
        <div class="btnrow" style="margin:0;align-items:center">
          ${infoTip("Wist je huidige antwoordstatus zodat je met een schone lei kan hertesten. De filters 'Enkel mijn foute' en 'Nog niet beantwoord' tonen daarna weer alles, en 'slim oefenen' behandelt elke vraag als nieuw. Je bijdrage aan de statistieken en de lijst 'historisch fout' blijven wél bewaard, net als je flags en opmerkingen.")}
          <button class="btn btn-danger btn-sm" id="wipeBtn">Voortgang wissen</button>
        </div>
      </div>
    </div>
    ${(PLAY.openFlags&&PLAY.openFlags.length)?`
    <h2>Open flags <span class="muted" style="font-weight:400;font-size:.75em">— ${PLAY.openFlags.length} reactie${PLAY.openFlags.length===1?"":"s"} verdeeld over ${new Set(PLAY.openFlags.map(f=>f.question_id)).size} vraag/vragen</span></h2>
    <p class="muted" style="font-size:.82rem">Klik een vraag open om alle reacties erop te zien${isEditor()?" (als beheerder kan je ze afhandelen)":""}. Als er meer meldingen bij één vraag horen worden ze samen getoond.</p>
    ${renderSetupFlagGroups(PLAY.openFlags, PLAY.all, PLAY.quiz, PLAY.flagNames)}`:""}`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll("[data-q]").forEach(a=>a.onclick=()=>PLAY_goto(a.dataset.quiz, a.dataset.q));
  const rb=document.getElementById("resumeBtn"); if(rb) rb.onclick=()=>resumeSavedSession();
  const drb=document.getElementById("discardResumeBtn"); if(drb) drb.onclick=()=>{ if(!confirm("De opgeslagen sessie weggooien?")) return; clearSession(PLAY.quiz.id); renderPlaySetup(); };
  const wire=(id,attr,set)=>app.querySelectorAll(`#${id} [data-${attr}]`).forEach(b=>b.onclick=()=>{
    app.querySelectorAll(`#${id} [data-${attr}]`).forEach(x=>x.classList.toggle("active",x===b)); set(b.dataset[attr]); });
  const paintSummary=()=>{
    const el=document.getElementById("setupSummary"); if(el) el.innerHTML=summaryStr();
    const isExam = order==="examen";
    const note=document.getElementById("examNote"); if(note) note.style.display=isExam?"block":"none";
    const startB=document.getElementById("startBtn"); if(startB) startB.textContent = isExam ? "Start examen →" : "Start oefensessie →";
    // Grijs size + focus uit tijdens examen (alle vragen, hele quiz)
    ["gSize","gFocus"].forEach(id=>{ const el=document.getElementById(id); if(el){ el.style.opacity=isExam?".5":"1"; el.style.pointerEvents=isExam?"none":"auto"; } });
    const sc=document.getElementById("sizeCustom"); if(sc){ sc.disabled=isExam; sc.style.opacity=isExam?".5":"1"; }
  };
  document.getElementById("modesHelpBtn").onclick=openModesHelp;
  wire("gSize","size",v=>{ size=v; document.getElementById("sizeCustom").value=""; savePrefs({size, focus, order, customSize:""}); paintSummary(); });
  wire("gFocus","focus",v=>{ focus=v; paintSummary(); });
  wire("gOrder","order",v=>{ order=v; PLAY.mode=v; paintSummary(); });
  document.getElementById("sizeCustom").oninput=paintSummary;
  paintSummary();
  document.getElementById("startBtn").onclick=()=>{
    const custom=parseInt(document.getElementById("sizeCustom").value,10);
    const finalSize=(custom>0)?custom:size;
    savePrefs({size, focus, order, customSize:(custom>0?custom:"")});
    startSession(finalSize, focus, order);
  };
  document.getElementById("wipeBtn").onclick=wipeProgress;
}

function openModesHelp(){
  const overlay=document.createElement("div");
  overlay.className="modes-overlay";
  overlay.innerHTML=`<div class="modes-modal" role="dialog" aria-label="Uitleg over quiz-modi">
    <div class="modes-hd">
      <div class="modes-title">${ICON.info} Uitleg over alle quiz-modi</div>
      <button class="tetris-close" id="mhClose" aria-label="Sluiten">×</button>
    </div>
    <div class="modes-body">
      <p class="muted">Elke sessie bestaat uit drie keuzes. Hieronder alle mogelijkheden, wanneer je ze best kiest, en hoe ze onderling verschillen.</p>

      <h3>1. Hoeveel vragen?</h3>
      <p>Bepaalt hoe lang je sessie is. Kies een chip (10, 25, 50, 100, alle) of typ zelf een aantal. Meer vragen = langere sessie, maar meer leerkansen.</p>
      <ul>
        <li><strong>10</strong> — korte flashcard-achtige sessie, ideaal in een pauze.</li>
        <li><strong>25</strong> — ± een halfuurtje, sweet spot voor dagelijkse oefening.</li>
        <li><strong>50</strong> — flinke sessie, dieper leerwerk.</li>
        <li><strong>100</strong> — grondige zittings-doorloop.</li>
        <li><strong>Alle</strong> — de volledige quiz in één keer.</li>
        <li><strong>Zelf typen</strong> — voor als je een specifiek aantal wil (bv. 40).</li>
      </ul>
      <p class="tip">💡 Tetris ontgrendel je pas na een sessie van ≥25 vragen én ≥80% juist.</p>

      <h3>2. Welke vragen (focus)?</h3>
      <p>Filtert de vragen op basis van je antwoordhistoriek over álle sessies heen.</p>
      <table class="modes-table">
        <thead><tr><th>Modus</th><th>Wat zit erin</th><th>Wanneer kiezen</th></tr></thead>
        <tbody>
          <tr><td><strong>Alle vragen</strong></td><td>Elke vraag uit de quiz, ongeacht of je hem al zag.</td><td>Voor een frisse doorloop of test op alles.</td></tr>
          <tr><td><strong>Enkel mijn foute</strong></td><td>Vragen waar je huidige antwoord fout op is. Verdwijnen zodra je ze juist beantwoordt.</td><td>Als je snel je foute wil bijwerken tot alles juist staat.</td></tr>
          <tr><td><strong>Nog niet beantwoord</strong></td><td>Vragen die je nog nooit hebt beantwoord in geen enkele sessie.</td><td>Om nieuw materiaal aan te snijden.</td></tr>
          <tr><td><strong>Nog niet juist</strong></td><td>Vragen die je fout had OF nog nooit beantwoordde.</td><td>Als je alles wil zien behalve wat je al juist beheerst.</td></tr>
          <tr><td><strong>Historisch fout</strong></td><td>Élke vraag die je <em>ooit</em> minstens één keer fout beantwoordde — ook als je later juist scoorde. Blijft in de lijst tot 'Voortgang wissen'.</td><td>Om je zwakke plekken te blijven onderhouden.</td></tr>
        </tbody>
      </table>

      <h3>3. In welke volgorde?</h3>
      <p>Bepaalt in welke volgorde de gefilterde vragen aan bod komen.</p>
      <table class="modes-table">
        <thead><tr><th>Modus</th><th>Volgorde</th><th>Waarom kiezen</th></tr></thead>
        <tbody>
          <tr><td><strong>Slim oefenen</strong> <span class="pill juist">aanbevolen</span></td><td>Gewogen willekeur: nog-niet-beantwoord (4×) &gt; fout (3×) &gt; overleg (2×) &gt; juist (1×)</td><td>Optimale mix van nieuw leren en herhaling. Wat je nog niet kent komt vaker, maar juiste vragen blijven af en toe terugkomen tegen vergeten.</td></tr>
          <tr><td><strong>Op nummer</strong></td><td>Vraag 1, 2, 3, … volgens hun nummer in de quiz.</td><td>Als de vragen op een logische leerorde zijn geordend en je die orde wil volgen.</td></tr>
          <tr><td><strong>Willekeurig</strong></td><td>Volledig geschud — élke vraag heeft gelijke kans.</td><td>Om examen-omstandigheden te simuleren waar je vragen in willekeurige volgorde krijgt.</td></tr>
          <tr><td><strong>Fouten eerst</strong></td><td>Deterministisch: eerst alle vragen die je fout had, daarna de rest.</td><td>Als je gefocust je fouten wil bijwerken en er zeker van wil zijn dat ze allemaal aan bod komen.</td></tr>
          <tr><td><strong>Gemiste eerst</strong></td><td>Deterministisch: eerst alle vragen die je nog nooit beantwoordde, daarna de rest.</td><td>Om systematisch nieuwe stof af te werken vóór je terugkeert naar wat je al zag.</td></tr>
          <tr><td><strong>Examen</strong> <span class="pill" style="background:var(--accent-soft);color:var(--accent-dark)">nieuw</span></td><td>Alle vragen van de quiz in vraagnummer-volgorde, zonder feedback per vraag.</td><td>Om te simuleren dat je een echte quiz aflegt: je vult alles in en pas na "Dien in" krijg je één globale score met alle juist/fout te zien.</td></tr>
        </tbody>
      </table>

      <h3>Slim vs Willekeurig — waarom is Slim beter?</h3>
      <p><strong>Willekeurig</strong> geeft élke vraag exact gelijke kans. Juist beantwoorde vragen komen dus even vaak terug als vragen die je nog niet kent — veel tijd verspild aan wat je al beheerst.</p>
      <p><strong>Slim</strong> stopt dat: nieuwe en foute vragen krijgen 3× tot 4× meer kans, terwijl juist beantwoorde vragen zeldzamer terugkomen (spaced-repetition light). Zo optimaliseer je je oefentijd naar wat je nog moet leren.</p>

      <h3>Antwoordvolgorde binnen een vraag</h3>
      <p>De opties (A/B/C/D) worden per vraag <strong>eenmalig willekeurig geschud</strong> bij de eerste weergave in de sessie. Zo train je jezelf op de <em>inhoud</em> van het antwoord, niet op de positie. Bij een nieuwe sessie schudt het opnieuw.</p>

      <h3>Voortgang wissen</h3>
      <p>Onder "Voortgang wissen" reset je enkel je <strong>huidige</strong> antwoordstatus voor deze quiz. Daarna toont "Enkel mijn foute" niets meer, "Nog niet beantwoord" toont weer alles, en "slim oefenen" behandelt élke vraag als nieuw.</p>
      <p>Wat <strong>blijft</strong>: je bijdrage aan de statistieken, de lijst "historisch fout" (je zwakke plekken over alle sessies), je flags en je opmerkingen. Zo verlies je nooit waardevolle data door opnieuw te willen beginnen.</p>
    </div>
    <div class="modes-foot"><button class="btn btn-primary btn-sm" id="mhOk">Begrepen, sluit</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const close=()=>overlay.remove();
  overlay.querySelector("#mhClose").onclick=close;
  overlay.querySelector("#mhOk").onclick=close;
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(); });
  const onKey=e=>{ if(e.key==="Escape"){ close(); window.removeEventListener("keydown",onKey); } };
  window.addEventListener("keydown",onKey);
}

async function wipeProgress(){
  if(!confirm("Je huidige antwoordstatus voor deze quiz wissen? Je krijgt een schone lei om alles opnieuw te beantwoorden. Je bijdrage aan de statistieken en de lijst 'historisch fout' blijven bewaard, net als je flags en opmerkingen.")) return;
  const ids=PLAY.all.map(q=>q.id);
  try{
    if(ids.length) await sb.from("answers").delete().eq("user_id",ME.id).in("question_id",ids);
    toast("Voortgang gewist — statistieken blijven bewaard","ok");
    viewPlay(PLAY.quiz.id);
  }catch(e){ toast("Wissen mislukt: "+e.message,"err"); }
}
function startSession(size, focus, order){
  clearSession(PLAY.quiz.id);
  // Examen dwingt: alle vragen, in vraagnummer-volgorde
  if(order==="examen"){ size="alle"; focus="alle"; }
  PLAY.session={ size, focus, order }; PLAY.mode=order;
  PLAY.examMode = order==="examen";
  PLAY.examSubmitted = false;
  let pool=orderQuestions(poolFor(focus), PLAY.answers, order);
  if(!pool.length){ toast("Geen vragen voor deze keuze.","err"); return; }
  if(size!=="alle"){ const n=parseInt(size,10)||pool.length; pool=pool.slice(0,n); }
  // sessie start blanco — vorige antwoorden blijven in DB voor statistiek/focus
  PLAY.answers={};
  PLAY.optOrder={};
  PLAY.questions=pool; PLAY.i=0; renderQuestion();
}

async function renderQuestion(){
  const q=PLAY.questions[PLAY.i];
  if(!q){ app.innerHTML=`<div class="empty">Deze quiz heeft nog geen vragen.</div>`; return; }
  saveSession();
  const chosen = PLAY.answers[q.id];            // array of undefined
  const answered = chosen!=null;
  const correct = arr(q.correct_indexes);
  const validated = q.validated!==false;
  const multi = q.multi || correct.length>1;
  const examLive = PLAY.examMode && !PLAY.examSubmitted;   // examen loopt: nog geen feedback
  // volgorde van de opties eenmalig door elkaar schudden per sessie
  PLAY.optOrder=PLAY.optOrder||{};
  if(!PLAY.optOrder[q.id]) PLAY.optOrder[q.id]=shuffle((q.options||[]).map((_,i)=>i));
  const order=PLAY.optOrder[q.id];
  const docent=arr(q.docent_indexes);
  const docentDiffers=docent.length>0 && !setEq(docent, correct);
  const opts=order.map((origIdx,pos)=>{
    const o=(q.options||[])[origIdx];
    let cls="opt"; let box="";
    if(examLive){
      // Examen: geen feedback tonen — enkel markeren wat geselecteerd is, opties blijven klikbaar
      if(answered && inSet(chosen,origIdx)) cls+=" selected";
      if(multi) box=`<input type="checkbox" class="mopt" value="${origIdx}" ${answered&&inSet(chosen,origIdx)?"checked":""} style="width:auto;margin-top:.15rem">`;
    } else if(answered){ cls+=" disabled";
      // Toon altijd het juiste antwoord (groen) en de foute keuze (rood) — ook bij niet-gevalideerde
      // vragen zien spelers zo wat er als juist bedoeld is, met het pill "in overleg" als vlag.
      if(correct.includes(origIdx)) cls+=" correct";
      else if(inSet(chosen,origIdx)) cls+=" wrong";
      if(docentDiffers && docent.includes(origIdx)) cls+=" docent";
    }
    else if(multi){ box=`<input type="checkbox" class="mopt" value="${origIdx}" style="width:auto;margin-top:.15rem">`; }
    const showBadges = answered && !examLive;
    const docentBadge = showBadges && docentDiffers && docent.includes(origIdx) ? `<span class="opt-doc" title="Volgens de docent">👨‍🏫</span>` : "";
    const correctBadge = showBadges && correct.includes(origIdx) ? srcBadge(validated?"Juist antwoord":"Bedoeld als juist — nog in overleg", q.answer_source) : "";
    return `<div class="${cls}" data-opt="${origIdx}">${box}<span class="letter">${letter(pos)}</span><span>${esc(o)} ${correctBadge}${docentBadge}</span></div>`;
  }).join("");
  // voortgang
  const total=PLAY.questions.length;
  const answeredN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null).length;
  const correctN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===true).length;
  const wrongN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===false).length;
  const overlegN=PLAY.questions.filter(x=>PLAY.answers[x.id]!=null && x.validated===false).length;
  const allDone=answeredN===total;
  const unanswered=PLAY.questions.filter(x=>PLAY.answers[x.id]==null).length;
  app.innerHTML=`
    <div class="spread">
      <div><a class="muted" data-nav="#/">← Quizzen</a> &nbsp;·&nbsp; <a class="muted" id="newSession">Nieuwe sessie</a> &nbsp;·&nbsp; <a class="muted" data-nav="#/quiz/${PLAY.quiz.id}/overzicht">Overzicht</a></div>
      <div class="muted">Vraag ${PLAY.i+1} / ${total}</div>
    </div>
    <h1 style="font-size:1.2rem;margin:.6rem 0 .4rem">${esc(PLAY.quiz.title)}</h1>
    ${PLAY.investigating ? `<div class="investigate-banner">
      🔍 <strong>Je onderzoekt een enkele vraag</strong> <span class="muted">— geen sessie, geen scoring. Klik "Nieuwe sessie" om echt te oefenen.</span>
    </div>` : (examLive ? `<div class="progress exam-progress">
      <div class="muted" style="font-size:.75rem;margin-bottom:.15rem">📝 Examen-modus — feedback verschijnt na indienen</div>
      <div class="progress-line">
        <div class="bar" style="flex:1"><span style="width:${pct(answeredN,total)}%"></span><div class="lab">Ingevuld ${answeredN}/${total}</div></div>
        ${allDone?`<span class="pill" style="background:var(--accent-soft);color:var(--accent-dark);white-space:nowrap">Klaar om in te dienen</span>`:""}
      </div>
    </div>` : `<div class="progress">
      <div class="muted" style="font-size:.75rem;margin-bottom:.15rem">Voortgang in deze sessie</div>
      <div class="progress-line">
        <div class="bar" style="flex:1"><span style="width:${pct(answeredN,total)}%"></span><div class="lab">Beantwoord ${answeredN}/${total}</div></div>
        <div class="progress-dots" title="Juist / Fout${overlegN?" / In overleg":""} / Nog te doen">
          <span class="dot-count"><span class="dot ok"></span>${correctN}</span>
          <span class="dot-count"><span class="dot bad"></span>${wrongN}</span>
          ${overlegN?`<span class="dot-count"><span class="dot warn"></span>${overlegN}</span>`:""}
          <span class="dot-count"><span class="dot none"></span>${unanswered}</span>
        </div>
        ${allDone?`<span class="pill" style="background:var(--correct-soft);color:var(--correct);white-space:nowrap">${ICON.check} Sessie voltooid</span>`:""}
      </div>
    </div>`)}
    <div class="btnrow" style="margin-bottom:.8rem">
      <button class="btn btn-ghost btn-sm" id="prevBtn" ${PLAY.i===0?"disabled":""}>← Vorige</button>
      <button class="btn btn-ghost btn-sm" id="nextBtn" ${PLAY.i>=total-1?"disabled":""}>Volgende →</button>
      ${PLAY.investigating ? "" : (examLive
        ? (unanswered?`<button class="btn btn-ghost btn-sm" id="nextUnans">Volgende onbeantwoorde →</button><button class="btn btn-primary btn-sm" id="submitExamBtn" ${allDone?"":"disabled"} title="${allDone?"Dien in en zie je score":"Beantwoord eerst alle vragen"}">Dien in ${allDone?"":"("+answeredN+"/"+total+")"} →</button>`:`<button class="btn btn-primary btn-sm" id="submitExamBtn">Dien in en zie score →</button>`)
        : (unanswered?`<button class="btn btn-primary btn-sm" id="nextUnans">Volgende in deze sessie →</button>`:`<button class="btn btn-primary btn-sm" id="doneBtn">Bekijk resultaat →</button>`))}
      ${isEditor()?`<button class="btn btn-ghost btn-sm" id="editQ" style="margin-left:auto">Bewerk deze vraag</button>`:""}
    </div>
    <div class="card">
      <div class="q-meta"><span class="q-num">Vraag ${q.qnum}</span>${examLive?"":questionTags(q)}${examLive?(answered?`<span class="pill" style="background:var(--accent-soft);color:var(--accent-dark)">antwoord genoteerd</span>`:""):(answered?(isRight(q,chosen)===true?`<span class="pill juist">juist beantwoord</span>`:isRight(q,chosen)===false?`<span class="pill fout">fout beantwoord</span>`:`<span class="pill twijfel">antwoord genoteerd — in overleg</span>`):((PLAY.history&&PLAY.history[q.id]!=null)?(isRight(q,PLAY.history[q.id])===true?`<span class="pill" style="background:var(--correct-soft);color:var(--correct);opacity:.75">eerder juist</span>`:isRight(q,PLAY.history[q.id])===false?`<span class="pill" style="background:var(--wrong-soft);color:var(--wrong);opacity:.75">eerder fout</span>`:`<span class="pill" style="background:var(--warn-soft);color:var(--warn);opacity:.75">eerder beantwoord</span>`):`<span class="pill" style="background:var(--surface2);color:var(--text-muted)">nieuwe vraag voor jou</span>`))}</div>
      <div class="q-text">${esc(q.text)}</div>
      ${q.image_url?`<div class="q-image"><img src="${esc(q.image_url)}" alt="Afbeelding bij vraag ${q.qnum}" loading="lazy"></div>`:""}
      ${(!answered && (q.wettekst || q.legal_basis)) ? `<details class="prehelp"><summary>${ICON.info} Raadpleeg wettekst voor je antwoordt</summary>
        <div class="prehelp-body">
          ${q.legal_basis?`<div class="prehelp-legal"><strong>Wettelijke basis:</strong> ${html(translateOptRefs(q.legal_basis, q.id, q))}</div>`:""}
          ${q.wettekst?`<div class="wettekst">${html(translateOptRefs(q.wettekst, q.id, q))}</div>`:""}
        </div></details>`:""}
      ${renderQBody(q, chosen, answered, examLive, opts, multi)}
      <div id="afterAnswer"></div>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("prevBtn").onclick=()=>{ if(PLAY.i>0){PLAY.i--;renderQuestion();} };
  document.getElementById("nextBtn").onclick=()=>{ if(PLAY.i<total-1){PLAY.i++;renderQuestion();} };
  const nu=document.getElementById("nextUnans");
  if(nu) nu.onclick=()=>{
    let j=-1;
    for(let k=1;k<=total;k++){ const idx=(PLAY.i+k)%total; if(PLAY.answers[PLAY.questions[idx].id]==null){ j=idx; break; } }
    if(j>=0){ PLAY.i=j; renderQuestion(); } else toast("Alle vragen beantwoord","ok");
  };
  const nsBtn=document.getElementById("newSession");
  if(nsBtn) nsBtn.onclick=()=>viewPlay(PLAY.quiz.id);
  const eqBtn=document.getElementById("editQ");
  if(eqBtn) eqBtn.onclick=()=>go("#/beheer/vraag/"+q.id);
  const dBtn=document.getElementById("doneBtn");
  if(dBtn) dBtn.onclick=()=>renderPlayDone();
  const seb=document.getElementById("submitExamBtn");
  if(seb && !seb.disabled) seb.onclick=()=>submitExam();
  app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{
    if(PLAY.mode===b.dataset.mode) return;
    PLAY.mode=b.dataset.mode;
    const curId=PLAY.questions[PLAY.i].id;
    PLAY.questions=orderQuestions(PLAY.questions, PLAY.answers, PLAY.mode);
    PLAY.i=Math.max(0, PLAY.questions.findIndex(x=>x.id===curId));
    renderQuestion();
  });
  // === Type-specifieke bediening ===
  if(q.question_type==="matrix"){ wireMatrixBody(q, chosen, answered, examLive); return; }
  if(q.question_type==="open"){   wireOpenBody(q, chosen, answered, examLive);   return; }

  if(examLive){
    // Examen: multi = checkbox-set commit met "Bevestig"; single = klik = zet antwoord (lokaal)
    if(multi){
      const syncChosen=()=>app.querySelectorAll("[data-opt]").forEach(el=>{
        const cb=el.querySelector(".mopt"); el.classList.toggle("chosen", !!(cb&&cb.checked));
      });
      app.querySelectorAll("[data-opt]").forEach(el=>el.onclick=e=>{
        if(e.target.tagName!=="INPUT"){ const cb=el.querySelector(".mopt"); if(cb) cb.checked=!cb.checked; }
        syncChosen();
      });
      syncChosen();
      const cm=document.getElementById("checkMulti");
      if(cm){ cm.textContent="Bevestig antwoord"; cm.onclick=()=>{
        const sel=[...app.querySelectorAll(".mopt:checked")].map(c=>+c.value);
        if(!sel.length) return toast("Kruis minstens één antwoord aan","err");
        examSetAnswer(q, sel);
      }; }
    } else {
      app.querySelectorAll("[data-opt]").forEach(o=>o.onclick=()=>examSetAnswer(q, [+o.dataset.opt]));
    }
    return;
  }
  if(answered){ renderAfterAnswer(q); }
  else if(multi){
    const syncChosen=()=>app.querySelectorAll("[data-opt]").forEach(el=>{
      const cb=el.querySelector(".mopt"); el.classList.toggle("chosen", !!(cb&&cb.checked));
    });
    app.querySelectorAll("[data-opt]").forEach(el=>el.onclick=e=>{
      if(e.target.tagName!=="INPUT"){ const cb=el.querySelector(".mopt"); if(cb) cb.checked=!cb.checked; }
      syncChosen();
    });
    document.getElementById("checkMulti").onclick=()=>{
      const sel=[...app.querySelectorAll(".mopt:checked")].map(c=>+c.value);
      if(!sel.length) return toast("Kruis minstens één antwoord aan","err");
      answerQuestion(q, sel);
    };
  }
  else app.querySelectorAll("[data-opt]").forEach(o=>o.onclick=()=>answerQuestion(q, [+o.dataset.opt]));
}

/* ============================================================
   Body-rendering per vraag-type
   ============================================================ */
function renderQBody(q, chosen, answered, examLive, mcqOpts, multi){
  if(q.question_type==="matrix") return renderMatrixBody(q, chosen, answered, examLive);
  if(q.question_type==="open")   return renderOpenBody(q, chosen, answered, examLive);
  return `<div id="opts">${mcqOpts}</div>
    ${(multi && (examLive || !answered))?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="checkMulti">${examLive?"Bevestig antwoord":"Nakijken"}</button></div>`:""}`;
}

function renderMatrixBody(q, chosen, answered, examLive){
  const rows=arr(q.matrix_rows), cols=arr(q.matrix_cols), correct=arr(q.matrix_correct);
  const sel = Array.isArray(chosen) ? chosen : new Array(rows.length).fill(-1);
  const showFeedback = answered && !examLive;
  const head=`<tr><th></th>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
  const body=rows.map((rLabel,ri)=>{
    const cells=cols.map((_,ci)=>{
      const chosenHere = sel[ri]===ci;
      const isCorrect = correct[ri]===ci;
      let cls="matrix-cell";
      if(chosenHere) cls+=" chosen";
      if(showFeedback){
        if(isCorrect) cls+=" correct";
        else if(chosenHere) cls+=" wrong";
      }
      const disabled = answered && !examLive ? "disabled" : "";
      const checked = chosenHere ? "checked" : "";
      return `<td class="${cls}" data-row="${ri}" data-col="${ci}">
        <label><input type="radio" name="mx-${q.id}-r${ri}" value="${ci}" ${checked} ${disabled}></label>
      </td>`;
    }).join("");
    return `<tr><th class="matrix-row-label">${esc(rLabel)}</th>${cells}</tr>`;
  }).join("");
  const showBtn = examLive || !answered;
  const btnLabel = examLive ? "Bevestig antwoord" : "Nakijken";
  return `<div class="matrix-wrap"><table class="matrix-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>
    ${showBtn?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="submitMatrix">${btnLabel}</button></div>`:""}`;
}

function renderOpenBody(q, chosen, answered, examLive){
  const val = typeof chosen==="string" ? chosen : "";
  const showFeedback = answered && !examLive;
  const isCorrect = showFeedback ? isRight(q, val) : null;
  const readOnly = answered && !examLive;
  return `<div class="open-wrap">
      <textarea id="openAnswer" class="open-answer" rows="4" placeholder="Typ hier je antwoord…" ${readOnly?"readonly":""}>${esc(val)}</textarea>
      ${(!examLive && answered)?`<div class="open-feedback ${isCorrect===true?"ok":isCorrect===false?"bad":"warn"}">
        ${isCorrect===true?`${ICON.check} Je antwoord komt exact overeen met het modelantwoord.`
          :isCorrect===false?`Je antwoord wijkt af van het modelantwoord — bekijk hieronder de vergelijking.`
          :`Je antwoord is bewaard. Er is ${q.open_answer?"een modelantwoord dat afwijkt":"geen modelantwoord"} — deze vraag wordt als <strong>in overleg</strong> geteld.`}
      </div>`:""}
    </div>
    ${(examLive || !answered)?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="submitOpen">${examLive?"Bevestig antwoord":"Antwoord indienen"}</button></div>`:""}`;
}

function wireMatrixBody(q, chosen, answered, examLive){
  const rows=arr(q.matrix_rows);
  const readSel=()=>{
    const sel=new Array(rows.length).fill(-1);
    for(let ri=0;ri<rows.length;ri++){
      const checked=app.querySelector(`input[name="mx-${q.id}-r${ri}"]:checked`);
      if(checked) sel[ri]=+checked.value;
    }
    return sel;
  };
  // Klik op een cel = radio toggelen (grotere clickable target)
  app.querySelectorAll(".matrix-cell").forEach(td=>{
    td.onclick=e=>{
      if(answered && !examLive) return;
      if(e.target.tagName!=="INPUT"){
        const inp=td.querySelector("input");
        if(inp){ inp.checked=true; inp.dispatchEvent(new Event("change",{bubbles:true})); }
      }
      // markeer visueel
      const ri=+td.dataset.row;
      app.querySelectorAll(`.matrix-cell[data-row="${ri}"]`).forEach(x=>x.classList.remove("chosen"));
      td.classList.add("chosen");
    };
  });
  const btn=document.getElementById("submitMatrix");
  if(btn){
    btn.onclick=()=>{
      const sel=readSel();
      if(sel.every(v=>v<0)) return toast("Duid minstens één rij aan","err");
      if(examLive) examSetAnswer(q, sel);
      else answerQuestion(q, sel);
    };
  }
  if(answered && !examLive) renderAfterAnswer(q);
}

function wireOpenBody(q, chosen, answered, examLive){
  const ta=document.getElementById("openAnswer");
  const btn=document.getElementById("submitOpen");
  if(btn){
    btn.onclick=()=>{
      const v=(ta&&ta.value||"").trim();
      if(!v) return toast("Typ eerst je antwoord","err");
      if(examLive) examSetAnswer(q, v);
      else answerQuestion(q, v);
    };
  }
  if(answered && !examLive) renderAfterAnswer(q);
}

function examSetAnswer(q, idxArrayOrText){
  let chosen;
  if(q.question_type==="open"){
    chosen = String(idxArrayOrText||"").trim();
    if(!chosen) return;
  } else if(q.question_type==="matrix"){
    chosen = arr(idxArrayOrText).slice();       // volgorde = rij-index, NIET sorteren
  } else {
    chosen = arr(idxArrayOrText).slice().sort((a,b)=>a-b);
  }
  PLAY.answers[q.id]=chosen;
  // Ga direct naar de volgende onbeantwoorde vraag, of blijf hier als alles klaar is
  const total=PLAY.questions.length;
  let j=-1;
  for(let k=1;k<=total;k++){ const idx=(PLAY.i+k)%total; if(PLAY.answers[PLAY.questions[idx].id]==null){ j=idx; break; } }
  if(j>=0) PLAY.i=j;
  renderQuestion();
}

async function submitExam(){
  const qs=PLAY.questions;
  const unanswered=qs.filter(x=>PLAY.answers[x.id]==null).length;
  if(unanswered>0){
    if(!confirm(`Je hebt nog ${unanswered} vraag/vragen niet beantwoord. Toch indienen?`)) return;
  }
  const submitBtn=document.getElementById("submitExamBtn");
  if(submitBtn){ submitBtn.disabled=true; submitBtn.textContent="Indienen…"; }
  const now=new Date().toISOString();
  const answersRows=qs.filter(x=>PLAY.answers[x.id]!=null).map(x=>{
    const c=PLAY.answers[x.id];
    if(x.question_type==="open"){
      return { question_id:x.id, user_id:ME.id, chosen_indexes:[], open_answer_text:String(c||""), is_correct:isRight(x,c), updated_at:now };
    }
    return { question_id:x.id, user_id:ME.id, chosen_indexes:c, is_correct:isRight(x,c), updated_at:now };
  });
  const eventsRows=qs.filter(x=>PLAY.answers[x.id]!=null).map(x=>{
    const c=PLAY.answers[x.id];
    return { question_id:x.id, quiz_id:PLAY.quiz.id, user_id:ME.id, is_correct:isRight(x,c) };
  });
  try{
    if(answersRows.length){
      const { error:e1 } = await sb.from("answers").upsert(answersRows,{ onConflict:"question_id,user_id" });
      if(e1) throw e1;
      const { error:e2 } = await sb.from("answer_events").insert(eventsRows);
      if(e2) throw e2;
    }
  }catch(e){
    toast("Indienen mislukt: "+e.message,"err");
    if(submitBtn){ submitBtn.disabled=false; submitBtn.textContent="Dien in en zie score →"; }
    return;
  }
  PLAY.examSubmitted=true;
  renderPlayDone();
}

async function answerQuestion(q, idxArrayOrText){
  if(PLAY.answering) return;
  PLAY.answering=true;
  app.querySelectorAll("[data-opt],#checkMulti,#submitOpen,.matrix-cell").forEach(el=>el.style.pointerEvents="none");
  let chosen, dbRow;
  if(q.question_type==="open"){
    chosen = String(idxArrayOrText||"").trim();
    if(!chosen){ PLAY.answering=false; toast("Typ eerst je antwoord","err"); return; }
    const is_correct = isRight(q, chosen);
    dbRow = { question_id:q.id, user_id:ME.id, chosen_indexes:[], open_answer_text:chosen, is_correct, updated_at:new Date().toISOString() };
  } else if(q.question_type==="matrix"){
    // idxArrayOrText = array met per rij de gekozen kolom-index (of -1)
    chosen = arr(idxArrayOrText).slice();
    const is_correct = isRight(q, chosen);
    dbRow = { question_id:q.id, user_id:ME.id, chosen_indexes:chosen, open_answer_text:null, is_correct, updated_at:new Date().toISOString() };
  } else {
    chosen = arr(idxArrayOrText).slice().sort((a,b)=>a-b);
    const is_correct = isRight(q, chosen);
    dbRow = { question_id:q.id, user_id:ME.id, chosen_indexes:chosen, is_correct, updated_at:new Date().toISOString() };
  }
  try{
    const { error:e1 } = await sb.from("answers").upsert(dbRow,{ onConflict:"question_id,user_id" });
    if(e1) throw e1;
    await sb.from("answer_events").insert({ question_id:q.id, quiz_id:PLAY.quiz.id, user_id:ME.id, is_correct:dbRow.is_correct });
  }
  catch(e){ toast("Antwoord niet opgeslagen: "+e.message,"err"); PLAY.answering=false; renderQuestion(); return; }
  PLAY.answers[q.id]=chosen;
  PLAY.answering=false;
  const allAnswered = PLAY.questions.every(x=>PLAY.answers[x.id]!=null);
  if(allAnswered) renderPlayDone(); else renderQuestion();
}

function renderPlayDone(){
  clearSession(PLAY.quiz.id);
  const qs=PLAY.questions;
  const correct=qs.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===true).length;
  const wrong=qs.filter(x=>PLAY.answers[x.id]!=null && isRight(x,PLAY.answers[x.id])===false).length;
  const overleg=qs.filter(x=>PLAY.answers[x.id]!=null && x.validated===false).length;
  const scored=correct+wrong;
  const p=scored?Math.round(correct/scored*100):0;
  let title,msg,cls;
  if(!scored){ title="Sessie voltooid"; msg="Deze vragen hebben (nog) geen gevalideerd antwoord, dus geen score. Bedankt voor je input — die helpt om het juiste antwoord te bepalen!"; cls="ok"; }
  else if(p>=90){ title="Uitstekend — proficiat!"; msg="Je beheerst deze stof al heel goed. Blijf scherp en houd dit niveau vast."; cls="ok"; }
  else if(p>=75){ title="Sterk bezig!"; msg="Nog een paar puntjes en het zit helemaal goed. Neem de foute vragen even door en je bent er."; cls="ok"; }
  else if(p>=50){ title="Goed op weg"; msg="Herhaal vooral je foute vragen — met wat extra oefening ga je er snel op vooruit. Doorzetten!"; cls="warn"; }
  else { title="Blijven oefenen!"; msg="Niet ontmoedigd raken — bekijk de uitleg bij de foute vragen en probeer opnieuw. Je raakt er wel. Zet 'm op!"; cls="warn"; }
  app.innerHTML=`
    <div class="done-card">
      <div class="done-score ${cls}">${scored?p+"%":"✓"}</div>
      <h1>${esc(title)}</h1>
      <p class="muted">${esc(msg)}</p>
      <div class="done-stats">
        <span><span class="dot ok"></span> Juist: ${correct}</span>
        <span><span class="dot bad"></span> Fout: ${wrong}</span>
        ${overleg?`<span><span class="dot warn"></span> In overleg: ${overleg}</span>`:""}
      </div>
      <div class="muted" style="font-size:.8rem;margin-top:.4rem">${scored} beoordeeld · ${qs.length} vragen in deze sessie</div>
      <div class="btnrow" style="justify-content:center;margin-top:1.3rem">
        ${wrong?`<button class="btn btn-primary" id="againWrong">Oefen je foute vragen</button>`:""}
        <button class="btn btn-ghost" id="againNew">Nieuwe sessie</button>
        <a class="btn btn-ghost" data-nav="#/">Naar quizzen</a>
      </div>
      <div style="margin-top:1rem"><a class="ilink" id="scrollToReview" style="font-size:.85rem">↓ Bekijk gedetailleerd overzicht van alle vragen</a></div>
      ${(()=>{
        const list=activeGames();
        if(!list.length) return "";
        const rewardGames=list.filter(g=>!(GAMES_CFG[g.id]&&GAMES_CFG[g.id].free));
        if(!rewardGames.length) return "";
        const anyOk=rewardGames.some(g=>gateSatisfied(g.id, qs.length, p));
        const btns=rewardGames.map(g=>{
          const ok=gateSatisfied(g.id, qs.length, p);
          const desc=gateDescription(g.id);
          return `<button class="btn btn-ghost btn-sm" data-brain="${g.id}" ${ok?"":"disabled"} title="${ok?"Speel "+esc(g.name):"Vergrendeld — "+esc(desc||"voorwaarde niet gehaald")}">${g.icon} ${esc(g.name)} ${ok?"":"🔒"}</button>`;
        }).join(" ");
        const hint = anyOk
          ? "Je hebt een pauze verdiend 🎉"
          : `Ontgrendel deze games door de voorwaarde te halen: ${rewardGames.map(g=>{const d=gateDescription(g.id);return `${g.icon} ${esc(g.name)}${d?` (${esc(d)})`:""}`;}).join(" · ")}`;
        return `<div class="brain-break">
          <div class="muted" style="font-size:.82rem;margin-bottom:.4rem">${hint}</div>
          <div class="btnrow" style="justify-content:center;flex-wrap:wrap">${btns}</div>
        </div>`;
      })()}
    </div>

    <div class="done-review">
      <div class="spread" style="margin-bottom:.5rem;gap:.6rem;flex-wrap:wrap">
        <h2 style="margin:0;font-size:1.05rem">📋 Overzicht van deze sessie</h2>
        <div class="btnrow" style="margin:0;gap:.35rem;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" id="rvFilterAll" data-rvf="alle">Alle (${qs.length})</button>
          <button class="btn btn-ghost btn-sm" id="rvFilterWrong" data-rvf="fout">Enkel fout (${wrong})</button>
          <button class="btn btn-ghost btn-sm" id="rvExpandAll" title="Klap alle vragen open">↧ Alles open</button>
          <button class="btn btn-ghost btn-sm" id="rvCollapseAll" title="Klap alle vragen dicht">↥ Alles dicht</button>
        </div>
      </div>
      <p class="muted" style="font-size:.8rem;margin-bottom:.6rem">Foute antwoorden staan meteen open zodat je meteen kan bijsturen. Klik een andere vraag open om de uitleg en het juiste antwoord te bekijken.</p>
      <div class="stack" id="rvList">${renderDoneReview(qs, "alle")}</div>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const aw=document.getElementById("againWrong"); if(aw) aw.onclick=()=>startSession("alle","foute",PLAY.mode||"slim");
  document.getElementById("againNew").onclick=()=>viewPlay(PLAY.quiz.id);
  app.querySelectorAll("[data-brain]").forEach(b=>{ if(b.disabled) return; b.onclick=()=>{ const g=GAMES.find(x=>x.id===b.dataset.brain); if(g && typeof g.open==="function") g.open(); }; });
  app.querySelectorAll("[data-rvf]").forEach(b=>b.onclick=()=>{
    const f=b.dataset.rvf;
    app.querySelectorAll("[data-rvf]").forEach(x=>x.classList.toggle("active", x===b));
    document.getElementById("rvList").innerHTML=renderDoneReview(qs, f);
    wireDoneReview();
  });
  document.getElementById("rvFilterAll").classList.add("active");
  const expandAll=document.getElementById("rvExpandAll");
  const collapseAll=document.getElementById("rvCollapseAll");
  if(expandAll) expandAll.onclick=()=>document.querySelectorAll("#rvList details.rv-item").forEach(d=>d.open=true);
  if(collapseAll) collapseAll.onclick=()=>document.querySelectorAll("#rvList details.rv-item").forEach(d=>d.open=false);
  const scrollBtn=document.getElementById("scrollToReview");
  if(scrollBtn) scrollBtn.onclick=e=>{
    e.preventDefault();
    const el=document.querySelector(".done-review");
    if(el) el.scrollIntoView({behavior:"smooth", block:"start"});
  };
  wireDoneReview();
}

function renderDoneReview(qs, filter){
  const rows=qs.filter(q=>{
    if(filter!=="fout") return true;
    return PLAY.answers[q.id]!=null && isRight(q,PLAY.answers[q.id])===false;
  });
  if(!rows.length) return `<p class="muted">Geen vragen om te tonen.</p>`;
  return rows.map(q=>{
    const chosen=PLAY.answers[q.id];
    const answered=chosen!=null;
    const correct=arr(q.correct_indexes);
    const docent=arr(q.docent_indexes);
    const docentDiffers=docent.length>0 && !setEq(docent,correct);
    const validated=q.validated!==false;
    const status = !answered ? "onbeantwoord"
                  : validated ? (isRight(q,chosen)===true ? "juist" : "fout")
                  : "overleg";
    const statusPill = status==="juist"?`<span class="pill juist">juist</span>`
      : status==="fout"?`<span class="pill fout">fout</span>`
      : status==="overleg"?`<span class="pill twijfel">overleg</span>`
      : `<span class="pill" style="background:var(--surface2);color:var(--text-muted)">niet beantwoord</span>`;
    const correctStr = correct.length ? lettersOf(correct) : "—";
    const yourStr = answered ? lettersOf(chosen) : "—";
    return `<details class="rv-item ${status}" ${status==="fout"?"open":""}>
      <summary>
        <div class="rv-sum">
          <span class="q-num">${q.qnum}</span>
          <span class="rv-text">${esc((q.text||"").slice(0,140))}${(q.text||"").length>140?"…":""}</span>
          <span class="rv-status">${statusPill}</span>
        </div>
        <div class="rv-meta">
          <span>Juist: <strong>${correctStr}</strong></span>
          <span>Jij: <strong>${yourStr}</strong></span>
          ${docentDiffers?`<span>👨‍🏫 Docent: <strong>${lettersOf(docent)}</strong></span>`:""}
        </div>
      </summary>
      <div class="rv-body">
        <div class="rv-opts">${(q.options||[]).map((o,i)=>{
          let cls="rv-opt";
          if(correct.includes(i)) cls+=" correct";
          if(answered && inSet(chosen,i) && !correct.includes(i)) cls+=" wrong";
          if(docentDiffers && docent.includes(i)) cls+=" docent";
          const juistPill = correct.includes(i) ? `<span class="pill ${validated?"juist":"twijfel"}" style="margin-left:.3rem">${validated?"juist":"bedoeld — in overleg"}</span>` : "";
          return `<div class="${cls}"><strong>${letter(i)}.</strong> ${esc(o)}${juistPill}${docentDiffers&&docent.includes(i)?' <span class="pill" style="margin-left:.3rem;background:rgba(192,38,211,.12);color:#a21caf">docent</span>':""}</div>`;
        }).join("")}</div>
        ${q.explanation?`<div class="rv-explain"><strong>Uitleg:</strong> ${srcBadge("Uitleg",q.explanation_source)} ${html(translateOptRefs(q.explanation, q.id, q))}</div>`:""}
        ${q.legal_basis?`<div class="rv-legal"><strong>Wettelijke basis:</strong> ${srcBadge("Wettelijke basis",q.legal_basis_source)} ${html(translateOptRefs(q.legal_basis, q.id, q))}</div>`:""}
        ${q.docent_note && docentDiffers ? `<div class="rv-docent"><strong>Docent-toelichting:</strong> ${esc(translateOptRefs(q.docent_note, q.id, q))}</div>`:""}
        ${q.wettekst?`<details class="rv-wettekst"><summary>${ICON.info} Toon volledige wettekst</summary><div class="wettekst">${html(translateOptRefs(q.wettekst, q.id, q))}</div></details>`:""}
        <div class="btnrow" style="margin-top:.6rem"><button class="btn btn-ghost btn-sm" data-goq="${q.id}">Open deze vraag →</button></div>
      </div>
    </details>`;
  }).join("");
}

function wireDoneReview(){
  app.querySelectorAll("[data-goq]").forEach(b=>b.onclick=()=>PLAY_goto(PLAY.quiz.id, b.dataset.goq));
}

/* ============================================================
   BRAIN BREAK — Tetris (canvas, keyboard + touch)
   ============================================================ */
function openTetris(){
  const HS_KEY="quiztet_tetris_hs";
  const COLS=10, ROWS=20, CELL=24;
  const COLORS=["#0f172a","#22d3ee","#facc15","#a855f7","#22c55e","#ef4444","#3b82f6","#f97316"];
  const PIECES={
    I:{c:1,m:[[0,0,0,0],[1,1,1,1],[0,0,0,0],[0,0,0,0]]},
    O:{c:2,m:[[2,2],[2,2]]},
    T:{c:3,m:[[0,3,0],[3,3,3],[0,0,0]]},
    S:{c:4,m:[[0,4,4],[4,4,0],[0,0,0]]},
    Z:{c:5,m:[[5,5,0],[0,5,5],[0,0,0]]},
    J:{c:6,m:[[6,0,0],[6,6,6],[0,0,0]]},
    L:{c:7,m:[[0,0,7],[7,7,7],[0,0,0]]},
  };
  const NAMES=Object.keys(PIECES);
  const overlay=document.createElement("div");
  overlay.className="tetris-overlay";
  overlay.innerHTML=`
    <div class="tetris-modal" role="dialog" aria-label="Tetris">
      <div class="tetris-hd">
        <div class="tetris-title">🧱 Even pauze — Tetris</div>
        <button class="tetris-close" id="txClose" aria-label="Sluiten">×</button>
      </div>
      <div class="tetris-body">
        <canvas id="txCanvas" width="${COLS*CELL}" height="${ROWS*CELL}"></canvas>
        <div class="tetris-side">
          <div class="tetris-stats">
            <div class="tetris-stat"><label>Score</label><div id="txScore">0</div></div>
            <div class="tetris-stat"><label>Lijnen</label><div id="txLines">0</div></div>
            <div class="tetris-stat"><label>Level</label><div id="txLevel">1</div></div>
            <div class="tetris-stat"><label>Highscore</label><div id="txHi">0</div></div>
          </div>
          <div class="tetris-next"><label>Volgende</label><canvas id="txNext" width="80" height="80"></canvas></div>
          <div class="tetris-help muted">
            <div>← → links/rechts</div>
            <div>↑ draaien · ↓ sneller</div>
            <div>spatie plonsen · P pauze</div>
          </div>
        </div>
      </div>
      <div class="tetris-touch">
        <button data-act="L" aria-label="Links">←</button>
        <button data-act="rot" aria-label="Draaien">↻</button>
        <button data-act="D" aria-label="Sneller">↓</button>
        <button data-act="drop" aria-label="Plonsen">⤓</button>
        <button data-act="R" aria-label="Rechts">→</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ctx=overlay.querySelector("#txCanvas").getContext("2d");
  const nctx=overlay.querySelector("#txNext").getContext("2d");
  const DIFF=gameDifficulty("tetris");
  const START_DROP = DIFF==="easy" ? 1000 : DIFF==="hard" ? 550 : 800;
  const board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  let piece=null, next=null, score=0, lines=0, level=1;
  let dropInterval=START_DROP, dropTimer=0, lastTime=0, paused=false, over=false;
  let hi=parseInt(localStorage.getItem(HS_KEY)||"0",10);
  const rand=()=>{ const k=NAMES[Math.floor(Math.random()*NAMES.length)]; const p=PIECES[k]; return {c:p.c, m:p.m.map(r=>r.slice()), x:Math.floor((COLS-p.m[0].length)/2), y:0}; };
  const collide=(p,dx=0,dy=0,m=p.m)=>{ for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++){ if(!m[r][c]) continue; const x=p.x+c+dx, y=p.y+r+dy; if(x<0||x>=COLS||y>=ROWS) return true; if(y>=0 && board[y][x]) return true; } return false; };
  const rotate=m=>{ const N=m.length, M=m[0].length; const nm=Array.from({length:M},()=>Array(N).fill(0)); for(let r=0;r<N;r++) for(let c=0;c<M;c++) nm[c][N-1-r]=m[r][c]; return nm; };
  const merge=()=>{ for(let r=0;r<piece.m.length;r++) for(let c=0;c<piece.m[r].length;c++){ if(piece.m[r][c] && piece.y+r>=0) board[piece.y+r][piece.x+c]=piece.m[r][c]; } };
  const clearLines=()=>{ let n=0; for(let r=ROWS-1;r>=0;r--){ if(board[r].every(v=>v)){ board.splice(r,1); board.unshift(Array(COLS).fill(0)); n++; r++; } } if(n){ const pts=[0,100,300,500,800][n]||0; score+=pts*level; lines+=n; level=1+Math.floor(lines/10); dropInterval=Math.max(DIFF==="hard"?50:80, START_DROP-(level-1)*70); } };
  const submitScore=async(s,ls,lv)=>{ if(!ME||s<=0) return; try{ await sb.from("tetris_scores").insert({ user_id:ME.id, score:s, lines:ls, level:lv }); }catch(e){} };
  const spawn=()=>{ piece=next||rand(); next=rand(); if(collide(piece)){ over=true; if(score>hi){ hi=score; try{ localStorage.setItem(HS_KEY,String(hi)); }catch(e){} } submitScore(score,lines,level); } };
  const softDrop=()=>{ if(collide(piece,0,1)){ merge(); clearLines(); spawn(); } else piece.y++; };
  const hardDrop=()=>{ let d=0; while(!collide(piece,0,1)){ piece.y++; d++; } score+=2*d; merge(); clearLines(); spawn(); };
  const move=dx=>{ if(!collide(piece,dx,0)) piece.x+=dx; };
  const tryRotate=()=>{ const rm=rotate(piece.m); if(!collide(piece,0,0,rm)){ piece.m=rm; return; } for(const dx of [-1,1,-2,2]) if(!collide(piece,dx,0,rm)){ piece.x+=dx; piece.m=rm; return; } };
  const drawCell=(cx,x,y,c)=>{ cx.fillStyle=COLORS[c]; cx.fillRect(x,y,CELL-1,CELL-1); cx.strokeStyle="rgba(0,0,0,.25)"; cx.strokeRect(x+.5,y+.5,CELL-2,CELL-2); };
  const draw=()=>{
    ctx.fillStyle=COLORS[0]; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++) if(board[r][c]) drawCell(ctx,c*CELL,r*CELL,board[r][c]);
    if(piece && !over){
      let g=0; while(!collide(piece,0,g+1)) g++;
      for(let r=0;r<piece.m.length;r++) for(let c=0;c<piece.m[r].length;c++) if(piece.m[r][c]){
        const x=(piece.x+c)*CELL, y=(piece.y+r+g)*CELL;
        ctx.strokeStyle=COLORS[piece.m[r][c]]; ctx.globalAlpha=.5; ctx.strokeRect(x+1.5,y+1.5,CELL-3,CELL-3); ctx.globalAlpha=1;
      }
      for(let r=0;r<piece.m.length;r++) for(let c=0;c<piece.m[r].length;c++) if(piece.m[r][c]) drawCell(ctx,(piece.x+c)*CELL,(piece.y+r)*CELL,piece.m[r][c]);
    }
    nctx.fillStyle=COLORS[0]; nctx.fillRect(0,0,80,80);
    if(next){ const cell=16; const m=next.m; const ox=(80-m[0].length*cell)/2, oy=(80-m.length*cell)/2;
      for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++) if(m[r][c]){ nctx.fillStyle=COLORS[m[r][c]]; nctx.fillRect(ox+c*cell,oy+r*cell,cell-1,cell-1); } }
    overlay.querySelector("#txScore").textContent=score;
    overlay.querySelector("#txLines").textContent=lines;
    overlay.querySelector("#txLevel").textContent=level;
    overlay.querySelector("#txHi").textContent=hi;
    if(over){ ctx.fillStyle="rgba(0,0,0,.72)"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL); ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="bold 22px Inter,sans-serif"; ctx.fillText("Game over", COLS*CELL/2, ROWS*CELL/2-10); ctx.font="12px Inter,sans-serif"; ctx.fillText("Enter = opnieuw · Esc = sluiten", COLS*CELL/2, ROWS*CELL/2+15); }
    else if(paused){ ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL); ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="bold 20px Inter,sans-serif"; ctx.fillText("PAUZE (P)", COLS*CELL/2, ROWS*CELL/2); }
  };
  const reset=()=>{ board.forEach(r=>r.fill(0)); score=0; lines=0; level=1; dropInterval=START_DROP; dropTimer=0; over=false; paused=false; next=rand(); spawn(); };
  reset();
  let rafId=requestAnimationFrame(function loop(t){
    if(!lastTime) lastTime=t; const dt=t-lastTime; lastTime=t;
    if(!paused && !over){ dropTimer+=dt; if(dropTimer>=dropInterval){ dropTimer=0; softDrop(); } }
    draw(); rafId=requestAnimationFrame(loop);
  });
  const keyHandler=e=>{
    if(e.key==="Escape"){ close(); return; }
    if(over){ if(e.key==="Enter"){ lastTime=0; reset(); } return; }
    if(e.key==="p"||e.key==="P"){ paused=!paused; return; }
    if(paused) return;
    if(e.key==="ArrowLeft"){ e.preventDefault(); move(-1); }
    else if(e.key==="ArrowRight"){ e.preventDefault(); move(1); }
    else if(e.key==="ArrowDown"){ e.preventDefault(); softDrop(); score+=1; }
    else if(e.key==="ArrowUp"){ e.preventDefault(); tryRotate(); }
    else if(e.key===" "){ e.preventDefault(); hardDrop(); }
  };
  window.addEventListener("keydown", keyHandler);
  overlay.querySelectorAll("[data-act]").forEach(b=>b.onclick=()=>{
    if(over){ lastTime=0; reset(); return; }
    const a=b.dataset.act;
    if(a==="L") move(-1); else if(a==="R") move(1);
    else if(a==="rot") tryRotate();
    else if(a==="D"){ softDrop(); score+=1; }
    else if(a==="drop") hardDrop();
  });
  const close=()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown", keyHandler); overlay.remove(); };
  overlay.querySelector("#txClose").onclick=close;
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
}

/* ============================================================
   SNAKE — pauzegame
   ============================================================ */
function openSnake(){
  const HS_KEY="quiztet_snake_hs";
  const COLS=20, ROWS=20, CELL=20;
  const overlay=document.createElement("div");
  overlay.className="tetris-overlay";
  overlay.innerHTML=`
    <div class="tetris-modal" role="dialog" aria-label="Snake">
      <div class="tetris-hd">
        <div class="tetris-title">🐍 Snake</div>
        <button class="tetris-close" id="skClose" aria-label="Sluiten">×</button>
      </div>
      <div class="tetris-body">
        <canvas id="skCanvas" width="${COLS*CELL}" height="${ROWS*CELL}"></canvas>
        <div class="tetris-side">
          <div class="tetris-stats">
            <div class="tetris-stat"><label>Score</label><div id="skScore">0</div></div>
            <div class="tetris-stat"><label>Highscore</label><div id="skHi">0</div></div>
          </div>
          <div class="tetris-help muted">
            <div>← → ↑ ↓ sturen</div>
            <div>P pauze · Enter opnieuw</div>
            <div>Esc sluiten</div>
          </div>
        </div>
      </div>
      <div class="tetris-touch">
        <button data-dir="L" aria-label="Links">←</button>
        <button data-dir="U" aria-label="Omhoog">↑</button>
        <button data-dir="D" aria-label="Omlaag">↓</button>
        <button data-dir="R" aria-label="Rechts">→</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ctx=overlay.querySelector("#skCanvas").getContext("2d");
  let snake, dir, nextDir, food, score, over, paused, tickMs, tickAcc, lastT, rafId;
  let hi=parseInt(localStorage.getItem(HS_KEY)||"0",10);
  const randCell=()=>({x:Math.floor(Math.random()*COLS), y:Math.floor(Math.random()*ROWS)});
  const placeFood=()=>{ while(true){ const c=randCell(); if(!snake.some(s=>s.x===c.x&&s.y===c.y)){ food=c; return; } } };
  const DIFF=gameDifficulty("snake");
  const START_TICK = DIFF==="easy" ? 180 : DIFF==="hard" ? 100 : 140;
  const MIN_TICK   = DIFF==="easy" ? 100 : DIFF==="hard" ? 40  : 60;
  const TICK_DECAY = DIFF==="easy" ? 2   : DIFF==="hard" ? 4   : 3;
  const reset=()=>{
    snake=[{x:10,y:10},{x:9,y:10},{x:8,y:10}];
    dir={x:1,y:0}; nextDir=dir; score=0; over=false; paused=false;
    tickMs=START_TICK; tickAcc=0; lastT=0; placeFood();
  };
  const submitScore=async(s,len)=>{ if(!ME||s<=0) return; try{ await sb.from("game_scores").insert({ user_id:ME.id, game:"snake", score:s, meta:{ length:len } }); }catch(e){} };
  const step=()=>{
    dir=nextDir;
    const head={x:snake[0].x+dir.x, y:snake[0].y+dir.y};
    if(head.x<0||head.x>=COLS||head.y<0||head.y>=ROWS){ over=true; submitScore(score, snake.length); return; }
    if(snake.some(s=>s.x===head.x&&s.y===head.y)){ over=true; submitScore(score, snake.length); return; }
    snake.unshift(head);
    if(head.x===food.x&&head.y===food.y){
      score+=10;
      if(score>hi){ hi=score; try{ localStorage.setItem(HS_KEY,String(hi)); }catch(e){} }
      tickMs=Math.max(MIN_TICK, tickMs-TICK_DECAY);
      placeFood();
    } else {
      snake.pop();
    }
  };
  const draw=()=>{
    ctx.fillStyle="#0f172a"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
    ctx.fillStyle="#ef4444"; ctx.fillRect(food.x*CELL+2, food.y*CELL+2, CELL-4, CELL-4);
    snake.forEach((s,i)=>{
      ctx.fillStyle = i===0 ? "#22c55e" : "#16a34a";
      ctx.fillRect(s.x*CELL+1, s.y*CELL+1, CELL-2, CELL-2);
    });
    overlay.querySelector("#skScore").textContent=score;
    overlay.querySelector("#skHi").textContent=hi;
    if(over){
      ctx.fillStyle="rgba(0,0,0,.72)"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
      ctx.fillStyle="#fff"; ctx.textAlign="center";
      ctx.font="bold 22px Inter,sans-serif"; ctx.fillText("Game over", COLS*CELL/2, ROWS*CELL/2-10);
      ctx.font="12px Inter,sans-serif"; ctx.fillText("Enter = opnieuw · Esc = sluiten", COLS*CELL/2, ROWS*CELL/2+15);
    } else if(paused){
      ctx.fillStyle="rgba(0,0,0,.6)"; ctx.fillRect(0,0,COLS*CELL,ROWS*CELL);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="bold 20px Inter,sans-serif";
      ctx.fillText("PAUZE (P)", COLS*CELL/2, ROWS*CELL/2);
    }
  };
  const setDir=(d)=>{
    const map={L:{x:-1,y:0}, R:{x:1,y:0}, U:{x:0,y:-1}, D:{x:0,y:1}};
    const nd=map[d]; if(!nd) return;
    if(nd.x===-dir.x && nd.y===-dir.y) return;
    nextDir=nd;
  };
  reset();
  rafId=requestAnimationFrame(function loop(t){
    if(!lastT) lastT=t; const dt=t-lastT; lastT=t;
    if(!paused && !over){ tickAcc+=dt; if(tickAcc>=tickMs){ tickAcc=0; step(); } }
    draw(); rafId=requestAnimationFrame(loop);
  });
  const keyHandler=e=>{
    if(e.key==="Escape"){ close(); return; }
    if(over){ if(e.key==="Enter"){ lastT=0; reset(); } return; }
    if(e.key==="p"||e.key==="P"){ paused=!paused; return; }
    if(paused) return;
    if(e.key==="ArrowLeft"){ e.preventDefault(); setDir("L"); }
    else if(e.key==="ArrowRight"){ e.preventDefault(); setDir("R"); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); setDir("U"); }
    else if(e.key==="ArrowDown"){ e.preventDefault(); setDir("D"); }
  };
  window.addEventListener("keydown", keyHandler);
  overlay.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{
    if(over){ lastT=0; reset(); return; }
    setDir(b.dataset.dir);
  });
  const close=()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown", keyHandler); overlay.remove(); };
  overlay.querySelector("#skClose").onclick=close;
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
}

/* ============================================================
   PONG — pauzegame (speler vs CPU)
   ============================================================ */
function openPong(){
  const W=480, H=320, PAD_W=10, PAD_H=64, BALL=8, WIN_SCORE=7;
  const overlay=document.createElement("div");
  overlay.className="tetris-overlay";
  overlay.innerHTML=`
    <div class="tetris-modal" role="dialog" aria-label="Pong">
      <div class="tetris-hd">
        <div class="tetris-title">🏓 Pong</div>
        <button class="tetris-close" id="pgClose" aria-label="Sluiten">×</button>
      </div>
      <div class="tetris-body">
        <canvas id="pgCanvas" width="${W}" height="${H}"></canvas>
        <div class="tetris-side">
          <div class="tetris-stats">
            <div class="tetris-stat"><label>Jij</label><div id="pgYou">0</div></div>
            <div class="tetris-stat"><label>CPU</label><div id="pgCpu">0</div></div>
          </div>
          <div class="tetris-help muted">
            <div>↑ ↓ of W / S</div>
            <div>Spatie = starten</div>
            <div>P pauze · Esc sluiten</div>
            <div>Eerst tot ${WIN_SCORE}</div>
          </div>
        </div>
      </div>
      <div class="tetris-touch">
        <button data-pdir="U" aria-label="Omhoog">↑</button>
        <button data-pdir="S" aria-label="Serveren">▶</button>
        <button data-pdir="D" aria-label="Omlaag">↓</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ctx=overlay.querySelector("#pgCanvas").getContext("2d");
  const DIFF=gameDifficulty("pong");
  const BALL_SPEED  = DIFF==="easy" ? 2.6 : DIFF==="hard" ? 4.0 : 3.2;
  const CPU_SPEED   = DIFF==="easy" ? 2.4 : DIFF==="hard" ? 4.0 : 3.2;
  const PADDLE_SPEED= DIFF==="easy" ? 5.0 : DIFF==="hard" ? 4.0 : 4.5;
  let py, cy, ball, ballV, scoreYou, scoreCpu, over, paused, waiting, rafId, lastT;
  const keys={up:false,down:false};
  const reset=(serveTo)=>{
    py=(H-PAD_H)/2; cy=(H-PAD_H)/2;
    ball={x:W/2, y:H/2};
    const dx = serveTo==="cpu" ? -1 : 1;
    const dy = (Math.random()*2-1)*0.6;
    ballV={x:dx*BALL_SPEED, y:dy*BALL_SPEED};
    waiting=true; over=false; paused=false;
  };
  const resetAll=()=>{ scoreYou=0; scoreCpu=0; reset("cpu"); };
  resetAll();
  const step=(dt)=>{
    if(keys.up) py-=PADDLE_SPEED;
    if(keys.down) py+=PADDLE_SPEED;
    py=Math.max(0, Math.min(H-PAD_H, py));
    if(!waiting){
      const cpuC = cy+PAD_H/2, target=ball.y;
      const cpuSpeed=CPU_SPEED;
      if(target < cpuC-6) cy-=cpuSpeed;
      else if(target > cpuC+6) cy+=cpuSpeed;
      cy=Math.max(0, Math.min(H-PAD_H, cy));
      ball.x+=ballV.x; ball.y+=ballV.y;
      if(ball.y<BALL/2){ ball.y=BALL/2; ballV.y*=-1; }
      if(ball.y>H-BALL/2){ ball.y=H-BALL/2; ballV.y*=-1; }
      // Gebogen paddle: relatieve raakplaats bepaalt hoek, sneller ramp bij lage snelheid,
      // afvlakkend rond snelheid 8.
      const MAX_ANGLE = Math.PI/2.7;  // ~66°
      const MAX_SPEED = 11;
      const paddleHit=(paddleTop, sideRight)=>{
        const off = (ball.y-(paddleTop+PAD_H/2)) / (PAD_H/2);            // -1..+1
        const curved = Math.sign(off) * Math.pow(Math.min(Math.abs(off),1), 0.65);
        const angle = curved * MAX_ANGLE;
        const cur = Math.hypot(ballV.x, ballV.y);
        const gain = cur<5 ? 1.14 : cur<7 ? 1.08 : cur<9 ? 1.035 : 1.015;
        const next = Math.min(MAX_SPEED, cur*gain);
        const dir = sideRight ? -1 : 1;
        ballV.x = dir * Math.abs(next * Math.cos(angle));
        ballV.y = next * Math.sin(angle);
      };
      // Speler-paddle (links)
      if(ball.x-BALL/2 <= PAD_W && ball.y>=py && ball.y<=py+PAD_H && ballV.x<0){
        ball.x=PAD_W+BALL/2; paddleHit(py, false);
      }
      // CPU-paddle (rechts)
      if(ball.x+BALL/2 >= W-PAD_W && ball.y>=cy && ball.y<=cy+PAD_H && ballV.x>0){
        ball.x=W-PAD_W-BALL/2; paddleHit(cy, true);
      }
      if(ball.x<0){ scoreCpu++; if(scoreCpu>=WIN_SCORE){ over=true; } else reset("you"); }
      else if(ball.x>W){ scoreYou++; if(scoreYou>=WIN_SCORE){ over=true; submitPongScore(); } else reset("cpu"); }
    }
  };
  const submitPongScore=async()=>{ if(!ME) return; const s=Math.max(0, WIN_SCORE*10 - scoreCpu*10); if(s<=0) return; try{ await sb.from("game_scores").insert({ user_id:ME.id, game:"pong", score:s, meta:{ you:scoreYou, cpu:scoreCpu } }); }catch(e){} };
  const draw=()=>{
    ctx.fillStyle="#0f172a"; ctx.fillRect(0,0,W,H);
    ctx.strokeStyle="rgba(255,255,255,.25)"; ctx.setLineDash([6,6]);
    ctx.beginPath(); ctx.moveTo(W/2,0); ctx.lineTo(W/2,H); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle="#fff";
    // Gebogen paddles: rechthoek met sterke ronding aan de kant richting de bal
    const drawPaddle=(x, y, w, h, facingRight)=>{
      const r=Math.min(w, h/2);
      ctx.beginPath();
      if(facingRight){
        ctx.moveTo(x, y);
        ctx.lineTo(x+w-r, y);
        ctx.quadraticCurveTo(x+w+r*0.6, y+h/2, x+w-r, y+h);
        ctx.lineTo(x, y+h);
      } else {
        ctx.moveTo(x+w, y);
        ctx.lineTo(x+r, y);
        ctx.quadraticCurveTo(x-r*0.6, y+h/2, x+r, y+h);
        ctx.lineTo(x+w, y+h);
      }
      ctx.closePath(); ctx.fill();
    };
    drawPaddle(0, py, PAD_W, PAD_H, true);
    drawPaddle(W-PAD_W, cy, PAD_W, PAD_H, false);
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL/2, 0, Math.PI*2); ctx.fill();
    overlay.querySelector("#pgYou").textContent=scoreYou;
    overlay.querySelector("#pgCpu").textContent=scoreCpu;
    if(over){
      ctx.fillStyle="rgba(0,0,0,.72)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.textAlign="center";
      ctx.font="bold 24px Inter,sans-serif";
      ctx.fillText(scoreYou>scoreCpu?"Gewonnen! 🏆":"Verloren", W/2, H/2-10);
      ctx.font="12px Inter,sans-serif"; ctx.fillText("Enter = opnieuw · Esc = sluiten", W/2, H/2+15);
    } else if(paused){
      ctx.fillStyle="rgba(0,0,0,.55)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="bold 20px Inter,sans-serif";
      ctx.fillText("PAUZE (P)", W/2, H/2);
    } else if(waiting){
      ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.font="14px Inter,sans-serif";
      ctx.fillText("Druk op spatie om te serveren", W/2, H/2);
    }
  };
  lastT=0;
  rafId=requestAnimationFrame(function loop(t){
    if(!lastT) lastT=t; const dt=t-lastT; lastT=t;
    if(!paused && !over) step(dt);
    draw(); rafId=requestAnimationFrame(loop);
  });
  const keyHandler=e=>{
    if(e.key==="Escape"){ close(); return; }
    if(over){ if(e.key==="Enter"){ resetAll(); } return; }
    if(e.key==="p"||e.key==="P"){ paused=!paused; return; }
    if(paused) return;
    if(e.key==="ArrowUp"||e.key==="w"||e.key==="W"){ e.preventDefault(); keys.up=true; }
    else if(e.key==="ArrowDown"||e.key==="s"||e.key==="S"){ e.preventDefault(); keys.down=true; }
    else if(e.key===" "){ e.preventDefault(); if(waiting) waiting=false; }
  };
  const keyUp=e=>{
    if(e.key==="ArrowUp"||e.key==="w"||e.key==="W") keys.up=false;
    else if(e.key==="ArrowDown"||e.key==="s"||e.key==="S") keys.down=false;
  };
  window.addEventListener("keydown", keyHandler);
  window.addEventListener("keyup", keyUp);
  overlay.querySelectorAll("[data-pdir]").forEach(b=>{
    let iv=null;
    const act=b.dataset.pdir;
    const start=()=>{ if(over){ resetAll(); return; }
      if(act==="S"){ if(waiting) waiting=false; return; }
      if(act==="U") keys.up=true; else if(act==="D") keys.down=true;
      iv=setInterval(()=>{},50);
    };
    const stop=()=>{ keys.up=false; keys.down=false; if(iv){ clearInterval(iv); iv=null; } };
    b.addEventListener("mousedown", start); b.addEventListener("touchstart", e=>{ e.preventDefault(); start(); });
    b.addEventListener("mouseup", stop); b.addEventListener("mouseleave", stop);
    b.addEventListener("touchend", stop); b.addEventListener("touchcancel", stop);
  });
  const close=()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown", keyHandler); window.removeEventListener("keyup", keyUp); overlay.remove(); };
  overlay.querySelector("#pgClose").onclick=close;
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
}

/* ============================================================
   2048 — schuif getallen (4x4 grid)
   ============================================================ */
function open2048(){
  const HS_KEY="quiztet_2048_hs";
  const N=4, CELL=80, GAP=6, W=N*CELL+(N+1)*GAP;
  const DIFF=gameDifficulty("g2048");
  const START_TILES = DIFF==="easy" ? 3 : DIFF==="hard" ? 1 : 2;
  const SPAWN_HIGH = DIFF==="easy" ? .05 : DIFF==="hard" ? .2 : .1;  // kans op 4 i.p.v. 2
  const COLORS={
    0:"#cdc1b4", 2:"#eee4da", 4:"#ede0c8", 8:"#f2b179", 16:"#f59563",
    32:"#f67c5f", 64:"#f65e3b", 128:"#edcf72", 256:"#edcc61", 512:"#edc850",
    1024:"#edc53f", 2048:"#edc22e", 4096:"#3c3a32", 8192:"#3c3a32"
  };
  const overlay=document.createElement("div");
  overlay.className="tetris-overlay";
  overlay.innerHTML=`
    <div class="tetris-modal" role="dialog" aria-label="2048">
      <div class="tetris-hd">
        <div class="tetris-title">🔢 2048</div>
        <button class="tetris-close" id="g2Close" aria-label="Sluiten">×</button>
      </div>
      <div class="tetris-body">
        <canvas id="g2Canvas" width="${W}" height="${W}"></canvas>
        <div class="tetris-side">
          <div class="tetris-stats">
            <div class="tetris-stat"><label>Score</label><div id="g2Score">0</div></div>
            <div class="tetris-stat"><label>Highscore</label><div id="g2Hi">0</div></div>
          </div>
          <div class="tetris-help muted">
            <div>← → ↑ ↓ schuiven</div>
            <div>Enter = opnieuw · Esc = sluiten</div>
          </div>
        </div>
      </div>
      <div class="tetris-touch">
        <button data-dir="L" aria-label="Links">←</button>
        <button data-dir="U" aria-label="Omhoog">↑</button>
        <button data-dir="D" aria-label="Omlaag">↓</button>
        <button data-dir="R" aria-label="Rechts">→</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ctx=overlay.querySelector("#g2Canvas").getContext("2d");
  let grid, score, over;
  let hi=parseInt(localStorage.getItem(HS_KEY)||"0",10);
  const emptyCells=()=>{ const list=[]; for(let r=0;r<N;r++) for(let c=0;c<N;c++) if(!grid[r][c]) list.push([r,c]); return list; };
  const spawn=()=>{ const cells=emptyCells(); if(!cells.length) return; const [r,c]=cells[Math.floor(Math.random()*cells.length)]; grid[r][c]=Math.random()<SPAWN_HIGH?4:2; };
  const reset=()=>{ grid=Array.from({length:N},()=>Array(N).fill(0)); score=0; over=false; for(let i=0;i<START_TILES;i++) spawn(); };
  const slideRow=(row)=>{
    const nz=row.filter(v=>v);
    let gained=0;
    for(let i=0;i<nz.length-1;i++){
      if(nz[i]===nz[i+1]){ nz[i]*=2; gained+=nz[i]; nz.splice(i+1,1); }
    }
    while(nz.length<N) nz.push(0);
    return { row:nz, gained };
  };
  const rotate=(g)=>{ const n=g.length; const out=Array.from({length:n},()=>Array(n).fill(0)); for(let r=0;r<n;r++) for(let c=0;c<n;c++) out[c][n-1-r]=g[r][c]; return out; };
  const move=(dir)=>{
    // Normaliseer naar "links": roteer, schuif links, roteer terug
    let rots=0;
    if(dir==="U") rots=3;
    else if(dir==="R") rots=2;
    else if(dir==="D") rots=1;
    let g=grid;
    for(let i=0;i<rots;i++) g=rotate(g);
    let changed=false, gained=0;
    for(let r=0;r<N;r++){
      const before=g[r].slice();
      const { row, gained:gg }=slideRow(g[r]);
      g[r]=row; gained+=gg;
      if(before.some((v,i)=>v!==row[i])) changed=true;
    }
    for(let i=0;i<(4-rots)%4;i++) g=rotate(g);
    if(changed){
      grid=g; score+=gained;
      if(score>hi){ hi=score; try{ localStorage.setItem(HS_KEY,String(hi)); }catch(e){} }
      spawn();
      if(!hasMove()){ over=true; submitScore(); }
    }
  };
  const hasMove=()=>{
    if(emptyCells().length) return true;
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      const v=grid[r][c];
      if(c<N-1 && grid[r][c+1]===v) return true;
      if(r<N-1 && grid[r+1][c]===v) return true;
    }
    return false;
  };
  const submitScore=async()=>{ if(!ME||score<=0) return; try{ await sb.from("game_scores").insert({ user_id:ME.id, game:"g2048", score, meta:{ best:Math.max(...grid.flat()) } }); }catch(e){} };
  const draw=()=>{
    ctx.fillStyle="#bbada0"; ctx.fillRect(0,0,W,W);
    for(let r=0;r<N;r++) for(let c=0;c<N;c++){
      const x=GAP+c*(CELL+GAP), y=GAP+r*(CELL+GAP), v=grid[r][c];
      ctx.fillStyle=COLORS[v]||COLORS[8192];
      ctx.fillRect(x, y, CELL, CELL);
      if(v){
        ctx.fillStyle = v<=4 ? "#776e65" : "#f9f6f2";
        const fs = v<100?36 : v<1000?30 : 24;
        ctx.font=`bold ${fs}px Inter,sans-serif`;
        ctx.textAlign="center"; ctx.textBaseline="middle";
        ctx.fillText(String(v), x+CELL/2, y+CELL/2);
      }
    }
    overlay.querySelector("#g2Score").textContent=score;
    overlay.querySelector("#g2Hi").textContent=hi;
    if(over){
      ctx.fillStyle="rgba(0,0,0,.65)"; ctx.fillRect(0,0,W,W);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.font="bold 26px Inter,sans-serif"; ctx.fillText("Game over", W/2, W/2-8);
      ctx.font="13px Inter,sans-serif"; ctx.fillText("Enter = opnieuw · Esc = sluiten", W/2, W/2+18);
    }
  };
  reset();
  let rafId=requestAnimationFrame(function loop(){ draw(); rafId=requestAnimationFrame(loop); });
  const keyHandler=e=>{
    if(e.key==="Escape"){ close(); return; }
    if(over){ if(e.key==="Enter"){ reset(); } return; }
    if(e.key==="ArrowLeft"){ e.preventDefault(); move("L"); }
    else if(e.key==="ArrowRight"){ e.preventDefault(); move("R"); }
    else if(e.key==="ArrowUp"){ e.preventDefault(); move("U"); }
    else if(e.key==="ArrowDown"){ e.preventDefault(); move("D"); }
  };
  window.addEventListener("keydown", keyHandler);
  overlay.querySelectorAll("[data-dir]").forEach(b=>b.onclick=()=>{ if(over){ reset(); return; } move(b.dataset.dir); });
  // Swipe-detectie op canvas voor mobiel
  const cvs=overlay.querySelector("#g2Canvas");
  let tsx=0, tsy=0;
  cvs.addEventListener("touchstart", e=>{ const t=e.changedTouches[0]; tsx=t.clientX; tsy=t.clientY; });
  cvs.addEventListener("touchend", e=>{
    const t=e.changedTouches[0]; const dx=t.clientX-tsx, dy=t.clientY-tsy;
    if(Math.max(Math.abs(dx),Math.abs(dy))<20) return;
    if(Math.abs(dx)>Math.abs(dy)) move(dx>0?"R":"L");
    else move(dy>0?"D":"U");
  });
  const close=()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown", keyHandler); overlay.remove(); };
  overlay.querySelector("#g2Close").onclick=close;
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
}

/* ============================================================
   BREAKOUT — pauzegame (paddle onderaan, blokjes bovenaan)
   ============================================================ */
function openBreakout(){
  const W=480, H=360, PAD_H=10, BALL=8;
  const DIFF=gameDifficulty("breakout");
  const BALL_SPEED  = DIFF==="easy" ? 3.2 : DIFF==="hard" ? 5.0 : 4.0;
  const PAD_W       = DIFF==="easy" ? 90  : DIFF==="hard" ? 55  : 72;
  const LIVES_START = DIFF==="easy" ? 5   : DIFF==="hard" ? 2   : 3;
  const ROWS=5, COLS=10, BRICK_H=16, BRICK_W=(W-20)/COLS, BRICK_TOP=30;
  const BRICK_COLORS=["#ef4444","#f97316","#facc15","#22c55e","#3b82f6"];
  const overlay=document.createElement("div");
  overlay.className="tetris-overlay";
  overlay.innerHTML=`
    <div class="tetris-modal" role="dialog" aria-label="Breakout">
      <div class="tetris-hd">
        <div class="tetris-title">🧱 Breakout</div>
        <button class="tetris-close" id="bkClose" aria-label="Sluiten">×</button>
      </div>
      <div class="tetris-body">
        <canvas id="bkCanvas" width="${W}" height="${H}"></canvas>
        <div class="tetris-side">
          <div class="tetris-stats">
            <div class="tetris-stat"><label>Score</label><div id="bkScore">0</div></div>
            <div class="tetris-stat"><label>Levens</label><div id="bkLives">${LIVES_START}</div></div>
          </div>
          <div class="tetris-help muted">
            <div>← → of muis</div>
            <div>Spatie = start / opnieuw</div>
            <div>Esc = sluiten</div>
          </div>
        </div>
      </div>
      <div class="tetris-touch">
        <button data-bdir="L" aria-label="Links">←</button>
        <button data-bdir="S" aria-label="Start">▶</button>
        <button data-bdir="R" aria-label="Rechts">→</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  const ctx=overlay.querySelector("#bkCanvas").getContext("2d");
  let paddleX, ball, ballV, bricks, score, lives, over, won, waiting;
  const keys={left:false,right:false};
  const submitScore=async()=>{ if(!ME||score<=0) return; try{ await sb.from("game_scores").insert({ user_id:ME.id, game:"breakout", score, meta:{ won:!!won, lives } }); }catch(e){} };
  const resetBricks=()=>{
    bricks=[];
    for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
      bricks.push({ x:10+c*BRICK_W, y:BRICK_TOP+r*BRICK_H, w:BRICK_W-2, h:BRICK_H-2, color:BRICK_COLORS[r], alive:true });
    }
  };
  const serveBall=()=>{
    ball={x:paddleX+PAD_W/2, y:H-PAD_H-BALL};
    const dir=(Math.random()*.6-.3)+ (Math.random()<.5?-.7:.7);
    ballV={x:dir*BALL_SPEED*0.6, y:-BALL_SPEED};
    waiting=true;
  };
  const resetAll=()=>{
    paddleX=(W-PAD_W)/2; score=0; lives=LIVES_START; over=false; won=false;
    resetBricks(); serveBall();
  };
  resetAll();
  const step=()=>{
    if(keys.left)  paddleX -= 6;
    if(keys.right) paddleX += 6;
    paddleX=Math.max(0, Math.min(W-PAD_W, paddleX));
    if(waiting){ ball.x=paddleX+PAD_W/2; return; }
    ball.x+=ballV.x; ball.y+=ballV.y;
    if(ball.x<BALL/2){ ball.x=BALL/2; ballV.x*=-1; }
    if(ball.x>W-BALL/2){ ball.x=W-BALL/2; ballV.x*=-1; }
    if(ball.y<BALL/2){ ball.y=BALL/2; ballV.y*=-1; }
    // Paddle-botsing
    if(ball.y+BALL/2 >= H-PAD_H && ball.x>=paddleX && ball.x<=paddleX+PAD_W && ballV.y>0){
      ball.y = H-PAD_H-BALL/2;
      ballV.y*=-1;
      const off=(ball.x-(paddleX+PAD_W/2))/(PAD_W/2);
      ballV.x = off*BALL_SPEED*0.9;
    }
    // Bal viel eronder
    if(ball.y > H){
      lives--;
      if(lives<=0){ over=true; submitScore(); }
      else serveBall();
    }
    // Steenbotsing
    for(const b of bricks){
      if(!b.alive) continue;
      if(ball.x>b.x && ball.x<b.x+b.w && ball.y>b.y && ball.y<b.y+b.h){
        b.alive=false; score+=10;
        // Bepaal richting flip: kleinste overlap
        const overlapX=Math.min(ball.x-b.x, (b.x+b.w)-ball.x);
        const overlapY=Math.min(ball.y-b.y, (b.y+b.h)-ball.y);
        if(overlapX<overlapY) ballV.x*=-1; else ballV.y*=-1;
        break;
      }
    }
    if(bricks.every(b=>!b.alive)){ won=true; over=true; score+=lives*50; submitScore(); }
  };
  const draw=()=>{
    ctx.fillStyle="#0f172a"; ctx.fillRect(0,0,W,H);
    for(const b of bricks) if(b.alive){ ctx.fillStyle=b.color; ctx.fillRect(b.x,b.y,b.w,b.h); }
    ctx.fillStyle="#fff"; ctx.fillRect(paddleX, H-PAD_H, PAD_W, PAD_H);
    ctx.beginPath(); ctx.arc(ball.x, ball.y, BALL/2, 0, Math.PI*2); ctx.fill();
    overlay.querySelector("#bkScore").textContent=score;
    overlay.querySelector("#bkLives").textContent=lives;
    if(over){
      ctx.fillStyle="rgba(0,0,0,.65)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.font="bold 26px Inter,sans-serif";
      ctx.fillText(won?"Alle stenen weg! 🎉":"Game over", W/2, H/2-10);
      ctx.font="13px Inter,sans-serif"; ctx.fillText("Spatie/Enter = opnieuw · Esc = sluiten", W/2, H/2+18);
    } else if(waiting){
      ctx.fillStyle="rgba(0,0,0,.45)"; ctx.fillRect(0,0,W,H);
      ctx.fillStyle="#fff"; ctx.textAlign="center"; ctx.textBaseline="middle";
      ctx.font="14px Inter,sans-serif"; ctx.fillText("Druk op spatie om te starten", W/2, H/2);
    }
  };
  let rafId=requestAnimationFrame(function loop(){ if(!over) step(); draw(); rafId=requestAnimationFrame(loop); });
  const keyHandler=e=>{
    if(e.key==="Escape"){ close(); return; }
    if(over){ if(e.key==="Enter"||e.key===" "){ resetAll(); } return; }
    if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A"){ e.preventDefault(); keys.left=true; }
    else if(e.key==="ArrowRight"||e.key==="d"||e.key==="D"){ e.preventDefault(); keys.right=true; }
    else if(e.key===" "){ e.preventDefault(); if(waiting) waiting=false; }
  };
  const keyUp=e=>{
    if(e.key==="ArrowLeft"||e.key==="a"||e.key==="A") keys.left=false;
    else if(e.key==="ArrowRight"||e.key==="d"||e.key==="D") keys.right=false;
  };
  window.addEventListener("keydown", keyHandler);
  window.addEventListener("keyup", keyUp);
  const cvs=overlay.querySelector("#bkCanvas");
  cvs.addEventListener("mousemove", e=>{
    if(over) return;
    const rect=cvs.getBoundingClientRect();
    const scaleX = W/rect.width;
    paddleX = Math.max(0, Math.min(W-PAD_W, (e.clientX-rect.left)*scaleX - PAD_W/2));
  });
  overlay.querySelectorAll("[data-bdir]").forEach(b=>{
    const act=b.dataset.bdir;
    const press=()=>{
      if(over){ resetAll(); return; }
      if(act==="S"){ if(waiting) waiting=false; return; }
      if(act==="L") keys.left=true; else if(act==="R") keys.right=true;
    };
    const release=()=>{ keys.left=false; keys.right=false; };
    b.addEventListener("mousedown", press); b.addEventListener("touchstart", e=>{ e.preventDefault(); press(); });
    b.addEventListener("mouseup", release); b.addEventListener("mouseleave", release);
    b.addEventListener("touchend", release); b.addEventListener("touchcancel", release);
  });
  const close=()=>{ cancelAnimationFrame(rafId); window.removeEventListener("keydown", keyHandler); window.removeEventListener("keyup", keyUp); overlay.remove(); };
  overlay.querySelector("#bkClose").onclick=close;
  overlay.addEventListener("click", e=>{ if(e.target===overlay) close(); });
}

/* ============================================================
   GAMES-REGISTER + INSTELLINGEN
   Configuratie per game: `free` = altijd speelbaar via home?
   Anders is de game "beloningsgame" (bv. tetris: pas na oefensessie).
   Wordt bewaard in app_settings.games_config (jsonb).
   ============================================================ */
const GAMES = [
  { id:"tetris",   name:"Tetris",   icon:"🧱", desc:"Klassieke blokjes-pauze.",       defaultEnabled:true,  defaultFree:false, defaultReset:"off", defaultDifficulty:"normal", defaultGate:{minQuestions:25, minPercent:80}, open:openTetris   },
  { id:"snake",    name:"Snake",    icon:"🐍", desc:"Blijf leven, eet, groei.",        defaultEnabled:true,  defaultFree:true,  defaultReset:"off", defaultDifficulty:"normal", defaultGate:{minQuestions:0, minPercent:0},  open:openSnake    },
  { id:"pong",     name:"Pong",     icon:"🏓", desc:"Retro paddle vs CPU.",            defaultEnabled:true,  defaultFree:true,  defaultReset:"off", defaultDifficulty:"normal", defaultGate:{minQuestions:0, minPercent:0},  open:openPong     },
  { id:"g2048",    name:"2048",     icon:"🔢", desc:"Schuif en versmelt getallen.",    defaultEnabled:false, defaultFree:true,  defaultReset:"off", defaultDifficulty:"normal", defaultGate:{minQuestions:0, minPercent:0},  open:open2048     },
  { id:"breakout", name:"Breakout", icon:"🧱", desc:"Kaats de bal, sla stenen weg.",   defaultEnabled:false, defaultFree:true,  defaultReset:"off", defaultDifficulty:"normal", defaultGate:{minQuestions:0, minPercent:0},  open:openBreakout },
];
const RESET_MODES = ["off","weekly","monthly"];
const DIFFICULTIES = ["easy","normal","hard"];
let GAMES_CFG=null;
function gamesDefaults(){ const d={}; GAMES.forEach(g=>d[g.id]={
  enabled:g.defaultEnabled!==false, free:!!g.defaultFree,
  reset:g.defaultReset||"off", difficulty:g.defaultDifficulty||"normal",
  gate:{ minQuestions:(g.defaultGate&&g.defaultGate.minQuestions)||0, minPercent:(g.defaultGate&&g.defaultGate.minPercent)||0 },
}); return d; }
function cleanGate(g){
  const q=Math.max(0, Math.min(500, parseInt(g&&g.minQuestions,10)||0));
  const p=Math.max(0, Math.min(100, parseInt(g&&g.minPercent,10)||0));
  return { minQuestions:q, minPercent:p };
}
async function loadGamesConfig(){
  const defaults=gamesDefaults();
  try{
    const { data, error }=await sb.from("app_settings").select("games_config").eq("id",1).single();
    if(error) throw error;
    const stored=(data&&data.games_config)||{};
    GAMES_CFG={};
    GAMES.forEach(g=>{
      const s=stored[g.id]||{};
      GAMES_CFG[g.id]={
        enabled: typeof s.enabled==="boolean" ? s.enabled : defaults[g.id].enabled,
        free: typeof s.free==="boolean" ? s.free : defaults[g.id].free,
        reset: RESET_MODES.includes(s.reset) ? s.reset : defaults[g.id].reset,
        difficulty: DIFFICULTIES.includes(s.difficulty) ? s.difficulty : defaults[g.id].difficulty,
        gate: s.gate ? cleanGate(s.gate) : defaults[g.id].gate,
      };
    });
  }catch(e){ GAMES_CFG=defaults; }
  return GAMES_CFG;
}
async function saveGamesConfig(cfg){
  const clean={}; GAMES.forEach(g=>{
    const s=cfg[g.id]||{};
    clean[g.id]={
      enabled: !!s.enabled,
      free: !!s.free,
      reset: RESET_MODES.includes(s.reset) ? s.reset : "off",
      difficulty: DIFFICULTIES.includes(s.difficulty) ? s.difficulty : "normal",
      gate: cleanGate(s.gate),
    };
  });
  const { error }=await sb.from("app_settings").update({ games_config: clean }).eq("id",1);
  if(error) throw error;
  GAMES_CFG=clean;
}
function gameGate(gameId){
  return (GAMES_CFG && GAMES_CFG[gameId] && GAMES_CFG[gameId].gate) || { minQuestions:0, minPercent:0 };
}
function gateSatisfied(gameId, sessionN, sessionPct){
  const g=gameGate(gameId);
  const nOK = (g.minQuestions||0)<=0 || sessionN>=g.minQuestions;
  const pOK = (g.minPercent||0)<=0 || sessionPct>=g.minPercent;
  return nOK && pOK;
}
function gateDescription(gameId){
  const g=gameGate(gameId);
  const parts=[];
  if(g.minQuestions>0) parts.push(`≥${g.minQuestions} vragen`);
  if(g.minPercent>0)   parts.push(`≥${g.minPercent}% juist`);
  return parts.length ? parts.join(" · ") : "";
}
function gameDifficulty(gameId){
  return (GAMES_CFG && GAMES_CFG[gameId] && GAMES_CFG[gameId].difficulty) || "normal";
}
function gameEnabled(gameId){
  if(!GAMES_CFG || !GAMES_CFG[gameId]) return false;
  return !!GAMES_CFG[gameId].enabled;
}
function activeGames(){ return GAMES.filter(g=>gameEnabled(g.id)); }
// Startdatum (lokaal) van de huidige periode voor een reset-modus. Retourneert null als er niet gefilterd moet worden.
function periodStart(mode){
  if(mode!=="weekly" && mode!=="monthly") return null;
  const d=new Date();
  if(mode==="monthly") return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
  // weekly: maandag 00:00 lokaal
  const day=d.getDay(); // 0=zo, 1=ma, …
  const daysSinceMonday = (day===0) ? 6 : day-1;
  const monday=new Date(d.getFullYear(), d.getMonth(), d.getDate()-daysSinceMonday, 0, 0, 0, 0);
  return monday;
}
function periodLabel(mode){
  if(mode==="weekly") return "wekelijkse reset";
  if(mode==="monthly") return "maandelijkse reset";
  return "";
}
function gameResetMode(gameId){
  return (GAMES_CFG && GAMES_CFG[gameId] && GAMES_CFG[gameId].reset) || "off";
}
function renderGamesSection(myStats){
  if(!GAMES_CFG) return "";
  const list=activeGames();
  if(!list.length) return "";
  const stats=myStats||{};
  const cards=list.map(g=>{
    const free=!!(GAMES_CFG[g.id]&&GAMES_CFG[g.id].free);
    const s=stats[g.id];
    const counter = s && s.plays>0
      ? `<div class="game-counter" title="Jouw statistieken voor deze game">📊 ${s.plays} ${s.plays===1?"partij":"partijen"} · beste <strong>${s.best}</strong></div>`
      : `<div class="game-counter muted" style="opacity:.7">Nog niet gespeeld</div>`;
    const gateDesc = !free ? gateDescription(g.id) : "";
    const lockedText = gateDesc ? `Ontgrendel via een oefensessie (${esc(gateDesc)}).` : (g.lockedHint||"Vergrendeld door een beheerder.");
    return `<div class="card game-card ${free?"":"locked"}">
      <div class="game-card-top"><span class="game-icon">${g.icon}</span><h3 style="margin:0">${esc(g.name)}</h3></div>
      <p class="muted" style="font-size:.85rem;margin:.3rem 0 .5rem 0">${esc(g.desc)}</p>
      ${counter}
      ${free
        ? `<button class="btn btn-primary btn-sm" data-play="${g.id}" style="margin-top:.4rem">Speel</button>`
        : `<div class="game-lock" style="margin-top:.4rem">🔒 ${esc(lockedText)}</div>`
      }
    </div>`;
  }).join("");
  return `<div class="spread" style="margin-top:2.2rem"><h2 style="margin:0">🎮 Games</h2></div>
    <p class="muted" style="font-size:.85rem;margin:.2rem 0 .8rem 0">Even pauze — of speel gewoon voor de fun.</p>
    <div class="grid games-grid">${cards}</div>`;
}

// Popup waarin een schrijver een antwoord aanklikt om {X}, {juist} of {docent} in te voegen
function openRefPicker(qid, targetTextarea, qObj){
  const q = qObj || (PLAY.all||[]).find(x=>x.id===qid);
  if(!q){ toast("Vraag niet geladen","err"); return; }
  const correct = arr(q.correct_indexes);
  const docent = arr(q.docent_indexes);
  const docentDiffers = docent.length>0 && !setEq(docent,correct);
  const overlay=document.createElement("div");
  overlay.className="modes-overlay ref-picker-overlay";
  overlay.innerHTML=`<div class="modes-modal ref-picker-modal" role="dialog" aria-label="Verwijs naar een antwoord">
    <div class="modes-hd">
      <div class="modes-title">${ICON.info} Klik op het antwoord waarnaar je wil verwijzen</div>
      <button class="tetris-close" id="rpClose" aria-label="Sluiten">×</button>
    </div>
    <div class="modes-body">
      <p class="muted" style="font-size:.85rem;margin-bottom:.6rem">Klik om de bijhorende <code>{...}</code>-token in te voegen. De app vertaalt die op de leesscherm naar de letter die de lezer <em>echt</em> ziet, zelfs als de opties bij hem geschud zijn.</p>
      <h3 style="font-size:.9rem;margin:.5rem 0 .3rem">Speciale verwijzingen</h3>
      <div class="ref-picker-list">
        <button type="button" class="ref-picker-opt special" data-token="{juist}">
          <span class="rp-letter">✓</span>
          <span class="rp-text"><strong>Het juiste antwoord</strong> — verwijst altijd naar wat correct is voor deze vraag${correct.length?` (nu: ${correct.map(i=>letter(i)+". "+(q.options||[])[i]).join(" · ")})`:""}</span>
          <span class="rp-token">{juist}</span>
        </button>
        ${docentDiffers?`<button type="button" class="ref-picker-opt special docent" data-token="{docent}">
          <span class="rp-letter">👨‍🏫</span>
          <span class="rp-text"><strong>Antwoord van de docent</strong> — ${docent.map(i=>letter(i)+". "+(q.options||[])[i]).join(" · ")}</span>
          <span class="rp-token">{docent}</span>
        </button>`:""}
      </div>
      <h3 style="font-size:.9rem;margin:.9rem 0 .3rem">Individuele opties (vaste volgorde)</h3>
      <div class="ref-picker-list">${(q.options||[]).map((o,i)=>`
        <button type="button" class="ref-picker-opt ${correct.includes(i)?"is-correct":""} ${docentDiffers&&docent.includes(i)?"is-docent":""}" data-token="{${letter(i)}}">
          <span class="rp-letter">${letter(i)}</span>
          <span class="rp-text">${esc(o)}${correct.includes(i)?` <span class="pill juist" style="margin-left:.3rem">juist</span>`:""}${docentDiffers&&docent.includes(i)?` <span class="pill" style="margin-left:.3rem;background:rgba(192,38,211,.12);color:#a21caf">docent</span>`:""}</span>
          <span class="rp-token">{${letter(i)}}</span>
        </button>`).join("")}</div>
      <p class="muted" style="font-size:.75rem;margin-top:.7rem">Tip: klik meerdere keren om meerdere tokens achter elkaar in te voegen. Sluit dan het venster (Esc of ×).</p>
    </div>
  </div>`;
  document.body.appendChild(overlay);
  const insertToken=(token)=>{
    if(!targetTextarea) return;
    const start=targetTextarea.selectionStart, end=targetTextarea.selectionEnd;
    const v=targetTextarea.value;
    // Voeg een spatie voor de token toe als de voorafgaande char niet whitespace/newline is
    const pre=(start>0 && !/\s/.test(v[start-1]))?" ":"";
    const ins=pre+token;
    targetTextarea.value=v.slice(0,start)+ins+v.slice(end);
    const pos=start+ins.length;
    // focus terug op textarea zonder popup te sluiten
    targetTextarea.focus(); targetTextarea.setSelectionRange(pos,pos);
  };
  overlay.querySelectorAll("[data-token]").forEach(b=>b.onclick=()=>insertToken(b.dataset.token));
  const close=()=>{ overlay.remove(); window.removeEventListener("keydown",onKey); };
  const onKey=e=>{ if(e.key==="Escape") close(); };
  overlay.querySelector("#rpClose").onclick=close;
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(); });
  window.addEventListener("keydown",onKey);
}

function renderFlagThread(flags, names, qid){
  // Bouw thread: roots (parent_id null) chronologisch, met children eronder (chronologisch)
  const byParent={ null:[] };
  flags.forEach(f=>{ const p=f.parent_id||"null"; (byParent[p]=byParent[p]||[]).push(f); });
  const letterFn = qid ? (idxs=>lettersOfForQ(qid, idxs)) : lettersOf;
  // Klikbare popup-knop die de juiste {X} in de textarea invoegt
  const refPanel = qid ? `<div class="btnrow" style="margin:.3rem 0"><button type="button" class="btn btn-ghost btn-sm ref-picker-btn" data-ref-picker-for="${qid}">${ICON.info} Verwijs naar een antwoord…</button></div>` : "";
  const renderOne=(f, depth)=>{
    const isReply=!!f.parent_id;
    const kids=byParent[f.id]||[];
    const isMine = ME && f.user_id === ME.id;
    return `<div class="flag-item ${f.type} ${isReply?"is-reply":""}" data-flag-id="${f.id}" style="${depth>0?`margin-left:${Math.min(depth,3)*1.2}rem;`:""}">
      <div class="flag-head">
        ${isReply?`<span class="flag-reply-arrow" title="Antwoord op reactie hierboven">↳</span>`:""}
        <span class="pill ${f.type}">${f.type}</span>
        ${f.status==="afgehandeld"?`<span class="pill afgehandeld">afgehandeld</span>`:""}
        <span class="who">${esc(names[f.user_id]||"?")}</span>
        ${arr(f.preferred_indexes).length?` <span class="muted">· verkiest <strong>${letterFn(f.preferred_indexes)}</strong></span>`:""}
        <span class="when">${fmtDate(f.created_at)}</span>
        <button class="btn btn-ghost btn-sm flag-reply-btn" data-reply-to="${f.id}" title="Reageer op deze reactie">Reageer</button>
        ${isMine?`<button class="btn btn-ghost btn-sm flag-edit-btn" data-edit="${f.id}" title="Wijzig je eigen reactie">Bewerken</button>
          <button class="btn btn-danger btn-sm flag-del-btn" data-del="${f.id}" title="Verwijder je eigen reactie">Verwijder</button>`:""}
      </div>
      ${f.toelichting?`<div class="flag-body cmt">${formatCommentBody(f.toelichting, qid)}</div>`:""}
      ${isMine?`<div class="flag-edit-form" data-edit-form-for="${f.id}" hidden>
        <textarea class="flag-edit-text">${esc(f.toelichting||"")}</textarea>
        <div class="ref-hint">
          <div><strong>⚠️ Let op:</strong> schrijf <em>niet</em> "antwoord C" — bij een andere speler zit die letter op een andere optie na de shuffle.</div>
          <div style="margin-top:.3rem">💡 Gebruik <code>{A}</code>, <code>{B}</code>, <code>{juist}</code> of <code>{docent}</code>.</div>
        </div>
        <div class="fmt-hint">Opmaak: <code>**vet**</code>, <code>*cursief*</code>, <code>&#96;code&#96;</code>, <code>- </code> voor bullets, witregel voor paragrafen.</div>
        ${refPanel}
        <div class="btnrow">
          <button class="btn btn-primary btn-sm flag-edit-save" data-edit-save="${f.id}">Opslaan</button>
          <button class="btn btn-ghost btn-sm flag-edit-cancel" data-edit-cancel="${f.id}">Annuleer</button>
        </div>
      </div>`:""}
      <div class="flag-reply-form" data-reply-form-for="${f.id}" hidden>
        <textarea class="flag-reply-text" placeholder="Reageer op ${esc(names[f.user_id]||"deze reactie")}…"></textarea>
        <div class="ref-hint">
          <div><strong>⚠️ Let op:</strong> schrijf <em>niet</em> "antwoord C" — bij een andere speler zit die letter op een andere optie na de shuffle.</div>
          <div style="margin-top:.3rem">💡 Gebruik <code>{A}</code>, <code>{B}</code>, <code>{juist}</code> of <code>{docent}</code> — die worden vertaald naar de juiste letter voor elke lezer.</div>
        </div>
        <div class="fmt-hint">Opmaak: <code>**vet**</code>, <code>*cursief*</code>, <code>&#96;code&#96;</code>, <code>- </code> voor bullets, witregel voor paragrafen.</div>
        ${refPanel}
        <div class="btnrow">
          <button class="btn btn-primary btn-sm flag-reply-send" data-reply-send="${f.id}">Versturen</button>
          <button class="btn btn-ghost btn-sm flag-reply-cancel" data-reply-cancel="${f.id}">Annuleer</button>
        </div>
      </div>
      ${kids.map(k=>renderOne(k, depth+1)).join("")}
    </div>`;
  };
  const roots=byParent["null"]||[];
  if(!roots.length && !flags.length) return `<p class="muted">Nog geen reacties.</p>`;
  return roots.map(r=>renderOne(r,0)).join("");
}

async function renderAfterAnswer(q){
  const box=document.getElementById("afterAnswer");
  box.innerHTML=`<div class="muted">Laden…</div>`;
  if(q.question_type==="matrix" || q.question_type==="open"){
    return renderAfterAnswerNonMcq(q);
  }
  const [{data:flags},{data:edits}] = await Promise.all([
    sb.from("flags").select("*").eq("question_id",q.id).order("created_at",{ascending:true}),
    sb.from("question_edits").select("*").eq("question_id",q.id).order("created_at",{ascending:false}),
  ]);
  const names = await namesFor([...(flags||[]).map(f=>f.user_id),...(edits||[]).map(e=>e.edited_by)]);
  const correct=arr(q.correct_indexes);
  // collectief beeld — per gebruiker de meest recente voorkeur uit de flags
  const votes=votesByUser(flags); const voters=Object.keys(votes); const totV=voters.length;
  const myVote=votes[ME.id];
  const dist=(q.options||[]).map((_,i)=>voters.filter(u=>inSet(votes[u],i)).length);
  const wrongVotes=voters.filter(u=>!setEq(votes[u],correct)).length;
  const displayIdxs = displayOrder(q.id) || (q.options||[]).map((_,i)=>i);
  const bars=displayIdxs.map((origIdx,pos)=>`
    <div class="spread" style="gap:.5rem"><div class="bar ${correct.includes(origIdx)?"correct":""}" style="flex:1">
      <span style="width:${pct(dist[origIdx],totV)}%"></span><div class="lab">${letter(pos)} — ${pct(dist[origIdx],totV)}% (${dist[origIdx]})</div></div></div>`).join("");

  // docent-consensus uit flags met type=docent (voor als er nog geen officieel docent_indexes is)
  const docentFlags=(flags||[]).filter(f=>f.type==="docent" && arr(f.preferred_indexes).length);
  const docentVotes={};   // idx → aantal
  const docentUsers=new Set();
  docentFlags.forEach(f=>{ if(docentUsers.has(f.user_id)) return; docentUsers.add(f.user_id); arr(f.preferred_indexes).forEach(i=>docentVotes[i]=(docentVotes[i]||0)+1); });
  const officialDocent=arr(q.docent_indexes);
  const hasOfficialDocent=officialDocent.length>0;
  const hasDocentConsensus=!hasOfficialDocent && docentUsers.size>=1;
  const docentBlock=(q._show_docent && (hasOfficialDocent || hasDocentConsensus)) ? (()=>{
    const idxs = hasOfficialDocent ? officialDocent : Object.keys(docentVotes).map(Number).sort((a,b)=>docentVotes[b]-docentVotes[a]);
    const differs = !setEq(idxs, arr(q.correct_indexes));
    const items=idxs.map(i=>`<li><strong>${letterForOrig(q.id, i)}.</strong> ${esc((q.options||[])[i]||"")}</li>`).join("");
    const src = hasOfficialDocent
      ? `<span class="docent-src">Officieel genoteerd door beheerder</span>`
      : `<span class="docent-src">Op basis van ${docentUsers.size} melding${docentUsers.size===1?"":"en"} door spelers — nog niet officieel bevestigd</span>`;
    return `<div class="docent-block ${differs?"differs":"agrees"}">
      <div class="docent-hd">👨‍🏫 <strong>Volgens de docent</strong> ${differs?`<span class="pill" style="background:var(--warn-soft);color:var(--warn)">wijkt af van wettelijk antwoord</span>`:`<span class="pill juist">stemt overeen</span>`}</div>
      <ul class="docent-items">${items}</ul>
      ${hasOfficialDocent && q.docent_note ? `<div class="docent-note">${esc(translateOptRefs(q.docent_note, q.id))}</div>` : ""}
      ${src}
    </div>`;
  })() : "";

  box.innerHTML=`
    ${q.validated===false?`<div class="notice">${ICON.info} <strong>Nog geen gevalideerd juist antwoord.</strong> Bekijk hieronder welk antwoord de groep verkiest, kies zelf je voorkeursantwoord en gebruik de flags om in overleg te gaan.</div>`:""}
    <div class="explain">
      <span class="lbl">Wettelijk juist antwoord ${srcBadge("Uitleg",q.explanation_source)}</span>${html(translateOptRefs(q.explanation||"— geen uitleg —", q.id))}
      ${q.legal_basis?`<div class="legal-inline"><strong>Wettelijke basis:</strong> ${srcBadge("Wettelijke basis",q.legal_basis_source)} ${html(translateOptRefs(q.legal_basis, q.id))}</div>`:""}
      ${q.wettekst?`<details class="wettekst-d"><summary>${ICON.info} Toon wettekst</summary><div class="wettekst">${html(translateOptRefs(q.wettekst, q.id))}</div></details>`:""}
    </div>
    ${docentBlock}

    <details><summary>${ICON.chat} Reageer op deze vraag</summary>
      <div class="body">
        <div class="btnrow" id="reactBtns">
          <button class="chip-toggle" data-ftype="twijfel">Ik twijfel</button>
          <button class="chip-toggle" data-ftype="fout">Antwoord is fout</button>
          <button class="chip-toggle" data-ftype="juist">Antwoord is juist</button>
          ${q._show_docent?`<button class="chip-toggle" data-ftype="docent">👨‍🏫 Onze docent koos…</button>`:""}
        </div>
        <div id="reactPref" hidden>
          <label id="rPrefLabel">Welk antwoord vind jij dan juist?</label>
          <div class="opref-list">
            ${((displayOrder(q.id)||(q.options||[]).map((_,i)=>i)).map((origIdx,pos)=>`<label class="opref-item"><input type="checkbox" class="opref" value="${origIdx}" ${myVote&&inSet(myVote,origIdx)?"checked":""}><span><strong>${letter(pos)}.</strong> ${esc((q.options||[])[origIdx]||"")}</span></label>`)).join("")}
          </div>
        </div>
        <div id="reactComment" hidden>
          <label id="rMotLabel">Commentaar</label>
          <textarea id="rMot" placeholder="Leg uit waarom…"></textarea>
          <div class="ref-hint">
            <div><strong>⚠️ Let op:</strong> schrijf <em>niet</em> "antwoord C" of "de derde optie" — bij een andere speler staan de letters in een andere volgorde na de shuffle. "Antwoord C" is voor niemand hetzelfde als voor jou.</div>
            <div style="margin-top:.3rem">💡 <strong>Gebruik in de plaats</strong> de knop hieronder — klik op het antwoord en de juiste <code>{...}</code>-token wordt automatisch ingevoegd.</div>
          </div>
          <div class="fmt-hint">Opmaak: <code>**vet**</code>, <code>*cursief*</code>, <code>&#96;code&#96;</code>, lijnen met <code>- </code> voor bullets, en witregel voor een nieuwe paragraaf.</div>
          <div class="btnrow" style="margin:.3rem 0"><button type="button" class="btn btn-ghost btn-sm ref-picker-btn" data-ref-picker-for="${q.id}" data-target="rMot">${ICON.info} Verwijs naar een antwoord…</button></div>
        </div>
        <div class="btnrow" id="reactSubmitRow" hidden><button class="btn btn-primary btn-sm" id="rSubmit">Versturen</button></div>
      </div></details>

    <details ${(flags&&flags.length)?"open":""}><summary>${ICON.flag} Reacties (${(flags||[]).length}) <span class="muted" style="font-size:.72rem;font-weight:400">— oudste eerst</span></summary>
      <div class="body">
        ${totV?`<label>Collectief beeld — ${wrongVotes} van de ${totV} die reageerden verkiest een ander antwoord dan het huidige${totV>=5?` (${pct(wrongVotes,totV)}%)`:""}</label>${bars}<hr>`:""}
        <div id="flagThread">${renderFlagThread(flags||[], names, q.id)}</div>
      </div></details>

    <details><summary>${ICON.clock} Wijzigingshistoriek (${(edits||[]).length})</summary>
      <div class="body">${(edits||[]).map(e=>`<div class="hist"><span class="who">${esc(names[e.edited_by]||"?")}</span> <span class="when">${fmtDate(e.created_at)}</span><div>${esc(e.summary)}</div></div>`).join("")||`<p class="muted">Nog geen wijzigingen.</p>`}</div></details>`;

  // reactie: flag + (bij twijfel/fout/docent) voorkeursantwoord — één geheel
  let ftype=null;
  box.querySelectorAll("#reactBtns [data-ftype]").forEach(b=>b.onclick=()=>{
    ftype=b.dataset.ftype;
    box.querySelectorAll("#reactBtns [data-ftype]").forEach(x=>x.classList.toggle("active",x===b));
    const needsPref=(ftype==="twijfel"||ftype==="fout"||ftype==="docent");
    document.getElementById("reactPref").hidden=!needsPref;
    document.getElementById("reactComment").hidden=false;
    document.getElementById("reactSubmitRow").hidden=false;
    const prefLabel = ftype==="docent" ? "Welk antwoord duidde de docent aan?" : "Welk antwoord vind jij dan juist?";
    document.getElementById("rPrefLabel").textContent = prefLabel;
    document.getElementById("rMotLabel").textContent = ftype==="docent" ? "Wat zei de docent (optioneel)" : (needsPref?"Waarom denk je dat?":"Commentaar (optioneel)");
    document.getElementById("rMot").placeholder = ftype==="docent" ? "bv. 'Docent Peeters zei tijdens de les van 3/3 dat B correcter is in de praktijk'" : (needsPref?"Leg uit waarom…":"Optionele opmerking…");
  });
  const rs=document.getElementById("rSubmit");
  if(rs) rs.onclick=async()=>{
    if(!ftype) return toast("Kies eerst één van de opties","err");
    const mot=(document.getElementById("rMot").value||"").trim();
    const pref=[...box.querySelectorAll(".opref:checked")].map(c=>+c.value).sort((a,b)=>a-b);
    const needsPref=(ftype==="twijfel"||ftype==="fout"||ftype==="docent");
    if(ftype==="docent" && !pref.length) return toast("Duid aan welk antwoord de docent koos","err");
    if((ftype==="twijfel"||ftype==="fout") && !mot) return toast("Leg kort uit waarom","err");
    const { error:fe }=await sb.from("flags").insert({ question_id:q.id, user_id:ME.id, type:ftype, toelichting:mot, preferred_indexes:pref });
    if(fe) return toast(fe.message,"err");
    toast("Bedankt voor je reactie","ok"); renderAfterAnswer(q);
  };
  // Reply-op-reactie: open form, versturen, annuleren
  box.querySelectorAll("[data-reply-to]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.replyTo;
    const form=box.querySelector(`[data-reply-form-for="${id}"]`);
    if(!form) return;
    box.querySelectorAll(".flag-reply-form").forEach(f=>{ if(f!==form) f.hidden=true; });
    form.hidden=!form.hidden;
    if(!form.hidden){ const ta=form.querySelector("textarea"); if(ta) ta.focus(); }
  });
  box.querySelectorAll("[data-reply-cancel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.replyCancel;
    const form=box.querySelector(`[data-reply-form-for="${id}"]`);
    if(form){ form.hidden=true; const ta=form.querySelector("textarea"); if(ta) ta.value=""; }
  });
  box.querySelectorAll("[data-reply-send]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.replySend;
    const form=box.querySelector(`[data-reply-form-for="${id}"]`);
    const ta=form.querySelector("textarea");
    const text=(ta.value||"").trim();
    if(!text) return toast("Schrijf eerst iets","err");
    const { error }=await sb.from("flags").insert({ question_id:q.id, user_id:ME.id, type:"commentaar", toelichting:text, parent_id:id, preferred_indexes:[] });
    if(error) return toast(error.message,"err");
    toast("Antwoord verzonden","ok"); renderAfterAnswer(q);
  });
  // Eigen reactie bewerken
  box.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.edit;
    const form=box.querySelector(`[data-edit-form-for="${id}"]`);
    if(!form) return;
    box.querySelectorAll(".flag-edit-form").forEach(f=>{ if(f!==form) f.hidden=true; });
    form.hidden=!form.hidden;
    if(!form.hidden){ const ta=form.querySelector("textarea"); if(ta){ ta.focus(); ta.setSelectionRange(ta.value.length, ta.value.length); } }
  });
  box.querySelectorAll("[data-edit-cancel]").forEach(b=>b.onclick=()=>{
    const id=b.dataset.editCancel;
    const form=box.querySelector(`[data-edit-form-for="${id}"]`);
    if(form) form.hidden=true;
  });
  box.querySelectorAll("[data-edit-save]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.editSave;
    const form=box.querySelector(`[data-edit-form-for="${id}"]`);
    const ta=form.querySelector("textarea");
    const text=(ta.value||"").trim();
    if(!text) return toast("De reactie mag niet leeg zijn","err");
    const { error }=await sb.from("flags").update({ toelichting:text }).eq("id",id).eq("user_id",ME.id);
    if(error) return toast(error.message,"err");
    toast("Reactie bijgewerkt","ok"); renderAfterAnswer(q);
  });
  // Verwijs-naar-antwoord popup — vind de meest relevante textarea
  box.querySelectorAll(".ref-picker-btn").forEach(b=>b.onclick=()=>{
    const qid=b.dataset.refPickerFor;
    // Bepaal welke textarea target moet zijn: expliciete data-target, anders zoek in dezelfde form
    let ta=null;
    if(b.dataset.target){ ta=document.getElementById(b.dataset.target); }
    if(!ta){ const form=b.closest("[data-reply-form-for],[data-edit-form-for]"); if(form) ta=form.querySelector("textarea"); }
    if(!ta){ ta=box.querySelector("#rMot"); }
    openRefPicker(qid, ta);
  });
  // Eigen reactie verwijderen
  box.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
    const id=b.dataset.del;
    if(!confirm("Weet je zeker dat je deze reactie wil verwijderen?")) return;
    const { error }=await sb.from("flags").delete().eq("id",id).eq("user_id",ME.id);
    if(error) return toast(error.message,"err");
    toast("Reactie verwijderd","ok"); renderAfterAnswer(q);
  });
}

/* ============================================================
   Post-antwoord blok voor matrix/open vragen
   — vereenvoudigde variant zonder shuffle/optie-stemmen
   ============================================================ */
async function renderAfterAnswerNonMcq(q){
  const box=document.getElementById("afterAnswer");
  const [{data:flags},{data:edits}] = await Promise.all([
    sb.from("flags").select("*").eq("question_id",q.id).order("created_at",{ascending:true}),
    sb.from("question_edits").select("*").eq("question_id",q.id).order("created_at",{ascending:false}),
  ]);
  const names = await namesFor([...(flags||[]).map(f=>f.user_id),...(edits||[]).map(e=>e.edited_by)]);
  const chosen = PLAY.answers[q.id];
  const rightBlock = q.question_type==="matrix"
    ? renderMatrixResultBlock(q, chosen)
    : renderOpenResultBlock(q, chosen);
  const commentFlags = (flags||[]).filter(f=>!f.parent_id);
  const cmts = commentFlags.map(f=>`<div class="flag-thread">
    <div class="flag-hd"><span class="pill ${esc(f.type)}">${esc(f.type)}</span> <span class="who">${esc(names[f.user_id]||"?")}</span> <span class="when">${fmtDate(f.created_at)}</span></div>
    ${f.toelichting?`<div class="cmt">${formatCommentBody(f.toelichting, q.id, q)}</div>`:""}
  </div>`).join("");
  box.innerHTML=`
    ${q.validated===false?`<div class="notice">${ICON.info} <strong>Nog geen gevalideerd juist antwoord.</strong> Gebruik de reacties hieronder om erover in overleg te gaan.</div>`:""}
    ${rightBlock}
    <div class="explain">
      <span class="lbl">Uitleg ${srcBadge("Uitleg",q.explanation_source)}</span>${html(q.explanation||"— geen uitleg —")}
      ${q.legal_basis?`<div class="legal-inline"><strong>Wettelijke basis:</strong> ${srcBadge("Wettelijke basis",q.legal_basis_source)} ${html(q.legal_basis)}</div>`:""}
      ${q.wettekst?`<details class="wettekst-d"><summary>${ICON.info} Toon wettekst</summary><div class="wettekst">${html(q.wettekst)}</div></details>`:""}
    </div>
    <details><summary>${ICON.chat} Reacties (${commentFlags.length})</summary>
      <div class="body">
        ${cmts||`<p class="muted">Nog geen reacties.</p>`}
        <div class="btnrow" style="margin-top:.6rem">
          <textarea id="nonMcqCmt" placeholder="Schrijf een korte reactie…" style="min-height:70px"></textarea>
        </div>
        <div class="btnrow"><button class="btn btn-primary btn-sm" id="sendNonMcqCmt">Reactie plaatsen</button></div>
      </div>
    </details>`;
  const btn=document.getElementById("sendNonMcqCmt");
  if(btn) btn.onclick=async()=>{
    const t=(document.getElementById("nonMcqCmt").value||"").trim();
    if(!t) return toast("Typ eerst je reactie","err");
    const { error } = await sb.from("flags").insert({ question_id:q.id, user_id:ME.id, type:"commentaar", toelichting:t, preferred_indexes:[] });
    if(error) return toast(error.message,"err");
    toast("Reactie geplaatst","ok"); renderAfterAnswerNonMcq(q);
  };
}
function renderMatrixResultBlock(q, chosen){
  const rows=arr(q.matrix_rows), cols=arr(q.matrix_cols), correct=arr(q.matrix_correct);
  const sel = Array.isArray(chosen) ? chosen : new Array(rows.length).fill(-1);
  const lis = rows.map((r,ri)=>{
    const c=correct[ri], s=sel[ri];
    if(c<0) return `<li><strong>${esc(r)}</strong>: geen juist antwoord bepaald.</li>`;
    const good = s===c;
    return `<li class="${good?"ok":"bad"}"><strong>${esc(r)}</strong>: juist = <em>${esc(cols[c]||"?")}</em>${s>=0?` — jouw keuze: <em>${esc(cols[s]||"—")}</em> ${good?"✓":"✗"}`:` — nog geen keuze gemaakt`}</li>`;
  }).join("");
  return `<div class="matrix-result"><div class="lbl">Overzicht per rij</div><ul>${lis}</ul></div>`;
}
function renderOpenResultBlock(q, chosen){
  const given = typeof chosen==="string" ? chosen : "";
  return `<div class="open-result">
    <div><span class="lbl">Jouw antwoord</span><div class="open-given">${esc(given)}</div></div>
    ${q.open_answer?`<div style="margin-top:.6rem"><span class="lbl">Modelantwoord ${srcBadge("Modelantwoord",q.answer_source)}</span><div class="open-model-body">${esc(q.open_answer)}</div></div>`:`<div class="muted" style="margin-top:.4rem">Er is geen modelantwoord ingesteld — deze vraag wordt als "in overleg" geteld.</div>`}
  </div>`;
}

/* haal weergavenamen op voor een set user-ids */
async function namesFor(ids){
  const uniq=[...new Set(ids.filter(Boolean))];
  if(!uniq.length) return {};
  const { data }=await sb.from("profiles").select("id,display_name").in("id",uniq);
  const m={}; (data||[]).forEach(p=>m[p.id]=p.display_name); return m;
}

/* ============================================================
   OVERZICHT per quiz — met flag-filter
   ============================================================ */
async function viewOverview(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  const ids=(questions||[]).map(q=>q.id);
  let flags=[];
  if(ids.length){ const {data}=await sb.from("flags").select("question_id,type,status").in("question_id",ids); flags=data||[]; }
  const fBy={}; flags.forEach(f=>{ (fBy[f.question_id]=fBy[f.question_id]||[]).push(f); });
  let filter="alle";
  const draw=()=>{
    const rows=(questions||[]).filter(q=>{
      const fs=fBy[q.id]||[];
      if(filter==="alle") return true;
      if(filter==="geflagd") return fs.length>0;
      if(filter==="fout") return fs.some(f=>f.type==="fout");
      if(filter==="twijfel") return fs.some(f=>f.type==="twijfel");
      if(filter==="juist") return fs.some(f=>f.type==="juist");
      if(filter==="open") return fs.some(f=>f.status==="open");
      if(filter==="nietgevalideerd") return q.validated===false;
      return true;
    }).map(q=>{
      const fs=fBy[q.id]||[]; const open=fs.filter(f=>f.status==="open").length;
      return `<tr class="row-link" data-qid="${q.id}" data-quiz="${quizId}">
        <td><span class="q-num">${q.qnum}</span></td>
        <td>${esc(q.text).slice(0,120)}${q.text.length>120?"…":""}</td>
        <td>${q.validated===false?`<span class="tag tag-warn">in overleg</span>`:`<strong>${lettersOf(q.correct_indexes)}</strong> ${srcBadge("Antwoord",q.answer_source)}`}</td>
        <td>${fs.length?`<span class="count-chip">${ICON.flag} ${fs.length}${open?` · ${open} open`:""}</span>`:`<span class="muted">—</span>`}</td>
      </tr>`;
    }).join("");
    document.getElementById("ovBody").innerHTML = rows||`<tr><td colspan="4" class="empty">Geen vragen voor dit filter.</td></tr>`;
    document.querySelectorAll("#ovBody .row-link").forEach(r=>r.onclick=()=>{ PLAY_goto(quizId, r.dataset.qid); });
    document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active",b.dataset.filter===filter));
  };
  app.innerHTML=`
    <div class="spread"><h1>Overzicht — ${esc(quiz?quiz.title:"")}</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}/stats">Statistiek</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}">Spelen →</button></div></div>
    <div class="filterbar" style="margin-top:1rem">
      <span class="muted">Filter:</span>
      ${[["alle","alle"],["geflagd","geflagd"],["fout","fout"],["twijfel","twijfel"],["juist","juist"],["open","open"],["nietgevalideerd","niet gevalideerd"]].map(([f,l])=>`<button class="chip-toggle" data-filter="${f}">${l}</button>`).join("")}
    </div>
    <div class="card" style="padding:.3rem .3rem">
      <table><thead><tr><th>#</th><th>Vraag</th><th>Juist</th><th>Flags</th></tr></thead><tbody id="ovBody"></tbody></table>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; draw(); });
  draw();
}
function PLAY_goto(quizId, qid){ PLAY.pendingJump=qid; go("#/quiz/"+quizId); }

/* ============================================================
   HISTORISCHE POGINGEN — bevroren score
   Werking: bij "opslaan" wordt de correct_indexes van elke vraag
   op dat moment mee gesnapshot. Zelfs als een beheerder het juiste
   antwoord later aanpast, blijft de bevroren score in deze poging.
   ============================================================ */
function attemptScoreFrom(answers, snapshot){
  let score=0, wrong=0, answered=0, overleg=0;
  Object.keys(answers||{}).forEach(qid=>{
    const chosen=arr(answers[qid]);
    if(!chosen.length) return;
    answered++;
    const corr=arr(snapshot[qid]);
    if(!corr.length){ overleg++; return; }
    if(setEq(chosen, corr)) score++; else wrong++;
  });
  return { score, wrong, answered, overleg };
}

async function viewAttemptsList(quizId){
  const { data:quiz } = await sb.from("quizzes").select("id,title,description").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const [{data:attempts},{data:questions}] = await Promise.all([
    sb.from("quiz_attempts").select("*").eq("user_id",ME.id).eq("quiz_id",quizId).order("submitted_at",{ascending:false}),
    sb.from("questions").select("id,correct_indexes,validated").eq("quiz_id",quizId),
  ]);
  const currentCorrect={}; (questions||[]).forEach(q=>{ currentCorrect[q.id]=arr(q.correct_indexes); });
  const totalQuestions=(questions||[]).length;
  app.innerHTML=`
    <a class="muted" data-nav="#/quiz/${quizId}">← ${esc(quiz.title)}</a>
    <div class="spread" style="margin-top:.4rem;flex-wrap:wrap;gap:.6rem"><h1 style="margin:0">📜 Historische pogingen</h1>
      <button class="btn btn-primary btn-sm" data-nav="#/quiz/${quizId}/poging/nieuw">+ Nieuwe poging invoeren</button>
    </div>
    <p class="muted" style="font-size:.85rem;margin:.4rem 0 1rem 0">De score wordt live berekend tegen de <strong>huidige</strong> juiste antwoorden van de quiz. Als iemand een correct antwoord aanpast, beweegt jouw score mee.</p>
    ${(attempts||[]).length ? `<div class="stack">${attempts.map(a=>{
      const live=attemptScoreFrom(a.answers||{}, currentCorrect);
      const denom=live.score+live.wrong;
      const pctScore = denom>0 ? Math.round(live.score/denom*100) : 0;
      return `<div class="card attempt-card">
        <div class="spread" style="gap:.6rem;flex-wrap:wrap">
          <div>
            <div class="attempt-title"><strong>${esc(a.title||("Poging "+new Date(a.submitted_at).toLocaleDateString("nl-BE")))}</strong>
              <span class="pill" style="background:var(--surface2);color:var(--text-muted);font-size:.68rem">${a.source||"manual"}</span></div>
            <div class="muted" style="font-size:.78rem">${fmtDate(a.submitted_at)} · ${live.answered}/${totalQuestions} beantwoord${live.overleg>0?` · ${live.overleg} in overleg`:""}</div>
          </div>
          <div class="attempt-score">
            <div class="attempt-score-val ${pctScore>=75?"ok":pctScore>=50?"warn":"bad"}">${live.score}/${totalQuestions} <span style="font-size:.7em;opacity:.85">(${pctScore}%)</span></div>
            <div class="muted" style="font-size:.72rem">${live.answered}/${totalQuestions} beantwoord</div>
          </div>
          <div class="btnrow" style="margin:0">
            <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}/poging/${a.id}">Details</button>
            <button class="btn btn-danger btn-sm" data-del="${a.id}">Verwijder</button>
          </div>
        </div>
      </div>`;
    }).join("")}</div>` : `<div class="empty">Nog geen pogingen. Klik hierboven op "+ Nieuwe poging invoeren" om er eentje toe te voegen.</div>`}
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Deze poging definitief verwijderen?")) return;
    const { error } = await sb.from("quiz_attempts").delete().eq("id",b.dataset.del);
    if(error) return toast(error.message,"err");
    toast("Verwijderd","ok"); viewAttemptsList(quizId);
  });
}

async function viewAttemptDetail(quizId, attemptId){
  const { data:attempt } = await sb.from("quiz_attempts").select("*").eq("id",attemptId).single();
  if(!attempt){ app.innerHTML=`<div class="empty">Poging niet gevonden.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("id,title").eq("id",attempt.quiz_id).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",attempt.quiz_id).order("sort_order");
  const qs=questions||[];
  const answers=attempt.answers||{};
  const currentCorrect={}; qs.forEach(q=>{ currentCorrect[q.id]=arr(q.correct_indexes); });
  const totalQs=qs.length;
  const renderDetail=()=>{
    const live=attemptScoreFrom(answers, currentCorrect);
    const denom=live.score+live.wrong;
    const pctScore = denom>0 ? Math.round(live.score/denom*100) : 0;
    return `
    <a class="muted" data-nav="#/quiz/${quizId}/pogingen">← Pogingen</a>
    <h1 style="margin:.4rem 0">${esc(attempt.title||("Poging "+new Date(attempt.submitted_at).toLocaleDateString("nl-BE")))}</h1>
    <p class="muted" style="font-size:.85rem">${esc(quiz?quiz.title:"")} · ${fmtDate(attempt.submitted_at)}</p>
    <div class="done-card" style="margin-top:1rem">
      <div class="done-score ${pctScore>=75?"ok":pctScore>=50?"warn":"bad"}">${live.score}/${totalQs} <span style="font-size:.6em;font-weight:700;opacity:.8">(${pctScore}%)</span></div>
      <p>${live.answered}/${totalQs} beantwoord${live.overleg>0?` · ${live.overleg} in overleg`:""}</p>
      <p class="muted" style="font-size:.78rem;margin-top:.3rem">Live berekend tegen de huidige juiste antwoorden van de quiz.</p>
    </div>
    <h2 style="margin-top:1.4rem">Vraag-per-vraag</h2>
    <div class="stack" id="attemptDetailList">${qs.map(q=>{
      const chosen = arr(answers[q.id]);
      const curCorrect = arr(q.correct_indexes);
      const answered = chosen.length>0;
      const isCorrect = answered && curCorrect.length && setEq(chosen, curCorrect);
      const cls = !answered ? "onbeantwoord" : (curCorrect.length ? (isCorrect?"juist":"fout") : "overleg");
      const pill = !answered ? `<span class="pill" style="background:var(--surface2);color:var(--text-muted)">niet beantwoord</span>`
                : cls==="juist" ? `<span class="pill juist">juist</span>`
                : cls==="fout" ? `<span class="pill fout">fout</span>`
                : `<span class="pill twijfel">in overleg</span>`;
      return `<details class="rv-item ${cls}" ${cls==="fout"?"open":""}>
        <summary>
          <div class="rv-sum">
            <span class="q-num">${q.qnum}</span>
            <span class="rv-text rv-text-full">${esc(q.text||"")}</span>
            <span class="rv-status">${pill}</span>
          </div>
          <div class="rv-meta">
            <span>Jij: <strong>${answered?lettersOf(chosen):"—"}</strong></span>
            <span>Juist: <strong>${curCorrect.length?lettersOf(curCorrect):"—"}</strong></span>
          </div>
        </summary>
        <div class="rv-body">
          <div class="rv-opts">${(q.options||[]).map((o,i)=>{
            let c="rv-opt";
            if(curCorrect.includes(i)) c+=" correct";
            if(answered && chosen.includes(i) && !curCorrect.includes(i)) c+=" wrong";
            return `<div class="${c}"><strong>${letter(i)}.</strong> ${esc(o)}</div>`;
          }).join("")}</div>
          <details class="attempt-q-edit" data-mine-block="${q.id}">
            <summary>✏️ Mijn eigen antwoord aanpassen</summary>
            <div class="attempt-q-edit-body">
              <p class="muted" style="font-size:.78rem;margin:.2rem 0 .4rem 0">Handig als je bij het invoeren of tijdens de PDF-import iets fout aanvinkte. De score van deze poging past zich meteen aan.</p>
              ${(q.options||[]).map((o,i)=>{
                const isMulti = curCorrect.length>1 || q.multi;
                const t = isMulti ? "checkbox" : "radio";
                return `<label class="attempt-opt-corr ${chosen.includes(i)?"is-mine":""}">
                  <input type="${t}" name="mine-${q.id}" data-mine-qid="${q.id}" value="${i}" ${chosen.includes(i)?"checked":""} data-mine-multi="${isMulti?1:0}">
                  <span class="letter">${letter(i)}.</span>
                  <span>${esc(o)}</span>
                </label>`;
              }).join("")}
              <div class="btnrow" style="margin-top:.4rem">
                <button class="btn btn-primary btn-sm" data-mine-save="${q.id}">Opslaan</button>
                <span class="muted" data-mine-status="${q.id}" style="font-size:.78rem"></span>
              </div>
            </div>
          </details>
          ${isEditor() ? `<div class="btnrow" style="margin-top:.4rem"><a class="btn btn-ghost btn-sm" data-nav="#/beheer/vraag/${q.id}">🛠️ Bewerk de volledige vraag →</a></div>
          <details class="attempt-q-edit" data-corr-block="${q.id}">
            <summary>✏️ Correct antwoord van deze vraag aanpassen</summary>
            <div class="attempt-q-edit-body">
              <p class="muted" style="font-size:.78rem;margin:.2rem 0 .4rem 0">Wijzigingen gelden voor de quiz zelf (voor iedereen). De score van deze poging wordt live herberekend.</p>
              ${(q.options||[]).map((o,i)=>`<label class="attempt-opt-corr ${curCorrect.includes(i)?"is-correct":""}">
                <input type="checkbox" data-corr-qid="${q.id}" value="${i}" ${curCorrect.includes(i)?"checked":""}>
                <span class="letter">${letter(i)}.</span>
                <span>${esc(o)}</span>
              </label>`).join("")}
              <div class="btnrow" style="margin-top:.4rem">
                <button class="btn btn-primary btn-sm" data-corr-save="${q.id}">Opslaan</button>
                <span class="muted" data-corr-status="${q.id}" style="font-size:.78rem"></span>
              </div>
            </div>
          </details>` : ""}
        </div>
      </details>`;
    }).join("")}</div>
  `;
  };
  const wireHandlers=()=>{
    app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
    app.querySelectorAll("[data-corr-save]").forEach(btn=>btn.onclick=async()=>{
      const qid=btn.dataset.corrSave;
      const q=qs.find(x=>x.id===qid); if(!q) return;
      const checked=[...document.querySelectorAll(`[data-corr-qid="${qid}"]:checked`)].map(el=>parseInt(el.value,10)).sort((a,b)=>a-b);
      const statusEl=document.querySelector(`[data-corr-status="${qid}"]`);
      if(statusEl) statusEl.textContent="Opslaan…";
      const { error }=await sb.from("questions").update({ correct_indexes: checked, multi: checked.length>1 }).eq("id",qid);
      if(error){ if(statusEl) statusEl.innerHTML=`<span style="color:var(--wrong)">${esc(error.message)}</span>`; return; }
      q.correct_indexes=checked; q.multi=checked.length>1;
      currentCorrect[qid]=checked;
      // Volledige detail-view opnieuw renderen zodat score en juist/fout-status herberekend zijn
      app.innerHTML=renderDetail();
      wireHandlers();
      toast("Correct antwoord opgeslagen — score herberekend","ok");
    });
    // Eigen antwoord aanpassen
    app.querySelectorAll("[data-mine-save]").forEach(btn=>btn.onclick=async()=>{
      const qid=btn.dataset.mineSave;
      const inputs=[...document.querySelectorAll(`[data-mine-qid="${qid}"]:checked`)];
      const picked=inputs.map(el=>parseInt(el.value,10)).sort((a,b)=>a-b);
      const statusEl=document.querySelector(`[data-mine-status="${qid}"]`);
      if(statusEl) statusEl.textContent="Opslaan…";
      const nextAnswers={...answers};
      if(picked.length) nextAnswers[qid]=picked; else delete nextAnswers[qid];
      const live=attemptScoreFrom(nextAnswers, currentCorrect);
      const { data:updated, error }=await sb.from("quiz_attempts").update({
        answers: nextAnswers,
        score: live.score, wrong: live.wrong, overleg: live.overleg,
        total_answered: live.answered, total_questions: qs.length,
      }).eq("id",attemptId).select();
      if(error){ if(statusEl) statusEl.innerHTML=`<span style="color:var(--wrong)">${esc(error.message)}</span>`; return; }
      if(!updated||!updated.length){ if(statusEl) statusEl.innerHTML=`<span style="color:var(--wrong)">Niet opgeslagen — geen toegang (RLS)</span>`; return; }
      // Update lokale state en herrender
      Object.keys(answers).forEach(k=>delete answers[k]);
      Object.assign(answers, nextAnswers);
      app.innerHTML=renderDetail();
      wireHandlers();
      toast("Jouw antwoord opgeslagen","ok");
    });
  };
  app.innerHTML=renderDetail();
  wireHandlers();
}

async function loadPdfJs(){
  if(window.pdfjsLib) return window.pdfjsLib;
  await new Promise((res, rej)=>{
    const s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js";
    s.onload=res; s.onerror=()=>rej(new Error("pdf.js kon niet geladen worden"));
    document.head.appendChild(s);
  });
  const lib=window.pdfjsLib || (window.pdfjs && window.pdfjs.getDocument ? window.pdfjs : null);
  if(!lib) throw new Error("pdf.js niet beschikbaar");
  lib.GlobalWorkerOptions.workerSrc="https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";
  window.pdfjsLib=lib;
  return lib;
}

// Normaliseer tekst voor fuzzy matching (lowercase, alfanumeriek + spatie)
function normText(s){
  return (s||"").toLowerCase().normalize("NFKD").replace(/[̀-ͯ]/g,"")
    .replace(/[^a-z0-9 ]+/g," ").replace(/\s+/g," ").trim();
}
// Jaccard-woordoverlap
function textSim(a,b){
  const A=new Set(normText(a).split(" ").filter(x=>x.length>=3));
  const B=new Set(normText(b).split(" ").filter(x=>x.length>=3));
  if(!A.size || !B.size) return 0;
  let inter=0; A.forEach(x=>{ if(B.has(x)) inter++; });
  return inter/(A.size+B.size-inter);
}

// PDF-parsing voor MS Forms: render elke pagina en detecteer selectie op basis van
// pixel-donkerheid links van de optietekst. Text-markers zijn onbetrouwbaar want
// de radio buttons zijn vector-graphics, niet tekst.
async function parseFormsPdfPixels(pdf, questions, onProgress){
  const SCALE = 2.0;
  const pages = [];  // { imgData, viewport, lines: [{y, x, text, items}] }

  for(let pn=1; pn<=pdf.numPages; pn++){
    if(onProgress) onProgress(`Pagina ${pn}/${pdf.numPages} renderen…`);
    const page = await pdf.getPage(pn);
    const viewport = page.getViewport({ scale: SCALE });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width; canvas.height = viewport.height;
    const ctx = canvas.getContext("2d", { willReadFrequently:true });
    await page.render({ canvasContext:ctx, viewport }).promise;
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const content = await page.getTextContent();

    // Groepeer text-items in regels op basis van y-coördinaat
    const items = content.items.map(it=>{
      const [a,b,c,d,e,f] = it.transform;
      const [xc, yc] = viewport.convertToViewportPoint(e, f);
      const h = Math.hypot(b, d) * SCALE;
      return { str: it.str, x: xc, y: yc, h };
    }).filter(it=>it.str && it.str.trim());
    items.sort((a,b)=> a.y - b.y || a.x - b.x);
    const lines = [];
    let cur = null;
    for(const it of items){
      if(!cur || Math.abs(it.y - cur.y) > cur.h*0.6){
        cur = { y: it.y, x: it.x, text: it.str, h: it.h, items: [it] };
        lines.push(cur);
      } else {
        cur.items.push(it);
        cur.x = Math.min(cur.x, it.x);
        cur.text += (cur.text.endsWith(" ")?"":" ") + it.str;
      }
    }
    pages.push({ imgData, viewport, lines });
  }

  if(onProgress) onProgress("Vragen matchen…");

  // Vind genummerde vraag-starts over alle pagina's
  const starts = [];
  pages.forEach((pg, pi)=>{
    pg.lines.forEach((ln, li)=>{
      const m = ln.text.match(/^(\d+)\.\s+/);
      if(m) starts.push({ page: pi, lineIdx: li, num: parseInt(m[1],10) });
    });
  });

  // Bouw voor elke start het bijhorende blok van regels tot de volgende start
  const blocks = starts.map((s, i)=>{
    const next = starts[i+1];
    const blockLines = [];
    const endPage = next ? next.page : pages.length-1;
    for(let p = s.page; p <= endPage; p++){
      const lines = pages[p].lines;
      const from = (p===s.page) ? s.lineIdx : 0;
      const to   = (next && p===next.page) ? next.lineIdx : lines.length;
      for(let k=from; k<to; k++) blockLines.push({ page: p, ...lines[k] });
    }
    return { num: s.num, lines: blockLines, text: blockLines.map(l=>l.text).join(" ") };
  });

  // Pixel-sample: fractie "gekleurde" (niet-witte) pixels binnen een cirkeltje.
  // Threshold op 210 — vangt donkere zwarte en gekleurde MS-Forms-bolletjes (paars/blauw).
  const sampleDark = (bmp, cx, cy, r) => {
    let dark=0, tot=0;
    const w = bmp.width, h = bmp.height;
    for(let dy=-r; dy<=r; dy++){
      for(let dx=-r; dx<=r; dx++){
        if(dx*dx + dy*dy > r*r) continue;
        const px = Math.round(cx+dx), py = Math.round(cy+dy);
        if(px<0||py<0||px>=w||py>=h) continue;
        const off = (py*w + px)*4;
        const lum = (bmp.data[off] + bmp.data[off+1] + bmp.data[off+2]) / 3;
        tot++; if(lum < 210) dark++;
      }
    }
    return tot ? dark/tot : 0;
  };

  // Zoek op meerdere x-offsets links van de tekst en pak de hoogste darkness.
  // Robuust tegen wisselende paddings tussen radio en tekst.
  const bestLeftDarkness = (bmp, ln) => {
    const cy = ln.y - ln.h*0.55;
    const r  = Math.max(5, Math.round(ln.h*0.42));
    let maxD = 0, atOffset = 0;
    for(let off=12; off<=55; off+=4){
      const cx = ln.x - off;
      if(cx < r) continue;
      const d = sampleDark(bmp, cx, cy, r);
      if(d > maxD){ maxD = d; atOffset = off; }
    }
    return { darkness: maxD, offset: atOffset };
  };

  const suggestions = {};
  const debug = { matched:0, unmatched:0, perQuestion:[] };
  questions.forEach(q=>{
    // Kies blok met hoogste tekst-overeenkomst met de vraagtekst
    let best=null, bestSim=0;
    for(const bl of blocks){
      const s = textSim(q.text, bl.text);
      if(s > bestSim){ bestSim = s; best = bl; }
    }
    if(!best || bestSim < 0.12){ debug.unmatched++; return; }
    debug.matched++;

    // Verzamel voor elke optie de best matchende regel + darkness links ervan
    const measured = [];
    (q.options||[]).forEach((opt, idx)=>{
      let bl=null, blSim=0;
      for(const ln of best.lines){
        const s = textSim(opt, ln.text);
        if(s > blSim){ blSim = s; bl = ln; }
      }
      if(!bl || blSim < 0.28) return;
      const bmp = pages[bl.page].imgData;
      const m = bestLeftDarkness(bmp, bl);
      measured.push({ idx, darkness: m.darkness, offset: m.offset, sim: blSim });
    });
    if(!measured.length) return;

    // Relatieve detectie: de gekozen optie(s) zijn donkerder dan de niet-gekozen.
    // Baseline = kleinste gemeten darkness. Selected = > baseline + 0.10 én > 0.28 absoluut.
    const baseline = Math.min(...measured.map(m=>m.darkness));
    const isMulti = q.multi || arr(q.correct_indexes).length>1;
    const relThresh = 0.10;
    const absThresh = 0.28;
    let chosen = measured
      .filter(m => m.darkness > baseline + relThresh && m.darkness > absThresh)
      .map(m => m.idx);

    // Radio (single-select): behoud enkel de allerdonkerste
    if(!isMulti && chosen.length > 1){
      const top = measured.reduce((a,b)=> b.darkness > a.darkness ? b : a);
      chosen = [top.idx];
    }
    if(chosen.length) suggestions[q.id] = chosen;
    debug.perQuestion.push({ qnum:q.qnum, baseline:+baseline.toFixed(2), measured:measured.map(m=>({i:m.idx,d:+m.darkness.toFixed(2)})), chosen });
  });
  suggestions.__debug = debug;
  return suggestions;
}

async function viewNewAttempt(quizId){
  const { data:quiz } = await sb.from("quizzes").select("id,title,description").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  const qs=questions||[];
  const state = { title:"", answers:{}, filter:"alle" };  // filter: alle|fout|juist|onbeantwoord

  const qStatus=(q)=>{
    const chosen=arr(state.answers[q.id]);
    const correct=arr(q.correct_indexes);
    if(!chosen.length) return "onbeantwoord";
    if(!correct.length || q.validated===false) return "overleg";
    return setEq(chosen, correct) ? "juist" : "fout";
  };
  const filteredQs=()=>{
    if(state.filter==="alle") return qs;
    if(state.filter==="fout") return qs.filter(q=>qStatus(q)==="fout");
    if(state.filter==="juist") return qs.filter(q=>qStatus(q)==="juist");
    if(state.filter==="onbeantwoord") return qs.filter(q=>qStatus(q)==="onbeantwoord");
    return qs;
  };
  const renderQuestions=()=>{
    const list=filteredQs();
    if(!list.length) return `<p class="muted" style="padding:.6rem">Geen vragen in deze filter.</p>`;
    return list.map(q=>{
      const multi = q.multi || arr(q.correct_indexes).length>1;
      const chosen = arr(state.answers[q.id]);
      const correct = arr(q.correct_indexes);
      const opts = (q.options||[]).map((o,i)=>{
        const isPicked = chosen.includes(i);
        const inputType = multi ? "checkbox" : "radio";
        return `<label class="attempt-opt ${isPicked?"picked":""}">
          <input type="${inputType}" name="ans-${q.id}" value="${i}" ${isPicked?"checked":""} data-qid="${q.id}" data-oidx="${i}" data-multi="${multi?1:0}">
          <span class="letter">${letter(i)}.</span>
          <span>${esc(o)}</span>
        </label>`;
      }).join("");
      const correctEditor = isEditor() ? `
        <details class="attempt-q-edit">
          <summary>✏️ Correct antwoord van deze vraag aanpassen</summary>
          <div class="attempt-q-edit-body">
            <p class="muted" style="font-size:.78rem;margin:.2rem 0 .4rem 0">Vink de juiste antwoord(en) aan. Wijzigingen gelden voor de quiz zelf (dus voor iedereen). Je persoonlijke antwoord blijft ongewijzigd.</p>
            ${(q.options||[]).map((o,i)=>`<label class="attempt-opt-corr ${correct.includes(i)?"is-correct":""}">
              <input type="checkbox" data-corr-qid="${q.id}" value="${i}" ${correct.includes(i)?"checked":""}>
              <span class="letter">${letter(i)}.</span>
              <span>${esc(o)}</span>
            </label>`).join("")}
            <div class="btnrow" style="margin-top:.4rem">
              <button class="btn btn-primary btn-sm" data-corr-save="${q.id}">Opslaan</button>
              <span class="muted corr-status" data-corr-status="${q.id}" style="font-size:.78rem"></span>
            </div>
          </div>
        </details>` : "";
      return `<div class="card attempt-q" data-q-block="${q.id}">
        <div class="attempt-q-hd"><span class="q-num">${q.qnum}</span>${multi?`<span class="pill" style="background:var(--surface2);color:var(--text-muted);font-size:.68rem">meerkeuze</span>`:""}${correct.length?`<span class="muted" style="font-size:.75rem">juist: <strong>${lettersOf(correct)}</strong></span>`:`<span class="pill twijfel" style="font-size:.68rem">nog geen juist antwoord</span>`}</div>
        <div class="q-text" style="margin:.3rem 0 .5rem 0">${esc(q.text)}</div>
        ${q.image_url?`<div class="q-image"><img src="${esc(q.image_url)}" alt="Vraag-afbeelding"></div>`:""}
        <div>${opts}</div>
        ${correctEditor}
      </div>`;
    }).join("");
  };

  app.innerHTML=`
    <a class="muted" data-nav="#/quiz/${quizId}/pogingen">← Pogingen</a>
    <h1 style="margin:.4rem 0">+ Nieuwe poging invoeren</h1>
    <p class="muted" style="font-size:.85rem">Voor: <strong>${esc(quiz.title)}</strong> · ${qs.length} vragen</p>
    <div class="card">
      <label>Titel (optioneel)</label>
      <input id="atTitle" placeholder="bv. Officieel examen 10-07-2026">
      <div style="margin-top:.6rem">
        <label>📄 PDF-antwoordblad (Microsoft Forms)</label>
        <input type="file" id="atPdf" accept="application/pdf">
        <div id="atPdfStatus" class="muted" style="font-size:.78rem;margin-top:.3rem">Optioneel — de app probeert dan je aanduidingen te herkennen. Verifieer daarna zeker even.</div>
      </div>
    </div>
    <div id="atSummary" class="attempt-summary muted" style="margin:.8rem 0"></div>
    <div class="filterbar" id="atFilter" style="margin-bottom:.6rem">
      <span class="muted">Toon:</span>
      ${[["alle","Alle"],["fout","Enkel fout"],["juist","Juist"],["onbeantwoord","Nog niet beantwoord"]].map(([v,l])=>`<button class="chip-toggle" data-atfilter="${v}">${l} <span class="atfilter-count" data-c="${v}">0</span></button>`).join("")}
    </div>
    <div id="atList" class="stack">${renderQuestions()}</div>
    <div class="attempt-actions">
      <div class="btnrow">
        <button class="btn btn-primary" id="atSaveBtn">💾 Poging opslaan</button>
        <button class="btn btn-ghost" data-nav="#/quiz/${quizId}/pogingen">Annuleren</button>
      </div>
    </div>
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));

  const summary=document.getElementById("atSummary");
  const paintSummary=()=>{
    let answered=0, right=0, wrong=0, todo=0;
    qs.forEach(q=>{
      const s=qStatus(q);
      if(s==="onbeantwoord") todo++;
      else { answered++; if(s==="juist") right++; else if(s==="fout") wrong++; }
    });
    summary.innerHTML=`Ingevuld: <strong>${answered}</strong> / ${qs.length} · <span style="color:var(--correct)">${right} juist</span> · <span style="color:var(--wrong)">${wrong} fout</span> · <span class="muted">${todo} nog te doen</span>`;
    document.querySelectorAll(".atfilter-count").forEach(el=>{
      const k=el.dataset.c;
      el.textContent = k==="alle"?qs.length : k==="fout"?wrong : k==="juist"?right : todo;
    });
    document.querySelectorAll("[data-atfilter]").forEach(b=>b.classList.toggle("active", b.dataset.atfilter===state.filter));
  };
  const rerender=()=>{
    document.getElementById("atList").innerHTML=renderQuestions();
    attachOptionHandlers();
    attachCorrectHandlers();
    paintSummary();
  };
  paintSummary();
  document.querySelectorAll("[data-atfilter]").forEach(b=>b.onclick=()=>{ state.filter=b.dataset.atfilter; rerender(); });

  const attachCorrectHandlers=()=>{
    document.querySelectorAll("[data-corr-save]").forEach(btn=>btn.onclick=async()=>{
      const qid=btn.dataset.corrSave;
      const q=qs.find(x=>x.id===qid); if(!q) return;
      const checked=[...document.querySelectorAll(`[data-corr-qid="${qid}"]:checked`)].map(el=>parseInt(el.value,10)).sort((a,b)=>a-b);
      const statusEl=document.querySelector(`[data-corr-status="${qid}"]`);
      const newMulti = checked.length>1;
      if(statusEl) statusEl.textContent="Opslaan…";
      const { error }=await sb.from("questions").update({ correct_indexes: checked, multi: newMulti }).eq("id",qid);
      if(error){ if(statusEl) statusEl.innerHTML=`<span style="color:var(--wrong)">${esc(error.message)}</span>`; return; }
      q.correct_indexes=checked;
      q.multi=newMulti;
      if(statusEl) statusEl.innerHTML=`<span style="color:var(--correct)">✓ Opgeslagen</span>`;
      // Herrender enkel dit blok zodat de status-pill + eventueel single/multi input-type updaten
      const block=document.querySelector(`[data-q-block="${qid}"]`);
      if(block){
        const wrap=document.createElement("div"); wrap.innerHTML=renderQuestions();
        const fresh=wrap.querySelector(`[data-q-block="${qid}"]`);
        if(fresh){ block.replaceWith(fresh); attachOptionHandlers(); attachCorrectHandlers(); paintSummary(); }
      }
    });
  };
  const attachOptionHandlers=()=>{
    document.querySelectorAll("input[data-qid]").forEach(el=>{
      el.onchange=()=>{
        const qid=el.dataset.qid;
        const idx=parseInt(el.dataset.oidx,10);
        const multi=el.dataset.multi==="1";
        const cur=arr(state.answers[qid]);
        if(multi){
          const set=new Set(cur);
          if(el.checked) set.add(idx); else set.delete(idx);
          state.answers[qid]=[...set].sort((a,b)=>a-b);
        } else {
          state.answers[qid]=[idx];
        }
        // Toggle 'picked' klasse op de label
        const block=document.querySelector(`[data-q-block="${qid}"]`);
        if(block){
          block.querySelectorAll(".attempt-opt").forEach(lbl=>{
            const inp=lbl.querySelector("input");
            lbl.classList.toggle("picked", inp && inp.checked);
          });
        }
        paintSummary();
      };
    });
  };
  attachOptionHandlers();
  attachCorrectHandlers();

  document.getElementById("atTitle").oninput=e=>{ state.title=e.target.value; };

  document.getElementById("atPdf").onchange=async e=>{
    const f=e.target.files[0]; if(!f) return;
    const statusEl=document.getElementById("atPdfStatus");
    const setStatus=(msg)=>{ statusEl.textContent=msg; };
    setStatus("PDF laden…");
    try{
      const lib=await loadPdfJs();
      const buf=await f.arrayBuffer();
      const pdf=await lib.getDocument({data:buf}).promise;
      const suggestions=await parseFormsPdfPixels(pdf, qs, setStatus);
      const debug=suggestions.__debug || {}; delete suggestions.__debug;
      console.log("[PDF-import] matched blocks:", debug.matched, "/", qs.length);
      console.log("[PDF-import] per-question darkness:", debug.perQuestion);
      let filled=0;
      Object.keys(suggestions).forEach(qid=>{ state.answers[qid]=suggestions[qid]; filled++; });
      rerender();
      statusEl.innerHTML=`✅ Auto-gedetecteerd voor <strong>${filled}</strong> / ${qs.length} vragen (${debug.matched||0} vragen gematcht in PDF). <span style="color:var(--warn)">Verifieer elke vraag voor je opslaat.</span>`;
    }catch(err){
      statusEl.innerHTML=`<span style="color:var(--wrong)">PDF-import mislukt: ${esc(err.message||err)}</span>`;
    }
  };

  document.getElementById("atSaveBtn").onclick=async()=>{
    const answered=Object.values(state.answers).filter(x=>arr(x).length).length;
    if(answered===0){ toast("Vul minstens één antwoord in.","err"); return; }
    // Snapshot van huidige correct_indexes per vraag
    const snapshot={};
    qs.forEach(q=>{ snapshot[q.id]=arr(q.correct_indexes); });
    const { score, wrong, overleg } = attemptScoreFrom(state.answers, snapshot);
    const row={
      user_id: ME.id,
      quiz_id: quizId,
      source: "manual",
      title: state.title || null,
      answers: state.answers,
      correct_snapshot: snapshot,
      score, wrong,
      total_answered: answered,
      total_questions: qs.length,
    };
    // 'overleg' kolom bestaat niet — voeg mee in title-lokaal niet nodig; enkel gebruikt voor weergave
    row.overleg = overleg;
    const { data, error } = await sb.from("quiz_attempts").insert(row).select().single();
    if(error){ toast("Opslaan mislukt: "+error.message,"err"); return; }
    toast(`Poging opgeslagen — ${score}/${qs.length}`,"ok");
    go("#/quiz/"+quizId+"/poging/"+data.id);
  };
}

/* ============================================================
   STATISTIEK — gedeelde hulpjes
   ============================================================ */
// Per gebruiker de meest recente niet-lege voorkeur uit de flags
function votesByUser(flags){
  const latest={};
  (flags||[]).forEach(f=>{ if(!arr(f.preferred_indexes).length) return; const cur=latest[f.user_id]; if(!cur||(f.created_at||"")>(cur.created_at||"")) latest[f.user_id]=f; });
  const m={}; Object.values(latest).forEach(f=>m[f.user_id]=f.preferred_indexes); return m;
}
function aggregateQuestions(questions, answers, flags){
  const agg={};
  (questions||[]).forEach(q=>agg[q.id]={q, played:0, correct:0, flags:0, wrongVotes:0, votes:0});
  (answers||[]).forEach(a=>{ const x=agg[a.question_id]; if(x && a.is_correct!=null){x.played++; if(a.is_correct)x.correct++;} });
  const byQ={};
  (flags||[]).forEach(f=>{ (byQ[f.question_id]=byQ[f.question_id]||[]).push(f); const x=agg[f.question_id]; if(x)x.flags++; });
  Object.keys(byQ).forEach(qid=>{ const x=agg[qid]; if(!x)return; const v=votesByUser(byQ[qid]); const us=Object.keys(v);
    x.votes=us.length; x.wrongVotes=us.filter(u=>!setEq(v[u],x.q.correct_indexes)).length; });
  return agg;
}
function mountStatsTable(mountId, agg, qtitle){
  let rows=Object.values(agg), sortKey="flags";
  const el=document.getElementById(mountId);
  el.innerHTML=`
    <div class="filterbar"><span class="muted">Sorteer ${infoTip("Meeste flags: vragen met de meeste meldingen bovenaan. Hoogste % fout: waar de meeste mensen een ander antwoord verkiezen. Moeilijkst: laagste % juist beantwoord. Vraagnummer: gewoon op volgorde. Vragen zonder gegevens staan telkens onderaan.")}:</span>
      ${[["flags","meeste flags"],["fout","hoogste % fout"],["moeilijk","moeilijkst"],["nummer","vraagnummer"]].map(([k,l])=>`<button class="chip-toggle" data-sort="${k}">${l}</button>`).join("")}</div>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>#</th><th>Vraag</th><th>% correct ${infoTip("Aandeel spelers dat deze vraag juist beantwoordde.")}</th><th>Flags ${infoTip("Aantal meldingen bij deze vraag (fout / twijfel / juist).")}</th><th>% fout ${infoTip("Aandeel reacties dat een ander antwoord verkiest dan het huidige juiste antwoord.")}</th></tr></thead>
      <tbody></tbody></table></div>`;
  const draw=()=>{
    const num=(a,b)=>a.q.qnum-b.q.qnum;
    rows.sort((a,b)=>{
      if(sortKey==="flags") return b.flags-a.flags || b.wrongVotes-a.wrongVotes || num(a,b);
      if(sortKey==="fout"){ const A=a.votes>0,B=b.votes>0; if(A!==B) return A?-1:1; if(!A) return num(a,b);
        return pct(b.wrongVotes,b.votes)-pct(a.wrongVotes,a.votes) || num(a,b); }
      if(sortKey==="moeilijk"){ const A=a.played>0,B=b.played>0; if(A!==B) return A?-1:1; if(!A) return num(a,b);
        return pct(a.correct,a.played)-pct(b.correct,b.played) || num(a,b); }
      if(sortKey==="nummer") return num(a,b);
      return 0;
    });
    el.querySelector("tbody").innerHTML=rows.map(r=>`
      <tr class="row-link" data-quiz="${r.q.quiz_id}" data-qid="${r.q.id}">
        <td><span class="q-num">${r.q.qnum}</span></td>
        <td>${esc(r.q.text).slice(0,90)}…${qtitle?`<br><span class="muted" style="font-size:.72rem">${esc(qtitle[r.q.quiz_id]||"")}</span>`:""}</td>
        <td>${r.played?`<strong style="color:${(pc=>pc>=70?"var(--correct)":pc>=50?"var(--warn)":"var(--wrong)")(pct(r.correct,r.played))}">${pct(r.correct,r.played)}%</strong>`:"—"}<br><span class="muted" style="font-size:.72rem">${r.played}×</span></td>
        <td>${r.flags?`<span class="count-chip">${r.flags}</span>`:"—"}</td>
        <td>${r.votes?pct(r.wrongVotes,r.votes)+"%":"—"}</td>
      </tr>`).join("");
    el.querySelectorAll(".row-link").forEach(t=>t.onclick=()=>PLAY_goto(t.dataset.quiz, t.dataset.qid));
    el.querySelectorAll("[data-sort]").forEach(b=>b.classList.toggle("active",b.dataset.sort===sortKey));
  };
  el.querySelectorAll("[data-sort]").forEach(b=>b.onclick=()=>{ sortKey=b.dataset.sort; draw(); });
  draw();
}
function learningBlock(myEvents, title){
  const daily=dailyAccuracy(myEvents);
  const imp=improvement(myEvents);
  const impBadge = imp ? `<span class="pill" style="background:${imp.last>=imp.first?"var(--correct-soft)":"var(--wrong-soft)"};color:${imp.last>=imp.first?"var(--correct)":"var(--wrong)"}">${imp.last>=imp.first?"▲":"▼"} ${imp.first}% → ${imp.last}%</span>` : "";
  return `<h2>${esc(title)} ${impBadge}</h2>
    <p class="muted">% juist per dag${imp?` — vergelijking eerste helft (${imp.first}%) versus tweede helft (${imp.last}%) van je antwoorden.`:"."}</p>
    <div class="card">${lineChartSVG(daily)}</div>`;
}

/* ============================================================
   STATISTIEK — algemeen (alle quizzen)
   ============================================================ */
async function viewStatsVragen(){
  const [{data:questions},{data:answers},{data:flags},{data:quizzes},
    {data:global},{data:perQuizStats},{data:dailyAns},{data:dailyVis},{data:hourly48}] = await Promise.all([
    sb.from("questions").select("id,qnum,quiz_id,text,correct_indexes,options").range(0,4999),
    sb.from("answers").select("question_id,is_correct").range(0,99999),
    sb.from("flags").select("question_id,type,user_id,preferred_indexes,created_at").range(0,49999),
    sb.from("quizzes").select("id,title,status"),
    sb.from("global_stats_public").select("*").single(),
    sb.from("quiz_stats_public").select("*"),
    sb.from("daily_answers_public").select("*"),
    sb.from("daily_visits_public").select("*"),
    sb.from("hourly_answers_48h_public").select("*"),
  ]);
  const qtitle={}; (quizzes||[]).forEach(q=>qtitle[q.id]=q.title);
  const agg=aggregateQuestions(questions, answers, flags);
  const perQuizMap={}; (perQuizStats||[]).forEach(r=>perQuizMap[r.quiz_id]=r);
  const perQuiz=(quizzes||[]).map(q=>({ q, s: perQuizMap[q.id] || {n_questions:0,total_answers:0,correct_answers:0,n_players:0,n_flags:0} }));
  // Grafiek-hulpjes: converteer view-rijen naar {label,value}
  const dailyToPoints=rows=>(rows||[]).map(r=>({label:(r.day||"").slice(5), value:Number(r.n)||0}));
  // vul 48u met nullen zodat lege uren zichtbaar zijn
  const hourly48Points=(()=>{
    const now=new Date(); now.setMinutes(0,0,0);
    const idx={};
    for(let i=47;i>=0;i--){ const d=new Date(now.getTime()-i*3600000); const k=d.toISOString().slice(0,13); idx[k]={label:d.getHours().toString().padStart(2,"0")+"u", value:0}; }
    (hourly48||[]).forEach(r=>{ const k=(r.hour||"").slice(0,13); if(idx[k]) idx[k].value=Number(r.n)||0; });
    return Object.values(idx);
  })();

  app.innerHTML=`
    <h1>Statistiek — algemeen</h1>
    <p class="muted">Over alle quizzen heen. Publiek zichtbaar.</p>
    <div class="kpis">
      ${kpi("Quizzen",(global&&global.n_quizzes)||0)}
      ${kpi("Vragen",(global&&global.n_questions)||0)}
      ${kpi("Antwoorden gegeven",(global&&global.total_answers)||0)}
      ${kpi("Actieve gebruikers",(global&&global.n_players)||0)}
      ${kpi("Bezoeken",(global&&global.n_visits)||0)}
    </div>
    <h2>Laatste 48 uur — beantwoorde vragen per uur</h2>
    <div class="card">${barChartSVG(hourly48Points,{color:"#16803d"})}</div>
    <h2>Bezoeken per dag</h2>
    <div class="card">${barChartSVG(dailyToPoints(dailyVis),{color:"#1d3a99"})}</div>
    <h2>Antwoorden per dag</h2>
    <div class="card">${barChartSVG(dailyToPoints(dailyAns),{color:"#2952cc"})}</div>
    <h2>Per quiz</h2>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr><th>Quiz</th><th>Vragen</th><th>Antwoorden</th><th>Gem. % juist</th><th>Spelers</th><th>Flags</th><th></th></tr></thead>
      <tbody>${perQuiz.map(x=>`<tr>
        <td>${esc(x.q.title)} ${x.q.status!=="gepubliceerd"?`<span class="badge concept">concept</span>`:""}</td>
        <td>${x.s.n_questions}</td><td>${x.s.total_answers}</td><td>${x.s.total_answers?pct(x.s.correct_answers,x.s.total_answers)+"%":"—"}</td>
        <td>${x.s.n_players}</td><td>${x.s.n_flags||"—"}</td>
        <td><a class="btn btn-ghost btn-sm" data-nav="#/quiz/${x.q.id}/stats">Details</a></td></tr>`).join("")}</tbody>
    </table></div>
    <h2>Alle vragen</h2>
    <div id="svTable"></div>
    <h2 style="margin-top:1.8rem">🎮 Games</h2>
    <div id="gamesStatsMount"><p class="muted">Games-statistieken laden…</p></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  mountStatsTable("svTable", agg, qtitle);
  renderGamesStatsBlock();
}

async function renderGamesStatsBlock(){
  await loadGamesConfig();
  const mount=document.getElementById("gamesStatsMount"); if(!mount) return;
  const list=activeGames();
  if(!list.length){ mount.innerHTML=`<p class="muted">Geen actieve games.</p>`; return; }
  const [mine, all] = await Promise.all([
    Promise.all(list.map(g=>gameStats(g.id, "me"))),
    Promise.all(list.map(g=>gameStats(g.id, "all"))),
  ]);
  mount.innerHTML=`<div class="games-stats-grid">${list.map((g,i)=>{
    const m=mine[i], a=all[i];
    return `<div class="games-stats-tile">
      <div class="games-stats-hd"><span class="games-stats-icon">${g.icon}</span><strong>${esc(g.name)}</strong></div>
      <div class="games-stats-tiles">
        <div class="games-stats-cell">
          <div class="games-stats-val">${a.plays||0}</div>
          <div class="games-stats-lab">gespeeld (iedereen)</div>
        </div>
        <div class="games-stats-cell">
          <div class="games-stats-val">${m.plays||0}</div>
          <div class="games-stats-lab">gespeeld (jij)</div>
        </div>
        <div class="games-stats-cell games-stats-hero">
          <div class="games-stats-val">${m.plays?m.best:"—"}</div>
          <div class="games-stats-lab">jouw highscore</div>
        </div>
      </div>
    </div>`;
  }).join("")}</div>
  <p class="muted" style="font-size:.78rem;margin-top:.6rem">Cumulatief — negeert de scorereset. Volledige ranglijst per periode: <a class="ilink" data-nav="#/scorebord">Scorebord →</a></p>`;
  mount.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
}

/* ============================================================
   STATISTIEK — per quiz
   ============================================================ */
async function viewQuizStats(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("id,qnum,quiz_id,text,correct_indexes,options").eq("quiz_id",quizId).order("sort_order");
  const ids=(questions||[]).map(q=>q.id);
  const [{data:answers},{data:flags},{data:myEvents},{data:allEvents}] = await Promise.all([
    ids.length? sb.from("answers").select("question_id,is_correct,user_id").in("question_id",ids).range(0,99999) : Promise.resolve({data:[]}),
    ids.length? sb.from("flags").select("question_id,type,user_id,preferred_indexes,created_at").in("question_id",ids).range(0,49999) : Promise.resolve({data:[]}),
    sb.from("answer_events").select("is_correct,created_at").eq("quiz_id",quizId).eq("user_id",ME.id).range(0,49999),
    sb.from("answer_events").select("is_correct,created_at,user_id").eq("quiz_id",quizId).range(0,199999),
  ]);
  const agg=aggregateQuestions(questions, answers, flags);
  const myAnsSet=new Set((answers||[]).filter(a=>a.user_id===ME.id).map(a=>a.question_id));
  const myScoredN=(answers||[]).filter(a=>a.user_id===ME.id && a.is_correct!=null).length;
  const myCorrect=(answers||[]).filter(a=>a.user_id===ME.id && a.is_correct===true).length;
  const spelers=new Set((allEvents||[]).map(e=>e.user_id)).size;
  const hardest=Object.values(agg).filter(r=>r.played>0).sort((a,b)=>pct(a.correct,a.played)-pct(b.correct,b.played)).slice(0,8);
  const flagged=Object.values(agg).filter(r=>r.flags>0).sort((a,b)=>b.flags-a.flags).slice(0,8);
  // community daily curve
  const commDaily=dailyAccuracy(allEvents||[]);

  app.innerHTML=`
    <div class="spread"><h1>Statistiek — ${esc(quiz.title)}</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}">Spelen →</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/quiz/${quizId}/overzicht">Overzicht</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/stats/vragen">Alle quizzen</button>
      </div></div>
    <div class="kpis">
      ${kpi("Vragen",(questions||[]).length)}
      ${kpi("Jij beantwoord",`${myAnsSet.size}/${(questions||[]).length}`, (questions||[]).length?pct(myAnsSet.size,(questions||[]).length)+"% gezien":"")}
      ${kpi("Jouw % juist",myScoredN?pct(myCorrect,myScoredN)+"%":"—")}
      ${kpi("Antwoorden (allen)",(allEvents||[]).length)}
      ${kpi("Spelers",spelers)}
    </div>
    ${learningBlock(myEvents||[], "Jouw vooruitgang op deze quiz")}
    <h2>Vooruitgang van iedereen samen</h2>
    <p class="muted">% juist per dag, alle spelers samen — zie of de groep beter wordt.</p>
    <div class="card">${lineChartSVG(commDaily,{color:"#16803d"})}</div>
    <div class="two-col">
      <div><h2>Moeilijkste vragen</h2><div class="card">${hardest.length?hardest.map(r=>`<div class="spread mini row-link" data-quiz="${r.q.quiz_id}" data-qid="${r.q.id}"><span><span class="q-num">${r.q.qnum}</span> ${esc(r.q.text).slice(0,60)}…</span><strong>${pct(r.correct,r.played)}%</strong></div>`).join(""):`<p class="muted">Nog geen antwoorden.</p>`}</div></div>
      <div><h2>Meest geflagd</h2><div class="card">${flagged.length?flagged.map(r=>`<div class="spread mini row-link" data-quiz="${r.q.quiz_id}" data-qid="${r.q.id}"><span><span class="q-num">${r.q.qnum}</span> ${esc(r.q.text).slice(0,60)}…</span><span class="count-chip">${ICON.flag} ${r.flags}</span></div>`).join(""):`<p class="muted">Nog geen flags.</p>`}</div></div>
    </div>
    <h2>Alle vragen</h2>
    <div id="qsTable"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll(".mini.row-link").forEach(el=>el.onclick=()=>PLAY_goto(el.dataset.quiz, el.dataset.qid));
  mountStatsTable("qsTable", agg, null);
}

/* ============================================================
   STATISTIEK — gebruikers
   ============================================================ */
async function viewStatsGebruikers(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Deze pagina is enkel voor beheerders.</div>`; return; }
  const [{data:profiles},{data:userStats}] = await Promise.all([
    sb.from("profiles").select("id,display_name,role,cohort"),
    sb.from("user_stats_public").select("*"),
  ]);
  const statsById={}; (userStats||[]).forEach(s=>statsById[s.user_id]=s);
  // We tonen antwoord-EVENTS (elke poging, ook herhaald), niet enkel unieke vragen
  const agg={}; (profiles||[]).forEach(p=>{ const s=statsById[p.id]||{}; agg[p.id]={p,ans:s.n_events||0,correct:s.n_events_correct||0,flags:s.n_flags||0,visits:s.n_visits||0,unique:s.n_answers||0}; });
  const all=Object.values(agg);
  // cohort-overzicht
  const byCohort={}; all.forEach(r=>{ const c=r.p.cohort||"—"; (byCohort[c]=byCohort[c]||{n:0,ans:0,correct:0,visits:0}); byCohort[c].n++; byCohort[c].ans+=r.ans; byCohort[c].correct+=r.correct; byCohort[c].visits+=r.visits; });
  const cohortRows=Object.entries(byCohort).map(([name,v])=>({name, n:v.n, ans:v.ans, correct:v.correct, visits:v.visits, pctc:v.ans?v.correct/v.ans*100:-1}));
  let filter="__alle";
  let uSort={key:"ans", dir:"desc"};
  let cSort={key:"name", dir:"asc"};
  const uKeyOf=(r,k)=>({name:(r.p.display_name||"").toLowerCase(), cohort:(r.p.cohort||"").toLowerCase(), role:r.p.role, ans:r.ans, unique:r.unique, pctc:r.ans?r.correct/r.ans*100:-1, visits:r.visits, flags:r.flags})[k];
  const cKeyOf=(r,k)=>({name:(r.name||"").toLowerCase(), n:r.n, ans:r.ans, pctc:r.pctc, visits:r.visits})[k];
  const cmp=(a,b,dir)=>{ if(a<b)return dir==="asc"?-1:1; if(a>b)return dir==="asc"?1:-1; return 0; };
  const arrow=(col,st)=>st.key===col?` <span class="muted" style="font-size:.72rem">${st.dir==="asc"?"▲":"▼"}</span>`:"";
  const drawU=()=>{
    const rows=all.filter(r=>filter==="__alle"||(r.p.cohort||"—")===filter).slice().sort((a,b)=>cmp(uKeyOf(a,uSort.key),uKeyOf(b,uSort.key),uSort.dir));
    document.getElementById("guBody").innerHTML=rows.map(r=>`<tr><td>${esc(r.p.display_name)}</td><td>${esc(r.p.cohort||"—")}</td><td><span class="role ${r.p.role}">${r.p.role}</span></td>
      <td>${r.ans}</td><td class="muted">${r.unique}</td><td>${r.ans?pct(r.correct,r.ans)+"%":"—"}</td><td>${r.visits}</td><td>${r.flags}</td></tr>`).join("");
    document.querySelectorAll("[data-coh]").forEach(b=>b.classList.toggle("active",b.dataset.coh===filter));
    document.querySelectorAll("[data-usort]").forEach(t=>t.innerHTML=t.dataset.label+arrow(t.dataset.usort,uSort));
  };
  const drawC=()=>{
    const rows=cohortRows.slice().sort((a,b)=>cmp(cKeyOf(a,cSort.key),cKeyOf(b,cSort.key),cSort.dir));
    document.getElementById("gcBody").innerHTML=rows.map(c=>`<tr><td>${esc(c.name)}</td><td>${c.n}</td><td>${c.ans}</td><td>${c.ans?pct(c.correct,c.ans)+"%":"—"}</td><td>${c.visits}</td></tr>`).join("");
    document.querySelectorAll("[data-csort]").forEach(t=>t.innerHTML=t.dataset.label+arrow(t.dataset.csort,cSort));
  };
  const cohorts=["__alle",...Object.keys(byCohort).sort()];
  const thU=(k,l)=>`<th data-usort="${k}" data-label="${l}" style="cursor:pointer;user-select:none">${l}</th>`;
  const thC=(k,l)=>`<th data-csort="${k}" data-label="${l}" style="cursor:pointer;user-select:none">${l}</th>`;
  app.innerHTML=`
    <h1>Gebruikersstatistiek</h1>
    <p class="muted">Publiek zichtbaar. Klik op een kolomkop om te sorteren.</p>
    <p class="muted" style="font-size:.82rem"><strong>Beantwoord</strong> = totaal aantal keer dat de speler een vraag beantwoord heeft (herhalingen tellen mee). <strong>Uniek</strong> = aantal verschillende vragen die de speler ooit beantwoord heeft (max = totaal aantal vragen).</p>
    <h2>Per oorsprong</h2>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr>${thC("name","Oorsprong")}${thC("n","Gebruikers")}${thC("ans","Antwoorden")}${thC("pctc","Gem. % correct")}${thC("visits","Bezoeken")}</tr></thead>
      <tbody id="gcBody"></tbody></table></div>
    <h2>Gebruikers</h2>
    <div class="filterbar"><span class="muted">Oorsprong:</span>${cohorts.map(c=>`<button class="chip-toggle" data-coh="${esc(c)}">${c==="__alle"?"alle":esc(c)}</button>`).join("")}</div>
    <div class="card" style="padding:.3rem"><table>
      <thead><tr>${thU("name","Naam")}${thU("cohort","Oorsprong")}${thU("role","Rol")}${thU("ans","Beantwoord")}${thU("unique","Uniek")}${thU("pctc","% correct")}${thU("visits","Bezoeken")}${thU("flags","Reacties")}</tr></thead>
      <tbody id="guBody"></tbody></table></div>`;
  app.querySelectorAll("[data-coh]").forEach(b=>b.onclick=()=>{ filter=b.dataset.coh; drawU(); });
  app.querySelectorAll("[data-usort]").forEach(t=>t.onclick=()=>{ const k=t.dataset.usort; uSort.dir=(uSort.key===k&&uSort.dir==="desc")?"asc":"desc"; uSort.key=k; drawU(); });
  app.querySelectorAll("[data-csort]").forEach(t=>t.onclick=()=>{ const k=t.dataset.csort; cSort.dir=(cSort.key===k&&cSort.dir==="asc")?"desc":"asc"; cSort.key=k; drawC(); });
  drawC(); drawU();
}

/* ============================================================
   MIJN ACCOUNT — reacties, profiel, wachtwoord
   ============================================================ */
async function viewAccount(){
  const [{data:flags},{data:myEvents},{data:myAttempts},{data:allQuizzes}] = await Promise.all([
    sb.from("flags").select("*").eq("user_id",ME.id).order("created_at",{ascending:false}).range(0,9999),
    sb.from("answer_events").select("is_correct,created_at").eq("user_id",ME.id).range(0,49999),
    sb.from("quiz_attempts").select("*").eq("user_id",ME.id).order("submitted_at",{ascending:false}).limit(50),
    sb.from("quizzes").select("id,title"),
  ]);
  const quizTitle={}; (allQuizzes||[]).forEach(q=>quizTitle[q.id]=q.title);
  // Voor elke poging: haal huidige juiste antwoorden op om score live te herberekenen
  const attemptQuizIds=[...new Set((myAttempts||[]).map(a=>a.quiz_id))];
  const currentCorrectByQuiz={}; const totalQsByQuiz={};
  if(attemptQuizIds.length){
    const { data:qq } = await sb.from("questions").select("id,quiz_id,correct_indexes").in("quiz_id",attemptQuizIds);
    (qq||[]).forEach(q=>{
      currentCorrectByQuiz[q.quiz_id] = currentCorrectByQuiz[q.quiz_id] || {};
      currentCorrectByQuiz[q.quiz_id][q.id] = arr(q.correct_indexes);
      totalQsByQuiz[q.quiz_id] = (totalQsByQuiz[q.quiz_id]||0) + 1;
    });
  }
  const qids=[...new Set((flags||[]).map(f=>f.question_id))];
  let qmap={};
  if(qids.length){ const {data:qq}=await sb.from("questions").select("id,qnum,quiz_id").in("id",qids); (qq||[]).forEach(q=>qmap[q.id]=q); }
  const qlink=(qid)=>{ const q=qmap[qid]; return q?`<a class="ilink" data-q="${qid}" data-quiz="${q.quiz_id}">Vraag ${q.qnum}</a>`:`<span class="muted">(verwijderde vraag)</span>`; };
  const myScored=scored(myEvents).length;
  const myCorrect=(myEvents||[]).filter(e=>e.is_correct===true).length;
  const myPct=myScored?pct(myCorrect,myScored):null;

  // cohort-vergelijking
  let cohortBlock="";
  if(ME.cohort){
    const { data:peers } = await sb.from("profiles").select("id").eq("cohort",ME.cohort);
    const peerIds=(peers||[]).map(p=>p.id);
    if(peerIds.length>=2){
      const { data:peerEvents } = await sb.from("answer_events").select("user_id,is_correct").in("user_id",peerIds).range(0,199999);
      // per user % juist (enkel gevalideerd)
      const byUser={};
      (peerEvents||[]).forEach(e=>{ if(e.is_correct==null) return; const x=byUser[e.user_id]=byUser[e.user_id]||{c:0,t:0}; x.t++; if(e.is_correct)x.c++; });
      const scores=Object.entries(byUser).filter(([,v])=>v.t>=5).map(([uid,v])=>({uid, p:v.c/v.t*100}));
      if(scores.length>=2){
        const avg=Math.round(scores.reduce((a,b)=>a+b.p,0)/scores.length);
        scores.sort((a,b)=>b.p-a.p);
        const myInScores=scores.findIndex(s=>s.uid===ME.id);
        const inRanking = myInScores>=0;
        const rankStr = inRanking ? `${myInScores+1}<span class="muted" style="font-size:.7em">e</span> / ${scores.length}` : "—";
        const diff = (inRanking && myPct!=null) ? myPct-avg : null;
        const diffBadge = diff!=null ? `<span class="pill" style="background:${diff>=0?"var(--correct-soft)":"var(--wrong-soft)"};color:${diff>=0?"var(--correct)":"var(--wrong)"}">${diff>=0?"▲":"▼"} ${Math.abs(diff)}%</span>` : "";
        const notInNote = inRanking ? "" : `<p class="muted">Je hebt zelf nog geen 5 gevalideerde antwoorden — je staat nog niet in de rangschikking.</p>`;
        cohortBlock=`<h2>Vergelijk met ${esc(ME.cohort)} ${diffBadge}</h2>
          <div class="kpis">
            ${kpi(`Gemiddelde ${esc(ME.cohort)}`, avg+"%", scores.length+" leden ≥5 gevalideerde antwoorden")}
            ${kpi("Jouw rang", rankStr)}
          </div>${notInNote}`;
      } else {
        cohortBlock=`<h2>Vergelijk met ${esc(ME.cohort)}</h2><p class="muted">Nog te weinig medegebruikers met voldoende gevalideerde antwoorden (minstens 5 per persoon).</p>`;
      }
    }
  }

  app.innerHTML=`
    <h1>Mijn account</h1>
    <div class="muted">${esc(ME.email||"")} · <span class="role ${ME.role}">${ME.role}</span></div>

    <h2>Mijn statistiek</h2>
    <div class="kpis">
      ${kpi("Antwoorden",(myEvents||[]).length)}
      ${kpi("Gevalideerd",myScored)}
      ${kpi("% juist",myPct!=null?myPct+"%":"—")}
    </div>
    ${learningBlock(myEvents||[], "Jouw vooruitgang over tijd")}
    ${cohortBlock}

    <h2>Profiel</h2>
    <div class="card">
      <label>Weergavenaam</label>
      <div>${esc(ME.display_name)} <span class="muted" style="font-size:.78rem">— automatisch de tekst vóór de @ van je e-mailadres</span></div>
      <label style="margin-top:.6rem">Oorsprong</label><input id="accCohort" value="${esc(ME.cohort||"")}">
      <div class="btnrow"><button class="btn btn-primary btn-sm" id="saveProfile">Oorsprong opslaan</button></div>
    </div>

    <h2>Wachtwoord wijzigen</h2>
    <div class="card">
      <label>Nieuw wachtwoord</label><input id="pw1" type="password" autocomplete="new-password">
      <label>Herhaal nieuw wachtwoord</label><input id="pw2" type="password" autocomplete="new-password">
      <div class="btnrow"><button class="btn btn-primary btn-sm" id="savePw">Wachtwoord wijzigen</button></div>
    </div>

    <h2>Historische pogingen (${(myAttempts||[]).length})</h2>
    <p class="muted" style="font-size:.82rem">Officiële examens of oefensessies waarvan je de antwoorden bewaart. De score wordt live berekend tegen de huidige juiste antwoorden van de quiz.</p>
    <div class="stack" style="margin-bottom:1rem">
      ${(myAttempts||[]).length ? myAttempts.map(a=>{
        const cur=currentCorrectByQuiz[a.quiz_id]||{};
        const totQ=totalQsByQuiz[a.quiz_id]||0;
        const live=attemptScoreFrom(a.answers||{}, cur);
        const denom=live.score+live.wrong;
        const pctA=denom>0?Math.round(live.score/denom*100):0;
        return `<div class="card attempt-card">
          <div class="spread" style="gap:.6rem;flex-wrap:wrap">
            <div>
              <div class="attempt-title"><strong>${esc(a.title||("Poging "+new Date(a.submitted_at).toLocaleDateString("nl-BE")))}</strong>
                <span class="pill" style="background:var(--surface2);color:var(--text-muted);font-size:.68rem">${a.source||"manual"}</span></div>
              <div class="muted" style="font-size:.78rem">${esc(quizTitle[a.quiz_id]||"(quiz verwijderd)")} · ${fmtDate(a.submitted_at)}</div>
            </div>
            <div class="attempt-score">
              <div class="attempt-score-val ${pctA>=75?"ok":pctA>=50?"warn":"bad"}">${live.score}/${totQ} <span style="font-size:.7em;opacity:.85">(${pctA}%)</span></div>
              <div class="muted" style="font-size:.72rem">${live.answered}/${totQ} beantwoord</div>
            </div>
            <div class="btnrow" style="margin:0"><button class="btn btn-ghost btn-sm" data-nav="#/quiz/${a.quiz_id}/poging/${a.id}">Details →</button></div>
          </div>
        </div>`;
      }).join("") : `<p class="muted">Nog geen pogingen. Open een quiz en klik op "📜 Historische pogingen" om er eentje toe te voegen.</p>`}
    </div>

    <h2>Mijn reacties (${(flags||[]).length})</h2>
    <div class="stack">
      ${(flags||[]).map(f=>`<div class="card"><div class="spread"><div><span class="pill ${f.type}">${f.type}</span> ${arr(f.preferred_indexes).length?`<span class="muted">· verkiest <strong>${lettersOf(f.preferred_indexes)}</strong></span> `:""}${qlink(f.question_id)} <span class="when">${fmtDate(f.created_at)}</span>${f.toelichting?`<div class="cmt">${formatCommentBody(f.toelichting, f.question_id)}</div>`:""}</div><button class="btn btn-danger btn-sm" data-delflag="${f.id}">Verwijderen</button></div></div>`).join("")||`<p class="muted">Je hebt nog geen reacties geplaatst.</p>`}
    </div>
    ${isEditor()?`
    <h2>Beheerdershandleiding</h2>
    <div class="card">
      <button class="btn btn-primary btn-sm" id="beheerHelpBtn">${ICON.info} Wat kan ik als ${isAdmin()?"admin":"beheerder"} doen?</button>
      <span class="muted" style="font-size:.82rem;margin-left:.5rem">Overzicht van al je bevoegdheden en waar ze zich bevinden.</span>
    </div>`:""}`;
  document.getElementById("saveProfile").onclick=async()=>{
    const cohort=document.getElementById("accCohort").value.trim();
    const { error }=await sb.from("profiles").update({ cohort }).eq("id",ME.id);
    if(error) return toast(error.message,"err");
    ME.cohort=cohort; toast("Opgeslagen","ok");
  };
  document.getElementById("savePw").onclick=async()=>{
    const a=document.getElementById("pw1").value, b=document.getElementById("pw2").value;
    if(a.length<6) return toast("Minstens 6 tekens","err");
    if(a!==b) return toast("Wachtwoorden komen niet overeen","err");
    const { error }=await sb.auth.updateUser({ password:a });
    if(error) return toast(error.message,"err");
    toast("Wachtwoord gewijzigd","ok"); document.getElementById("pw1").value=""; document.getElementById("pw2").value="";
  };
  app.querySelectorAll("[data-q]").forEach(a=>a.onclick=()=>PLAY_goto(a.dataset.quiz, a.dataset.q));
  app.querySelectorAll("[data-delflag]").forEach(b=>b.onclick=async()=>{ if(!confirm("Deze reactie verwijderen?"))return; const {error}=await sb.from("flags").delete().eq("id",b.dataset.delflag); if(error)return toast(error.message,"err"); toast("Verwijderd","ok"); viewAccount(); });
  const bh=document.getElementById("beheerHelpBtn"); if(bh) bh.onclick=openBeheerManual;
}

function openBeheerManual(){
  const admin=isAdmin();
  const overlay=document.createElement("div");
  overlay.className="modes-overlay";
  overlay.innerHTML=`<div class="modes-modal" role="dialog" aria-label="Beheerdershandleiding">
    <div class="modes-hd">
      <div class="modes-title">${ICON.info} Handleiding voor ${admin?"admin":"beheerder"}</div>
      <button class="tetris-close" id="bhClose" aria-label="Sluiten">×</button>
    </div>
    <div class="modes-body">
      <p class="muted">Als <strong>${admin?"admin":"beheerder"}</strong> zie je enkele extra opties in de app. Hieronder vind je waar ze zitten en wat ze doen.</p>

      <h3>Waar vind je je beheerdersfuncties?</h3>
      <ul>
        <li><strong>Beheer</strong> (nav-link) — dashboard met alle quizzen, open flags en (voor admin) rollen &amp; instellingen.</li>
        <li><strong>Bewerk deze vraag</strong> — rechtsboven in het speelscherm bij élke vraag.</li>
        <li><strong>Detail-icoontjes</strong> — bij statistieken en overzichten kan je op elke rij klikken om ernaartoe te springen.</li>
        <li><strong>Gebruikers</strong> (nav-link) — statistiek per gebruiker en per PROM-cohort.</li>
      </ul>

      <h3>Quizzen beheren</h3>
      <ul>
        <li><strong>Nieuwe quiz aanmaken</strong> — knop op het Beheer-dashboard. Je geeft enkel een titel; nadien open je de quiz om vragen toe te voegen.</li>
        <li><strong>Quiz importeren</strong> — via een Markdown-sjabloon (zie <code>quiz-sjabloon.md</code>). Handig om een reeks vragen in één keer aan te maken.</li>
        <li><strong>Titel &amp; beschrijving bewerken</strong> — bovenaan in de quiz-editor.</li>
        <li><strong>Publiceren / naar concept</strong> — knop bij elke quiz. Enkel gepubliceerde quizzen zijn zichtbaar voor spelers.</li>
        <li><strong>Quiz verwijderen</strong> — permanent, inclusief alle vragen, antwoorden en flags. Weet zeker wat je doet.</li>
      </ul>

      <h3>Vragen bewerken</h3>
      <p>In de quiz-editor kan je per vraag alles instellen. Nieuwe vragen worden onderaan toegevoegd.</p>
      <ul>
        <li><strong>Vraagtekst</strong> — de vraag zelf.</li>
        <li><strong>Gevalideerd juist antwoord</strong> (vinkje) — uit = geen officieel antwoord, de groep bepaalt het via flags. Krijgt dan de tag "Niet gevalideerd".</li>
        <li><strong>Meerkeuze</strong> (vinkje) — er kunnen meerdere antwoorden juist zijn. Wordt automatisch aangezet als je meer dan één "J" aankruist.</li>
        <li><strong>Antwoordopties</strong> — per optie twee vinkjes:
          <ul>
            <li><strong>J</strong> = juridisch/officieel juist antwoord.</li>
            <li><strong>D</strong> = het antwoord dat <em>de docent</em> koos. Enkel invullen als het afwijkt van "J".</li>
          </ul>
        </li>
        <li><strong>Toelichting docent</strong> — korte uitleg waarom de docent afwijkt (wordt getoond in het docent-blok bij de vraag).</li>
        <li><strong>Wettelijke basis</strong> — één zin of paragraaf met de bron (art. X, wet Y).</li>
        <li><strong>Wettekst</strong> — de volledige artikeltekst, uitklapbaar getoond onder de uitleg.</li>
        <li><strong>Uitleg</strong> — de context waarom het antwoord juist is.</li>
        <li><strong>Herkomst</strong> — voor juist antwoord, uitleg én wettelijke basis kan je apart mens of AI aanduiden. Verschijnt als klein icoontje bij de vraag.</li>
        <li><strong>Vraag verwijderen</strong> — permanent, en verwijdert ook alle antwoorden, events en flags die aan die vraag hangen.</li>
      </ul>
      <p class="tip">💡 Elke bewerking wordt gelogd in de wijzigingshistoriek van de vraag.</p>

      <h3>Antwoorden worden geschud — hoe verwijs je ernaar?</h3>
      <p>De app schudt per gebruiker en per sessie de volgorde van de antwoordopties. Dat traint spelers op de <em>inhoud</em>, niet op de positie. Gevolg: "A" bij jou kan bij een andere gebruiker "C" zijn.</p>
      <p>In je <strong>uitleg</strong>, <strong>wettelijke basis</strong>, <strong>wettekst</strong> of <strong>docent-toelichting</strong> mag je verwijzen met een van deze placeholders:</p>
      <ul>
        <li><code>{A}</code> <code>{B}</code> <code>{C}</code> … — verwijst naar de <strong>positie in de editor</strong>: <code>{A}</code> = eerste optie in het formulier, <code>{B}</code> = tweede, enz. Klik op de chip naast een optie om die automatisch in te voegen op je cursorpositie. Na de klik toont een toast naar welke optie de verwijzing wijst.</li>
        <li><code>{A,B}</code> <code>{A,C,D}</code> … — verwijs naar <strong>meerdere</strong> opties tegelijk (bv. bij multi-antwoord). Wordt vertaald naar "A, C" bij die specifieke speler. <strong>Shift+klik</strong> op een letter-chip breidt een lopende <code>{A}</code> groep uit tot <code>{A,B}</code>.</li>
        <li><code>{juist}</code> — verwijst <em>altijd</em> naar het juiste antwoord (welke letter dat ook geworden is na shuffle). Voor meerkeuze-vragen worden alle juiste letters samen getoond (bv. "A, C"). Handig als je "antwoord {juist} is correct omdat…" wil schrijven zonder over een specifieke optie na te denken.</li>
        <li><code>{docent}</code> — verwijst naar het antwoord dat de docent aanduidde. Enkel zinvol als de docent afwijkt van het juridische antwoord.</li>
      </ul>
      <p class="tip"><strong>Voorbeeld met {A}:</strong> "Antwoord {A} is juist want art. 34 Sv. bepaalt…". Ziet Anke A in haar shuffle staan, blijft "{A}" → "A". Ziet Bart daar "C", vertaalt "{A}" naar "C".</p>
      <p class="tip"><strong>Voorbeeld met {juist}:</strong> "Antwoord {juist} klopt: de wettelijke basis is art. 34 Sv." — geen risico op verkeerde referentie, want de app vertaalt naar wat écht juist is bij die speler.</p>

      <h3>Flags en reacties (Beheer → tab "Open flags")</h3>
      <ul>
        <li>Reacties (fout, twijfel, docent, commentaar) staan <strong>gegroepeerd per vraag</strong>. Vaak zijn er meerdere reacties over hetzelfde: dat zie je aan het pill met "N reacties".</li>
        <li>Klik op de vraagtitel om de discussie te bekijken en desnoods de vraag aan te passen.</li>
        <li>Handel af per flag met het ✓-icoontje, of gebruik <strong>"Alles afhandelen"</strong> om alle reacties op één vraag ineens te sluiten.</li>
        <li>Je kan zelf reageren op reacties zoals elke speler (met het "Reageer"-knopje bij de vraag).</li>
      </ul>

      <h3>Flags &amp; opmerkingen afhandelen</h3>
      <ul>
        <li>Op het Beheer-dashboard zie je alle <strong>open flags</strong> (fout, twijfel, docent, commentaar) — de reacties waar spelers om input vragen.</li>
        <li>Klik op een flag om naar de vraag te springen, de discussie te lezen en desnoods de vraag aan te passen.</li>
        <li><strong>Markeer als afgehandeld</strong> zodra de zaak opgelost is (je kan de vraag aanpassen én de flag laten open of afsluiten).</li>
        <li>Je kan <strong>reageren op reacties</strong> zoals elke speler (met het "Reageer"-knopje) — jouw commentaar krijgt geen aparte beheerder-badge, alleen de rolpil in de header verklapt het.</li>
      </ul>

      <h3>Wat mag je verwijderen?</h3>
      <ul>
        <li>Als speler kan iedereen zijn <strong>eigen</strong> reacties verwijderen via Mijn account.</li>
        <li>Als beheerder kan je <strong>alle</strong> flags/reacties verwijderen in de vraag-editor.</li>
        <li><strong>Wees voorzichtig</strong>: verwijderen is definitief, en je verwijdert vaak ook context voor andere spelers.</li>
      </ul>

      <h3>Statistiek</h3>
      <ul>
        <li><strong>Statistiek</strong> (algemeen) toont KPI's over alle quizzen — publiek zichtbaar.</li>
        <li><strong>Statistiek per quiz</strong> — moeilijkste vragen, meest geflagd, groeps-curve.</li>
        <li><strong>Gebruikers</strong> (enkel voor beheerder/admin) — per PROM-cohort en per gebruiker: aantal antwoorden, % juist, bezoeken, aantal reacties.</li>
      </ul>

      ${admin?`
      <h3>Enkel voor admin</h3>
      <ul>
        <li><strong>Rollen wijzigen</strong> — op Beheer, per gebruiker een dropdown "speler / beheerder / admin". Je kan je eigen rol niet wijzigen om lock-out te vermijden.</li>
        <li><strong>Registratie open/dicht</strong> — schakelaar op Beheer. Bij dicht: geen nieuwe accounts. Bestaande accounts blijven werken.</li>
        <li>Alle beheerder-rechten zitten ook in de admin-rol.</li>
      </ul>`:""}

      <h3>Waar je op moet letten</h3>
      <ul>
        <li><strong>Publiek zichtbaar</strong>: de statistieken en collectieve reacties zijn voor alle spelers zichtbaar. Discussie in flags dus best neutraal formuleren.</li>
        <li><strong>Gevalideerd &amp; niet-gevalideerd</strong>: pas de vlag pas op "gevalideerd" wanneer je zeker bent van het juiste antwoord — dan begint de app pas het antwoord te scoren.</li>
        <li><strong>Docent-antwoord</strong>: enkel invullen als de docent expliciet iets anders aanduidde dan de wet. Bij overeenstemming laat je "D" leeg.</li>
        <li><strong>Wijzigingen zijn zichtbaar</strong>: elke bewerking komt in de wijzigingshistoriek van de vraag, ook zichtbaar voor spelers.</li>
      </ul>
    </div>
    <div class="modes-foot"><button class="btn btn-primary btn-sm" id="bhOk">Sluit</button></div>
  </div>`;
  document.body.appendChild(overlay);
  const close=()=>{ overlay.remove(); window.removeEventListener("keydown",onKey); };
  const onKey=e=>{ if(e.key==="Escape") close(); };
  overlay.querySelector("#bhClose").onclick=close;
  overlay.querySelector("#bhOk").onclick=close;
  overlay.addEventListener("click",e=>{ if(e.target===overlay) close(); });
  window.addEventListener("keydown",onKey);
}

/* ============================================================
   MELDINGEN — nieuwe reacties bij vragen waar jij op reageerde
   ============================================================ */
async function viewMeldingen(){
  app.innerHTML=`<div class="loading">Meldingen laden…</div>`;
  const since = getLastNotifySeen();
  const items = await fetchNewNotifications();
  // Ook oudere activiteit tonen ter context — laatste 30 dagen aan reacties op mijn vragen
  const { data:myFlags } = await sb.from("flags").select("question_id").eq("user_id",ME.id).range(0,4999);
  const qids = [...new Set((myFlags||[]).map(f=>f.question_id))];
  let recent = [];
  if(qids.length){
    const cutoff = new Date(Date.now() - 30*24*3600*1000).toISOString();
    const { data } = await sb.from("flags").select("id,question_id,user_id,type,toelichting,created_at,parent_id")
      .in("question_id", qids).gt("created_at", cutoff).neq("user_id", ME.id)
      .order("created_at",{ascending:false}).range(0,199);
    recent = data || [];
  }
  const allIds = [...new Set([...items, ...recent].map(f=>f.question_id))];
  let qmap={};
  if(allIds.length){
    const { data:qq } = await sb.from("questions").select("id,qnum,quiz_id,text").in("id", allIds);
    (qq||[]).forEach(q=>qmap[q.id]=q);
  }
  const quizIds = [...new Set(Object.values(qmap).map(q=>q.quiz_id))];
  let quizMap={};
  if(quizIds.length){
    const { data:qq } = await sb.from("quizzes").select("id,title").in("id", quizIds);
    (qq||[]).forEach(q=>quizMap[q.id]=q);
  }
  const names = await namesFor(recent.map(f=>f.user_id));

  const renderList = (list, isNew) => {
    if(!list.length) return `<p class="muted">${isNew?"Geen nieuwe meldingen — je bent up-to-date. 🎉":"Nog geen activiteit."}</p>`;
    // Groepeer per vraag
    const byQ={}; list.forEach(f=>{ (byQ[f.question_id]=byQ[f.question_id]||[]).push(f); });
    const groups=Object.entries(byQ).map(([qid,fs])=>({ qid, q:qmap[qid], flags:fs, latest:fs[0]?.created_at }))
      .sort((a,b)=>(b.latest||"")<(a.latest||"")?-1:1);
    return groups.map(g=>{
      const q=g.q; const quiz=q?quizMap[q.quiz_id]:null;
      const qtext = q ? (q.text||"").slice(0,110)+((q.text||"").length>110?"…":"") : "(vraag verwijderd)";
      const flagList=g.flags.map(f=>{
        const snippet = f.toelichting ? formatCommentBody(f.toelichting.length>140 ? f.toelichting.slice(0,140)+"…" : f.toelichting, f.question_id, qmap[f.question_id]) : "";
        return `<div class="notify-flag ${f.type}">
          <div class="notify-flag-head">
            <span class="fg-type">${f.type}</span>
            <span class="fg-who">${esc(names[f.user_id]||"?")}</span>
            <span class="fg-when">${fmtDate(f.created_at)} <span class="muted">(${humanAgo(new Date(f.created_at).getTime())})</span></span>
          </div>
          ${snippet?`<div class="fg-body cmt">${snippet}</div>`:""}
        </div>`;
      }).join("");
      return `<div class="fg-card ${isNew?'notify-new':''}">
        <div class="fg-card-hd">
          <div class="fg-card-hd-left">
            ${q?`<a class="ilink fg-qlink" data-q="${q.id}" data-quiz="${q.quiz_id}"><span class="q-num">${q.qnum}</span> <span class="fg-qtext">${esc(qtext)}</span></a>`:`<span>${esc(qtext)}</span>`}
            ${quiz?`<div class="fg-quiz-title">${esc(quiz.title)}</div>`:""}
          </div>
          <div class="fg-card-hd-right">
            <span class="fg-count-pill">${g.flags.length} nieuw${g.flags.length===1?"":"e"}</span>
          </div>
        </div>
        <div class="fg-flags">${flagList}</div>
      </div>`;
    }).join("");
  };

  app.innerHTML=`
    <h1>Meldingen</h1>
    <p class="muted" style="font-size:.85rem">Elke reactie van een andere speler op een vraag waar jij <em>ook al</em> een flag of opmerking op hebt geplaatst.</p>
    <div class="btnrow" style="margin-top:.8rem">
      <button class="btn btn-ghost btn-sm" id="markSeenBtn" ${items.length?"":"disabled"}>${ICON.check} Markeer alles als gelezen</button>
    </div>
    <h2>Nieuw${items.length?` (${items.length})`:""}</h2>
    <div class="flag-groups">${renderList(items, true)}</div>
    ${recent.length ? `
      <h2>Recent (laatste 30 dagen)</h2>
      <div class="flag-groups">${renderList(recent.filter(r=>!items.find(i=>i.id===r.id)), false)}</div>
    ` : ""}
  `;
  app.querySelectorAll("[data-q]").forEach(a=>a.onclick=()=>PLAY_goto(a.dataset.quiz, a.dataset.q));
  document.getElementById("markSeenBtn").onclick=()=>{
    markNotifySeen(); NOTIFY_COUNT=0;
    const b=document.getElementById("notifyBadge"); if(b){ b.hidden=true; b.textContent="0"; }
    toast("Alle meldingen gemarkeerd als gelezen","ok"); viewMeldingen();
  };
}

/* ============================================================
   BEHEER-dashboard
   ============================================================ */
async function viewBeheer(tab){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  tab = tab || "quizzen";
  // Fetch alle relevante data
  const [{data:quizzes},{data:openFlags}] = await Promise.all([
    sb.from("quizzes").select("*").order("created_at"),
    sb.from("flags").select("id,question_id,type,toelichting,created_at,user_id,parent_id,status").eq("status","open").neq("type","juist").order("created_at",{ascending:true}).range(0,4999),
  ]);
  const flagCount=(openFlags||[]).length;
  const impactedQuestionCount = new Set((openFlags||[]).map(f=>f.question_id)).size;
  // Vragen ophalen voor de flags (voor labeling en groepering)
  let qmap={};
  if(flagCount){ const {data:qq}=await sb.from("questions").select("id,qnum,quiz_id,text").in("id",[...new Set((openFlags||[]).map(f=>f.question_id))]); (qq||[]).forEach(q=>qmap[q.id]=q); }
  const quizById={}; (quizzes||[]).forEach(q=>quizById[q.id]=q);
  const names=await namesFor((openFlags||[]).map(f=>f.user_id));

  const tabs=[
    { key:"quizzen", label:"Quizzen", count:(quizzes||[]).length, always:true },
    { key:"flags",   label:"Vragen met open flags", count:impactedQuestionCount, always:true, title:`${impactedQuestionCount} vraag/vragen met in totaal ${flagCount} open reactie(s)` },
    { key:"gebruikers", label:"Gebruikers", count:USER_COUNT!=null?USER_COUNT:null, admin:true },
    { key:"instellingen", label:"Instellingen", count:null, admin:true },
  ].filter(t=>t.always || (t.admin && isAdmin()));

  app.innerHTML=`
    <div class="spread"><h1>Beheer</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" id="newQuiz">+ Nieuwe quiz</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/beheer/import">Quiz importeren</button>
      </div></div>
    <div class="beheer-tabs">${tabs.map(t=>`<a class="beheer-tab ${t.key===tab?"active":""}" data-nav="#/beheer${t.key==="quizzen"?"":"/"+t.key}"${t.title?` title="${esc(t.title)}"`:""}>${t.label}${t.count!=null?` <span class="beheer-tab-count">${t.count}</span>`:""}</a>`).join("")}</div>
    <div id="beheerContent"></div>
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("newQuiz").onclick=createQuiz;

  const content=document.getElementById("beheerContent");
  if(tab==="quizzen"){
    content.innerHTML=`
      <div class="stack" style="margin-top:1rem">${(quizzes||[]).map(q=>`
        <div class="card quiz-row"><div class="spread quiz-row-spread">
          <div class="quiz-row-info">
            <strong>${esc(q.title)}</strong> <span class="badge ${q.status==="gepubliceerd"?"pub":"concept"}">${q.status}</span>
            <div class="muted quiz-row-desc">${esc(q.description||"")}</div>
          </div>
          <div class="btnrow quiz-row-btns">
            <button class="btn btn-ghost btn-sm" data-edit="${q.id}">Bewerken</button>
            <button class="btn btn-ghost btn-sm" data-pub="${q.id}" data-status="${q.status}">${q.status==="gepubliceerd"?"Terug naar concept":"Publiceren"}</button>
            <button class="btn btn-danger btn-sm" data-del="${q.id}">Verwijderen</button>
          </div></div></div>`).join("")||`<p class="muted">Nog geen quizzen.</p>`}
      </div>`;
    content.querySelectorAll("[data-edit]").forEach(b=>b.onclick=()=>go("#/beheer/quiz/"+b.dataset.edit));
    content.querySelectorAll("[data-pub]").forEach(b=>b.onclick=async()=>{
      const ns=b.dataset.status==="gepubliceerd"?"concept":"gepubliceerd";
      await sb.from("quizzes").update({status:ns}).eq("id",b.dataset.pub); toast("Status bijgewerkt","ok"); viewBeheer(tab);
    });
    content.querySelectorAll("[data-del]").forEach(b=>b.onclick=async()=>{
      const q=quizById[b.dataset.del];
      if(!confirm(`Quiz "${q?q.title:""}" definitief verwijderen? Dit verwijdert ook ALLE vragen, antwoorden, events, flags en tetris-scores die aan deze quiz gekoppeld zijn. Deze actie is onomkeerbaar.`)) return;
      await sb.from("quizzes").delete().eq("id",b.dataset.del); toast("Verwijderd","ok"); viewBeheer(tab);
    });
  }
  else if(tab==="flags"){
    content.innerHTML=`
      <p class="muted" style="font-size:.85rem;margin-top:.8rem"><strong>${impactedQuestionCount}</strong> vraag/vragen met open reactie(s) — in totaal <strong>${flagCount}</strong> nog te bekijken. Reacties zijn per vraag gegroepeerd; klik op de vraagtitel om naar de vraag te gaan.</p>
      ${flagCount ? renderBeheerFlagGroups(openFlags||[], qmap, quizById, names) : `<div class="empty">Geen open flags — alles is afgehandeld! 🎉</div>`}
    `;
    content.querySelectorAll("[data-q]").forEach(a=>a.onclick=()=>PLAY_goto(a.dataset.quiz, a.dataset.q));
    content.querySelectorAll("[data-resolve]").forEach(b=>b.onclick=async()=>{
      if(!confirm("Deze flag als afgehandeld markeren?")) return;
      await sb.from("flags").update({status:"afgehandeld"}).eq("id",b.dataset.resolve); toast("Afgehandeld","ok"); viewBeheer(tab);
    });
    content.querySelectorAll("[data-resolve-all]").forEach(b=>b.onclick=async()=>{
      const ids=b.dataset.resolveAll.split(",").filter(Boolean);
      if(!ids.length) return;
      if(!confirm(`Alle ${ids.length} openstaande flag(s) voor deze vraag afhandelen?`)) return;
      await sb.from("flags").update({status:"afgehandeld"}).in("id",ids); toast(`${ids.length} flag(s) afgehandeld`,"ok"); viewBeheer(tab);
    });
  }
  else if(tab==="gebruikers"){
    if(!isAdmin()){ content.innerHTML=`<div class="empty">Enkel voor admin.</div>`; return; }
    content.innerHTML=`<div id="usersBox" class="card" style="margin-top:1rem">Laden…</div>`;
    renderUsers();
  }
  else if(tab==="instellingen"){
    if(!isAdmin()){ content.innerHTML=`<div class="empty">Enkel voor admin.</div>`; return; }
    content.innerHTML=`<div id="settingsBox" class="card" style="margin-top:1rem">Laden…</div>`;
    renderSettings();
  }
}

// Groep flags per vraag, met threading (parent→children) binnen elke groep
function renderBeheerFlagGroups(flags, qmap, quizById, names){
  // Groepeer per question_id
  const byQ={};
  flags.forEach(f=>{ (byQ[f.question_id]=byQ[f.question_id]||[]).push(f); });
  // Sorteer vragen op quiz-titel + qnum
  const groups=Object.entries(byQ).map(([qid, fs])=>{
    const q=qmap[qid]; const quiz=q?quizById[q.quiz_id]:null;
    return { qid, q, quiz, flags:fs };
  }).sort((a,b)=>{
    const A=a.quiz?a.quiz.title:""; const B=b.quiz?b.quiz.title:"";
    if(A!==B) return A<B?-1:1;
    return (a.q?a.q.qnum:0) - (b.q?b.q.qnum:0);
  });
  const typeIcon = t => t==="fout"?"⚠️" : t==="twijfel"?"❔" : t==="docent"?"👨‍🏫" : t==="commentaar"?"💬" : "";
  return `<div class="flag-groups">${groups.map(g=>{
    // Bouw thread: roots (parent_id null of niet in flags) + children
    const idsInGroup=new Set(g.flags.map(f=>f.id));
    const roots=g.flags.filter(f=>!f.parent_id || !idsInGroup.has(f.parent_id));
    const byParent={}; g.flags.forEach(f=>{ if(f.parent_id){ (byParent[f.parent_id]=byParent[f.parent_id]||[]).push(f); } });
    const renderFlag = (f, depth) => {
      const kids = byParent[f.id]||[];
      const bodyPreview = f.toelichting ? formatCommentBody(f.toelichting.length>140 ? f.toelichting.slice(0,140)+"…" : f.toelichting, g.q?g.q.id:null, g.q) : "";
      return `<div class="fg-flag ${f.type}" style="margin-left:${Math.min(depth,3)*1.1}rem">
        <div class="fg-flag-head">
          ${depth>0?`<span class="fg-reply-arrow" title="Antwoord op reactie hierboven">↳</span>`:""}
          <span class="fg-type">${typeIcon(f.type)} ${f.type}</span>
          <span class="fg-who">${esc(names[f.user_id]||"?")}</span>
          <span class="fg-when">${fmtDate(f.created_at)}</span>
          <button class="btn btn-ghost btn-sm fg-resolve-btn" data-resolve="${f.id}" title="Deze reactie afhandelen">${ICON.check}</button>
        </div>
        ${bodyPreview?`<div class="fg-body">${bodyPreview}</div>`:""}
        ${kids.map(k=>renderFlag(k, depth+1)).join("")}
      </div>`;
    };
    const flagsHtml = roots.map(r=>renderFlag(r,0)).join("");
    const allIds = g.flags.map(f=>f.id).join(",");
    const textPreview = g.q ? (g.q.text||"").slice(0,110) + ((g.q.text||"").length>110?"…":"") : "(vraag onbekend)";
    return `<div class="fg-card">
      <div class="fg-card-hd">
        <div class="fg-card-hd-left">
          ${g.q ? `<a class="ilink fg-qlink" data-q="${g.q.id}" data-quiz="${g.q.quiz_id}"><span class="q-num">${g.q.qnum}</span> <span class="fg-qtext">${esc(textPreview)}</span></a>` : `<span>${esc(textPreview)}</span>`}
          <div class="fg-quiz-title">${g.quiz ? esc(g.quiz.title) : ""}</div>
        </div>
        <div class="fg-card-hd-right">
          <span class="fg-count-pill" title="Aantal reacties op deze vraag">${g.flags.length} reactie${g.flags.length===1?"":"s"}</span>
          ${g.flags.length>1?`<button class="btn btn-ghost btn-sm" data-resolve-all="${allIds}" title="Alle reacties op deze vraag afhandelen">Alles afhandelen</button>`:""}
        </div>
      </div>
      <div class="fg-flags">${flagsHtml}</div>
    </div>`;
  }).join("")}</div>`;
}

// Zelfde groepering als beheer, maar zonder resolve-knoppen en met de quiz-context al bekend
function renderSetupFlagGroups(flags, allQuestions, quiz, flagNames){
  const qById={}; (allQuestions||[]).forEach(q=>qById[q.id]=q);
  const byQ={};
  flags.forEach(f=>{ (byQ[f.question_id]=byQ[f.question_id]||[]).push(f); });
  const groups=Object.entries(byQ).map(([qid, fs])=>({ qid, q:qById[qid], flags:fs }))
    .sort((a,b)=>(a.q?a.q.qnum:0) - (b.q?b.q.qnum:0));
  const typeIcon = t => t==="fout"?"⚠️" : t==="twijfel"?"❔" : t==="docent"?"👨‍🏫" : t==="commentaar"?"💬" : "";
  return `<div class="flag-groups">${groups.map(g=>{
    const idsInGroup=new Set(g.flags.map(f=>f.id));
    const roots=g.flags.filter(f=>!f.parent_id || !idsInGroup.has(f.parent_id));
    const byParent={}; g.flags.forEach(f=>{ if(f.parent_id){ (byParent[f.parent_id]=byParent[f.parent_id]||[]).push(f); } });
    const renderFlag=(f, depth)=>{
      const kids = byParent[f.id]||[];
      const bodyPreview = f.toelichting ? formatCommentBody(f.toelichting.length>140 ? f.toelichting.slice(0,140)+"…" : f.toelichting, g.q?g.q.id:null, g.q) : "";
      return `<div class="fg-flag ${f.type}" style="margin-left:${Math.min(depth,3)*1.1}rem">
        <div class="fg-flag-head">
          ${depth>0?`<span class="fg-reply-arrow" title="Antwoord op reactie hierboven">↳</span>`:""}
          <span class="fg-type">${typeIcon(f.type)} ${f.type}</span>
          <span class="fg-who">${esc(flagNames[f.user_id]||"?")}</span>
          <span class="fg-when">${fmtDate(f.created_at)}</span>
        </div>
        ${bodyPreview?`<div class="fg-body">${bodyPreview}</div>`:""}
        ${kids.map(k=>renderFlag(k, depth+1)).join("")}
      </div>`;
    };
    const flagsHtml = roots.map(r=>renderFlag(r,0)).join("");
    const textPreview = g.q ? (g.q.text||"").slice(0,110) + ((g.q.text||"").length>110?"…":"") : "(vraag onbekend)";
    // Snippet van de eerste opmerkier + het begin van hun reactie, zichtbaar op de gesloten summary
    const firstFlag=g.flags[0];
    const firstName=firstFlag?esc(flagNames[firstFlag.user_id]||"?"):"";
    const firstSnippet=firstFlag && firstFlag.toelichting ? esc(firstFlag.toelichting.slice(0,80))+(firstFlag.toelichting.length>80?"…":"") : "";
    const summaryPreview = firstName ? `<div class="fg-summary-preview"><strong>${firstName}</strong>${firstSnippet?`: ${firstSnippet}`:""}${g.flags.length>1?` <span class="muted">· en ${g.flags.length-1} andere</span>`:""}</div>` : "";
    return `<details class="fg-card">
      <summary>
        <div class="fg-card-hd">
          <div class="fg-card-hd-left">
            <span class="fg-qlink">${g.q?`<span class="q-num">${g.q.qnum}</span> `:""}<span class="fg-qtext">${esc(textPreview)}</span></span>
            ${summaryPreview}
          </div>
          <div class="fg-card-hd-right">
            <span class="fg-count-pill">${g.flags.length} reactie${g.flags.length===1?"":"s"}</span>
            ${g.q?`<button class="btn btn-ghost btn-sm" type="button" data-q="${g.q.id}" data-quiz="${quiz.id}" onclick="event.stopPropagation()">Onderzoeken →</button>`:""}
          </div>
        </div>
      </summary>
      <div class="fg-flags">${flagsHtml}</div>
    </details>`;
  }).join("")}</div>`;
}

async function createQuiz(){
  const title=prompt("Titel van de nieuwe quiz:"); if(!title) return;
  const { data, error }=await sb.from("quizzes").insert({ title, description:"", status:"concept", created_by:ME.id }).select().single();
  if(error) return toast(error.message,"err");
  go("#/beheer/quiz/"+data.id);
}

async function renderUsers(){
  const box=document.getElementById("usersBox");
  const { data:profiles } = await sb.from("profiles").select("*").order("created_at");
  box.innerHTML=`<table><thead><tr><th>Naam</th><th>E-mail-id</th><th>Rol</th></tr></thead><tbody>${
    (profiles||[]).map(p=>`<tr><td>${esc(p.display_name)}</td><td class="muted" style="font-size:.72rem">${p.id.slice(0,8)}…</td>
      <td><select data-role="${p.id}" ${p.id===ME.id?"disabled title='Je eigen rol'":""}>
        ${["speler","beheerder","admin"].map(r=>`<option value="${r}" ${p.role===r?"selected":""}>${r}</option>`).join("")}
      </select></td></tr>`).join("")}</tbody></table>`;
  box.querySelectorAll("[data-role]").forEach(s=>s.onchange=async()=>{
    const { error }=await sb.from("profiles").update({role:s.value}).eq("id",s.dataset.role);
    if(error) return toast(error.message,"err");
    toast("Rol bijgewerkt","ok");
  });
}

async function renderSettings(){
  const box=document.getElementById("settingsBox");
  const { data } = await sb.from("app_settings").select("*").eq("id",1).single();
  await loadGamesConfig();
  const cfg=GAMES_CFG||{};
  const resetLabel={off:"Uit (geen reset)", weekly:"Wekelijks (elke maandag)", monthly:"Maandelijks (1e van de maand)"};
  const diffLabel={easy:"Makkelijk", normal:"Normaal", hard:"Moeilijk"};
  box.innerHTML=`<label style="display:flex;align-items:center;gap:.6rem;margin:0">
    <input type="checkbox" id="regOpen" style="width:auto" ${data&&data.registration_open?"checked":""}> Registratie open (nieuwe accounts toegestaan)</label>
    <hr style="margin:1rem 0;border:none;border-top:1px solid var(--border)">
    <div style="font-weight:700;color:var(--ink);margin-bottom:.3rem">🎮 Games</div>
    <p class="muted" style="font-size:.82rem;margin:0 0 .5rem 0">Per game: vrij te spelen (anders "beloningsgame"), scorereset (wekelijks/maandelijks filteren op scorebord — oude scores blijven wél in de DB) en moeilijkheidsgraad.</p>
    <div id="gamesCfgList" class="stack" style="gap:.7rem">
      ${GAMES.map(g=>`<div class="games-cfg-row ${cfg[g.id]&&cfg[g.id].enabled?"":"is-inactive"}">
        <div class="games-cfg-title">${g.icon} <strong>${esc(g.name)}</strong>${cfg[g.id]&&cfg[g.id].enabled?"":' <span class="games-cfg-badge">inactief</span>'}</div>
        <label class="games-cfg-line">
          <input type="checkbox" data-gameenabled="${g.id}" style="width:auto" ${cfg[g.id]&&cfg[g.id].enabled?"checked":""}> Actief (zichtbaar op home &amp; scorebord)
        </label>
        <label class="games-cfg-line">
          <input type="checkbox" data-gamefree="${g.id}" style="width:auto" ${cfg[g.id]&&cfg[g.id].free?"checked":""}> Vrij te spelen
        </label>
        <label class="games-cfg-line">Scorereset:
          <select data-gamereset="${g.id}">
            ${RESET_MODES.map(m=>`<option value="${m}" ${cfg[g.id]&&cfg[g.id].reset===m?"selected":""}>${resetLabel[m]}</option>`).join("")}
          </select>
        </label>
        <label class="games-cfg-line">Moeilijkheid:
          <select data-gamediff="${g.id}">
            ${DIFFICULTIES.map(d=>`<option value="${d}" ${cfg[g.id]&&cfg[g.id].difficulty===d?"selected":""}>${diffLabel[d]}</option>`).join("")}
          </select>
        </label>
        <div class="games-cfg-line games-cfg-gate">
          <span>Quiz-voorwaarde:</span>
          <label>min. vragen <input type="number" min="0" max="500" step="1" data-gategnq="${g.id}" value="${(cfg[g.id]&&cfg[g.id].gate&&cfg[g.id].gate.minQuestions)||0}" style="width:5.5rem"></label>
          <label>min. % juist <input type="number" min="0" max="100" step="1" data-gategpct="${g.id}" value="${(cfg[g.id]&&cfg[g.id].gate&&cfg[g.id].gate.minPercent)||0}" style="width:5rem"></label>
          <span class="muted" style="font-size:.72rem">(0 = geen voorwaarde)</span>
        </div>
      </div>`).join("")}
    </div>
    <div id="gamesCfgStatus" class="muted" style="font-size:.78rem;margin-top:.4rem"></div>`;
  document.getElementById("regOpen").onchange=async e=>{
    const { error }=await sb.from("app_settings").update({registration_open:e.target.checked}).eq("id",1);
    if(error) return toast(error.message,"err");
    toast("Instelling opgeslagen","ok");
  };
  const statusEl=document.getElementById("gamesCfgStatus");
  const collectCfg=()=>{
    const c={};
    GAMES.forEach(g=>{ c[g.id]={
      enabled: document.querySelector(`[data-gameenabled="${g.id}"]`).checked,
      free: document.querySelector(`[data-gamefree="${g.id}"]`).checked,
      reset: document.querySelector(`[data-gamereset="${g.id}"]`).value,
      difficulty: document.querySelector(`[data-gamediff="${g.id}"]`).value,
      gate: {
        minQuestions: parseInt(document.querySelector(`[data-gategnq="${g.id}"]`).value,10)||0,
        minPercent:   parseInt(document.querySelector(`[data-gategpct="${g.id}"]`).value,10)||0,
      },
    }; });
    return c;
  };
  const persist=async()=>{
    try{ await saveGamesConfig(collectCfg()); toast("Games-instellingen opgeslagen","ok"); statusEl.textContent=""; }
    catch(err){
      statusEl.innerHTML=`Opslaan mislukt. Voeg eerst deze kolom toe: <code>ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS games_config jsonb DEFAULT '{}'::jsonb;</code>`;
      toast("Opslaan mislukt — zie melding onder de games-instellingen.","err");
    }
  };
  document.querySelectorAll('[data-gameenabled],[data-gamefree],[data-gamereset],[data-gamediff],[data-gategnq],[data-gategpct]').forEach(el=>el.onchange=persist);
}

/* ============================================================
   BEHEER — quiz bewerken (vragen CRUD, herkomst-toggles)
   ============================================================ */
async function viewBeheerQuiz(quizId){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  // Zichtbaarheid van docent-antwoorden — maak ze bereikbaar voor de editor
  (questions||[]).forEach(q=>{ q._show_docent = !!quiz.show_docent; });
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <div class="card" style="margin-top:.6rem">
      <label>Titel</label><input id="qzTitle" value="${esc(quiz.title)}">
      <label>Beschrijving</label><textarea id="qzDesc">${esc(quiz.description||"")}</textarea>
      <label style="display:flex;align-items:center;gap:.5rem;font-weight:400;margin-top:.5rem">
        <input type="checkbox" id="qzShowDocent" style="width:auto" ${quiz.show_docent?"checked":""}>
        👨‍🏫 Docent-antwoorden inschakelen voor deze quiz
        ${infoTip("Alleen aanzetten als de docent regelmatig andere antwoorden geeft dan het wettelijk juiste. Bij aan: extra D-kolom in de editor, docent-toelichting-veld, 'Docent koos…'-reactie-chip en docent-blok na het antwoord in de speler. Bij uit: alles wat met docent te maken heeft blijft verborgen voor spelers en beheerders.")}
      </label>
      <div class="btnrow"><button class="btn btn-primary btn-sm" id="saveQuiz">Quiz opslaan</button>
        <a class="btn btn-ghost btn-sm" data-nav="#/beheer/quiz/${quizId}/audit">👀 Alles-in-één overzicht</a>
        <span class="badge ${quiz.status==="gepubliceerd"?"pub":"concept"}">${quiz.status}</span></div>
    </div>
    <div class="spread"><h2>Vragen (${(questions||[]).length})</h2>
      <button class="btn btn-ghost btn-sm" id="addQ">+ Vraag toevoegen</button></div>
    <input id="qSearch" placeholder="Zoek een vraag — op nummer of tekst…" style="margin-bottom:.6rem">
    <div class="muted" id="qSearchInfo" style="margin-bottom:.6rem;display:none"></div>
    <div class="stack" id="qList"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("saveQuiz").onclick=async()=>{
    await sb.from("quizzes").update({
      title:document.getElementById("qzTitle").value,
      description:document.getElementById("qzDesc").value,
      show_docent:document.getElementById("qzShowDocent").checked,
    }).eq("id",quizId);
    toast("Opgeslagen","ok"); viewBeheerQuiz(quizId);
  };
  document.getElementById("addQ").onclick=async()=>{
    const { data, error }=await sb.from("questions").insert({ quiz_id:quizId, text:"Nieuwe vraag", options:["Optie A","Optie B"], correct_indexes:[0] }).select().single();
    if(error) return toast(error.message,"err");
    viewBeheerQuiz(quizId);
  };
  const list=document.getElementById("qList");
  list.innerHTML=(questions||[]).map(q=>questionEditor(q)).join("")||`<p class="muted">Nog geen vragen.</p>`;
  (questions||[]).forEach(q=>wireQuestionEditor(q, quizId));
  if(EDIT_FOCUS && EDIT_FOCUS.quiz===quizId){
    const card=document.querySelector(`[data-qcard="${EDIT_FOCUS.id}"]`);
    if(card){ card.scrollIntoView({behavior:"smooth",block:"center"}); card.classList.add("flash"); setTimeout(()=>card.classList.remove("flash"),2500); }
    EDIT_FOCUS=null;
  }
  document.getElementById("qSearch").oninput=e=>{
    const s=e.target.value.trim().toLowerCase();
    let n=0;
    (questions||[]).forEach(q=>{
      const card=document.querySelector(`[data-qcard="${q.id}"]`); if(!card) return;
      const hit = !s || String(q.qnum)===s || String(q.qnum).includes(s) || (q.text||"").toLowerCase().includes(s);
      card.style.display = hit?"":"none"; if(hit)n++;
    });
    const info=document.getElementById("qSearchInfo");
    info.style.display = s?"":"none"; info.textContent = s?`${n} vraag/vragen gevonden`:"";
  };
}

/* ============================================================
   ALLES-IN-ÉÉN OVERZICHT — beheerder ziet volledige vraag +
   volledige antwoorden per rij, kan filteren en direct springen
   naar de bewerk-pagina van een vraag.
   ============================================================ */
async function viewBeheerAudit(quizId){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  const ids=(questions||[]).map(q=>q.id);
  let flags=[];
  if(ids.length){ const {data}=await sb.from("flags").select("id,question_id,type,status,toelichting,user_id,created_at").in("question_id",ids); flags=data||[]; }
  const fBy={}; flags.forEach(f=>{ (fBy[f.question_id]=fBy[f.question_id]||[]).push(f); });
  (questions||[]).forEach(q=>{ q._show_docent = !!(quiz && quiz.show_docent); });

  let filter="alle";
  const matches = q => {
    const fs=fBy[q.id]||[]; const open=fs.filter(f=>f.status==="open");
    switch(filter){
      case "gevalideerd":     return q.validated!==false;
      case "nietgevalideerd": return q.validated===false;
      case "openflags":       return open.length>0;
      case "geenflags":       return fs.length===0;
      case "docentwijkt":     return q._show_docent && arr(q.docent_indexes).length && !setEq(q.docent_indexes, arr(q.correct_indexes));
      case "meerkeuze":       return q.question_type==="mcq" && (q.multi || arr(q.correct_indexes).length>1);
      case "mcq":             return (q.question_type||"mcq")==="mcq";
      case "matrix":          return q.question_type==="matrix";
      case "open":            return q.question_type==="open";
      case "afbeelding":      return !!q.image_url;
      case "geenafbeelding":  return !q.image_url;
      case "geenuitleg":      return !q.explanation || !q.explanation.trim();
      default: return true;
    }
  };
  const renderAnswerBlock = q => {
    const t=q.question_type||"mcq";
    if(t==="open"){
      return `<div class="au-answers"><div class="au-lbl">Modelantwoord</div>
        <div class="au-open">${q.open_answer?esc(q.open_answer):`<span class="muted">— geen modelantwoord —</span>`}</div></div>`;
    }
    if(t==="matrix"){
      const rows=arr(q.matrix_rows), cols=arr(q.matrix_cols), correct=arr(q.matrix_correct);
      if(!rows.length||!cols.length) return `<div class="au-answers"><span class="muted">Matrix leeg</span></div>`;
      const head=`<tr><th></th>${cols.map(c=>`<th>${esc(c)}</th>`).join("")}</tr>`;
      const body=rows.map((r,ri)=>{
        const cells=cols.map((_,ci)=>{
          const isC=correct[ri]===ci;
          return `<td class="${isC?"is-correct":""}">${isC?"✓":""}</td>`;
        }).join("");
        return `<tr><th>${esc(r)}</th>${cells}</tr>`;
      }).join("");
      return `<div class="au-answers"><div class="au-lbl">Matrix (juiste kolom per rij is aangeduid)</div>
        <div class="au-matrix"><table>${head}${body}</table></div></div>`;
    }
    // mcq
    const correct=arr(q.correct_indexes);
    const docent=arr(q.docent_indexes);
    const docentDiffers = q._show_docent && docent.length && !setEq(docent, correct);
    const items=(q.options||[]).map((o,i)=>{
      const isC=correct.includes(i);
      const isD=q._show_docent && docent.includes(i);
      const cls = "au-opt"+(isC?" is-correct":"")+(isD&&!isC?" is-docent":"");
      const badges = [];
      if(isC) badges.push(`<span class="pill juist" style="font-size:.68rem">juist</span>`);
      if(docentDiffers && isD) badges.push(`<span class="pill" style="font-size:.68rem;background:rgba(192,38,211,.12);color:#a21caf">docent</span>`);
      return `<div class="${cls}"><span class="au-let">${letter(i)}</span><div class="au-otext">${esc(o)}${badges.length?` ${badges.join(" ")}`:""}</div></div>`;
    }).join("");
    return `<div class="au-answers"><div class="au-lbl">Antwoorden ${q.multi||correct.length>1?"<span class=\"muted\">(meerkeuze)</span>":""}</div>${items||`<span class="muted">— geen opties —</span>`}</div>`;
  };
  const renderCard = q => {
    const fs=fBy[q.id]||[];
    const open=fs.filter(f=>f.status==="open").length;
    const tagRow = questionTags(q) + (q.image_url?` <span class="tag">🖼️ afbeelding</span>`:"") + (fs.length?` <span class="tag tag-warn">${ICON.flag} ${fs.length}${open?` · ${open} open`:""}</span>`:"");
    const openFlags = fs.filter(f=>f.status==="open" && f.toelichting).slice(0,3);
    const flagPreview = openFlags.length ? `<details class="au-flags"><summary>${open} open reactie(s) — bekijk</summary>${openFlags.map(f=>`<div class="au-flag"><span class="pill ${esc(f.type)}" style="font-size:.68rem">${esc(f.type)}</span> <span class="cmt">${formatCommentBody(f.toelichting, q.id, q)}</span></div>`).join("")}</details>` : "";
    return `<div class="au-card" data-qid="${q.id}">
      <div class="au-hd">
        <div class="au-hd-left">
          <span class="q-num">Vraag ${q.qnum}</span>
          ${tagRow}
        </div>
        <div class="au-hd-right">
          <a class="btn btn-ghost btn-sm" data-nav="#/beheer/vraag/${q.id}">🛠️ Bewerken</a>
          <a class="btn btn-ghost btn-sm" data-jump="${q.id}">▶ Spelen</a>
        </div>
      </div>
      <div class="au-text">${esc(q.text)}</div>
      ${q.image_url?`<div class="au-image"><img src="${esc(q.image_url)}" alt="Afbeelding bij vraag ${q.qnum}" loading="lazy"></div>`:""}
      ${renderAnswerBlock(q)}
      ${q.explanation?`<details class="au-details"><summary>Uitleg</summary><div class="au-detail-body">${html(q.explanation)}</div></details>`:""}
      ${q.legal_basis?`<details class="au-details"><summary>Wettelijke basis</summary><div class="au-detail-body">${html(q.legal_basis)}</div></details>`:""}
      ${q.wettekst?`<details class="au-details"><summary>Wettekst</summary><div class="au-detail-body">${html(q.wettekst)}</div></details>`:""}
      ${q._show_docent && q.docent_note?`<details class="au-details" open><summary>👨‍🏫 Toelichting docent</summary><div class="au-detail-body">${esc(q.docent_note)}</div></details>`:""}
      ${flagPreview}
    </div>`;
  };
  const draw = ()=>{
    const list = (questions||[]).filter(matches);
    document.getElementById("auList").innerHTML = list.length
      ? list.map(renderCard).join("")
      : `<div class="empty">Geen vragen voor dit filter.</div>`;
    document.querySelectorAll("[data-filter]").forEach(b=>b.classList.toggle("active", b.dataset.filter===filter));
    document.getElementById("auCount").textContent = `${list.length} van ${questions.length}`;
    app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
    app.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>PLAY_goto(quizId, b.dataset.jump));
  };
  app.innerHTML=`
    <div class="spread">
      <a class="muted" data-nav="#/beheer/quiz/${quizId}">← Terug naar quiz-editor</a>
      <span class="muted au-count" id="auCount">${(questions||[]).length}</span>
    </div>
    <h1 style="margin:.5rem 0">Alles-in-één — ${esc(quiz?quiz.title:"")}</h1>
    <p class="muted" style="font-size:.85rem">Elke vraag met volledige tekst en volledige antwoorden. Klik <strong>Bewerken</strong> om de vraag aan te passen, of <strong>Spelen</strong> om ze in de speler-view te zien met reacties.</p>
    <div class="filterbar" style="margin-top:.6rem;flex-wrap:wrap">
      <span class="muted">Filter:</span>
      ${[
        ["alle","alle"],
        ["gevalideerd","✓ gevalideerd"],
        ["nietgevalideerd","⚠ niet gevalideerd"],
        ["openflags","open reacties"],
        ["geenflags","geen reacties"],
        ["docentwijkt","docent wijkt af"],
        ["mcq","meerkeuze/enkel"],
        ["meerkeuze","enkel meerkeuze"],
        ["matrix","matrix"],
        ["open","open vragen"],
        ["afbeelding","🖼️ met afbeelding"],
        ["geenafbeelding","zonder afbeelding"],
        ["geenuitleg","zonder uitleg"],
      ].map(([f,l])=>`<button class="chip-toggle" data-filter="${f}">${l}</button>`).join("")}
    </div>
    <div class="btnrow" style="margin-top:.5rem;flex-wrap:wrap">
      <span class="muted" style="align-self:center;font-size:.82rem">Bulk-actie op zichtbare vragen:</span>
      <button class="btn btn-ghost btn-sm" id="auValidateAll">✓ Valideren</button>
      <button class="btn btn-ghost btn-sm" id="auUnvalidateAll">✗ Validatie weghalen</button>
    </div>
    <div class="au-list" id="auList" style="margin-top:.8rem"></div>
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  app.querySelectorAll("[data-filter]").forEach(b=>b.onclick=()=>{ filter=b.dataset.filter; draw(); });
  const bulkValidate = async(newVal)=>{
    const visible = (questions||[]).filter(matches);
    const target  = visible.filter(q => (q.validated!==false) !== newVal); // enkel wijzigen
    if(!target.length) return toast(newVal?"Alle zichtbare vragen zijn al gevalideerd":"Alle zichtbare vragen staan al op niet-gevalideerd","ok");
    const label = newVal ? "valideren" : "op 'niet gevalideerd' zetten";
    if(!confirm(`${target.length} vraag/vragen ${label}? Dit past filter "${filter}" toe op de hele quiz.`)) return;
    const ids = target.map(q=>q.id);
    const { error } = await sb.from("questions").update({ validated:newVal }).in("id",ids);
    if(error) return toast(error.message,"err");
    toast(`${ids.length} vraag/vragen ${newVal?"gevalideerd":"op 'niet gevalideerd' gezet"}`,"ok");
    // Lokaal state updaten en hertekenen — geen volledige refetch nodig
    target.forEach(q=>{ q.validated=newVal; });
    draw();
  };
  document.getElementById("auValidateAll").onclick   = ()=>bulkValidate(true);
  document.getElementById("auUnvalidateAll").onclick = ()=>bulkValidate(false);
  draw();
}

function srcToggle(id, val){
  return `<div class="btnrow" style="margin:.2rem 0 0">
    <button type="button" class="chip-toggle ${val==="mens"?"active":""}" data-src="${id}" data-val="mens">${ICON.person} mens</button>
    <button type="button" class="chip-toggle ${val==="ai"?"active":""}" data-src="${id}" data-val="ai">${ICON.robot} AI</button></div>`;
}
function renderMatrixEditor(q){
  const rows=arr(q.matrix_rows), cols=arr(q.matrix_cols), correct=arr(q.matrix_correct);
  const colHeaders=cols.map((c,ci)=>`<th class="mx-colhead"><input data-mx-col="${ci}" value="${esc(c)}"><button type="button" class="mx-x" data-mx-delcol="${ci}" title="Kolom verwijderen">×</button></th>`).join("");
  const rowsHtml=rows.map((r,ri)=>{
    const cells=cols.map((_,ci)=>{
      const checked=correct[ri]===ci?"checked":"";
      return `<td class="mx-cell"><label><input type="radio" name="mx-edit-${q.id}-r${ri}" data-mx-corr-row="${ri}" data-mx-corr-col="${ci}" ${checked}></label></td>`;
    }).join("");
    return `<tr><th class="mx-rowhead"><input data-mx-row="${ri}" value="${esc(r)}"><button type="button" class="mx-x" data-mx-delrow="${ri}" title="Rij verwijderen">×</button></th>${cells}</tr>`;
  }).join("");
  return `<label>Matrix — vink per rij de juiste kolom aan (radiobutton). ${infoTip("Elke rij mag hoogstens één juist antwoord hebben. Als een rij geen aangevinkte kolom heeft, wordt hij als 'geen juist antwoord bepaald' geïmporteerd; de vraag komt dan als niet-gevalideerd binnen.")}</label>
    <div class="matrix-edit-wrap"><table class="matrix-edit-table" data-mx="${q.id}"><thead><tr><th></th>${colHeaders}</tr></thead><tbody>${rowsHtml}</tbody></table></div>
    <div class="btnrow"><button class="btn btn-ghost btn-sm" data-mx-addrow="${q.id}">+ rij</button><button class="btn btn-ghost btn-sm" data-mx-addcol="${q.id}">+ kolom</button></div>`;
}
function renderOpenEditor(q){
  return `<label>Modelantwoord (referentie) ${infoTip("Optioneel. Als de speler exact deze tekst typt (extra spaties/hoofdletters worden genegeerd) wordt de vraag als juist geteld. Anders komt hij als 'in overleg' binnen en kan een beheerder achteraf beoordelen.")}</label>
    <textarea data-f="open_answer" data-q="${q.id}" placeholder="Modelantwoord — bv. 'Binnen de maand na de vaststelling.'">${esc(q.open_answer||"")}</textarea>`;
}
function questionEditor(q){
  const corr=arr(q.correct_indexes);
  const doc=arr(q.docent_indexes);
  const qtype=q.question_type||"mcq";
  const typeChip=(v,label)=>`<button type="button" class="chip-toggle ${qtype===v?"active":""}" data-qtype="${q.id}" data-typeval="${v}">${label}</button>`;
  const showDocent = !!q._show_docent;
  // Compacte kop-rij per sectie: Gevalideerd (per vraag, gedeelde staat) + Herkomst mens/AI (per veld)
  const sectionToolbar = (srcId, srcVal, srcLabel) => `
    <div class="qe-inline-toolbar">
      <label class="qe-tool-check"><input type="checkbox" class="qe-valid-mirror" data-valid-mirror="${q.id}" ${q.validated!==false?"checked":""}> Gevalideerd</label>
      <span class="qe-tool-sep"></span>
      <span class="qe-tool-lbl">${esc(srcLabel)}:</span>
      <span class="qe-tool-src">${srcToggle(srcId, srcVal)}</span>
    </div>`;
  const mcqBlock = qtype==="mcq" ? `
    <label style="display:flex;align-items:center;gap:.5rem;font-weight:400"><input type="checkbox" data-multi="${q.id}" style="width:auto" ${q.multi?"checked":""}> Meerkeuze (meerdere juiste antwoorden)</label>
    <label>Antwoordopties — vink <strong>J</strong> aan voor het wettelijk juiste antwoord${showDocent?", en <strong>D</strong> voor het antwoord dat de docent koos (indien verschillend)":""} ${infoTip(showDocent?"J = juridisch/officieel juist antwoord. D = wat de docent aanduidde — enkel invullen als die afwijkt van J.":"J = juridisch/officieel juist antwoord. Docent-antwoorden staan uit voor deze quiz — zet ze aan bovenaan (Beheer → Quiz) als je ze nodig hebt.")}</label>
    <div data-opts="${q.id}">${(q.options||[]).map((o,i)=>`
      <div class="spread optrow" style="gap:.4rem;margin:.2rem 0" data-opt-row="${i}">
        <label class="cbxlab" title="Juridisch juist"><input type="checkbox" class="corr" data-q="${q.id}" value="${i}" ${corr.includes(i)?"checked":""} style="width:auto"><span>J</span></label>
        ${showDocent?`<label class="cbxlab cbxlab-doc" title="Volgens de docent"><input type="checkbox" class="doc" data-q="${q.id}" value="${i}" ${doc.includes(i)?"checked":""} style="width:auto"><span>D</span></label>`:""}
        <input data-opt="${q.id}" value="${esc(o)}" style="flex:1">
        <button type="button" class="opt-ref-chip" data-insert="${letter(i)}" data-opt-idx="${i}" title="Klik: voeg {${letter(i)}} in — verwijst naar de tekst hierlinks. Shift+klik: voeg toe aan een lopende {A,B,…} groep.">{${letter(i)}}</button>
        <button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>
      </div>`).join("")}</div>
    <button class="btn btn-ghost btn-sm" data-addopt="${q.id}">+ optie</button>
    ${showDocent?`<label>Toelichting docent (optioneel) ${infoTip("Korte uitleg waarom de docent een ander antwoord kiest dan wat wettelijk juist is. Wordt getoond in het docent-blok bij de vraag. Verwijs naar antwoordopties met {A} {B} {C} … — die worden vertaald naar de letter die de speler ziet.")}</label>
    <textarea data-f="docent_note" data-q="${q.id}" placeholder="bv. De docent noteert antwoord {B} als praktijk-antwoord…">${esc(q.docent_note||"")}</textarea>`:""}` : "";
  const matrixBlock = qtype==="matrix" ? renderMatrixEditor(q) : "";
  const openBlock   = qtype==="open"   ? renderOpenEditor(q)   : "";
  return `<div class="card qe-card" data-qcard="${q.id}" data-qtype-current="${qtype}">
    <div class="spread qe-topbar">
      <span class="q-num">Vraag ${q.qnum}</span>
      <button class="btn btn-danger btn-sm" data-delq="${q.id}">Verwijderen</button>
    </div>

    <section class="qe-section qe-sec-question">
      <div class="qe-sec-hd"><span class="qe-sec-title">Vraag</span></div>
      <label>Vraagtype</label>
      <div class="btnrow" style="margin:.2rem 0 .4rem">
        ${typeChip("mcq","Meerkeuze")} ${typeChip("matrix","Matrix")} ${typeChip("open","Open vraag")}
        <span class="muted" style="font-size:.75rem;margin-left:.4rem">Wisselen bewaart eerst de andere velden van deze vraag.</span>
      </div>
      <label>Vraagtekst</label>
      <textarea data-f="text" data-q="${q.id}">${esc(q.text)}</textarea>
      <label>Afbeelding (optioneel) ${infoTip("Upload een PNG/JPG/WebP. Wordt bovenaan de vraag getoond bij de speler. Max ~5 MB.")}</label>
      <div class="qimg-editor" data-qimg="${q.id}">
        <div class="qimg-preview" ${q.image_url?"":"hidden"}>
          ${q.image_url?`<img src="${esc(q.image_url)}" alt="Vraag-afbeelding">`:""}
        </div>
        <div class="btnrow" style="margin:.3rem 0">
          <input type="file" accept="image/png,image/jpeg,image/webp" data-qimg-file="${q.id}" style="flex:1">
          <button type="button" class="btn btn-ghost btn-sm" data-qimg-remove="${q.id}" ${q.image_url?"":"hidden"}>Verwijderen</button>
        </div>
        <div class="qimg-status muted" data-qimg-status="${q.id}" style="font-size:.75rem"></div>
      </div>
      <!-- (hoofd-gevalideerd checkbox verplaatst naar de sectie-toolbars hieronder) -->
      <input type="checkbox" data-valid="${q.id}" ${q.validated!==false?"checked":""} hidden>
      <div data-valid-warn="${q.id}" class="valid-mismatch" hidden>⚠️ J en D verschillen — vragen worden standaard <strong>niet-gevalideerd</strong> bewaard tot je hier bewust bevestigt door dit vinkje aan te zetten.</div>
    </section>

    <section class="qe-section qe-sec-answers">
      <div class="qe-sec-hd"><span class="qe-sec-title">Antwoorden</span></div>
      ${sectionToolbar("as-"+q.id, q.answer_source, "Juist antwoord")}
      ${mcqBlock}
      ${matrixBlock}
      ${openBlock}
    </section>

    <section class="qe-section qe-sec-explain">
      <div class="qe-sec-hd"><span class="qe-sec-title">Uitleg</span></div>
      ${sectionToolbar("es-"+q.id, q.explanation_source, "Uitleg")}
      <label>Uitleg ${infoTip("Waarom is dit antwoord juist? Verwijs naar antwoordopties met {A} {B} {C} … De app vertaalt die naar de letter die de gebruiker daadwerkelijk ziet. Klik op een {A}-chip naast een optie om die op je cursorpositie in te voegen. Shift+klik om aan een lopende {A,B}-groep toe te voegen. Speciale tokens: {juist}, {docent}.")}</label>
      <div class="ref-chip-row">
        <button type="button" class="btn btn-ghost btn-sm ref-picker-btn" data-editor-picker="${q.id}" style="padding:.2rem .6rem;font-size:.78rem">${ICON.info} Verwijs naar een antwoord…</button>
      </div>
      <textarea data-f="explanation" data-q="${q.id}">${esc(q.explanation||"")}</textarea>
    </section>

    <section class="qe-section qe-sec-legal">
      <div class="qe-sec-hd"><span class="qe-sec-title">Wetgeving</span></div>
      ${sectionToolbar("ls-"+q.id, q.legal_basis_source, "Wettelijke basis")}
      <label>Wettelijke basis ${infoTip("Verwijs naar antwoordopties met {A} {B} {C} … De app vertaalt die naar de letter die de gebruiker in zijn geschudde volgorde ziet.")}</label>
      <textarea data-f="legal_basis" data-q="${q.id}">${esc(q.legal_basis||"")}</textarea>
      <label>Wettekst (volledige artikels, uitklapbaar bij de vraag) ${infoTip("Volledige artikeltekst. Verwijs naar antwoordopties met {A} {B} {C} … indien nodig.")}</label>
      <textarea data-f="wettekst" data-q="${q.id}">${esc(q.wettekst||"")}</textarea>
    </section>

    <div class="btnrow qe-savebar"><button class="btn btn-primary btn-sm" data-saveq="${q.id}">Vraag opslaan</button></div>
  </div>`;
}
function wireQuestionEditor(q, quizId){
  const card=document.querySelector(`[data-qcard="${q.id}"]`);
  bindAutoGrow(card);
  const qtype=q.question_type||"mcq";
  const srcVals={ answer_source:q.answer_source, explanation_source:q.explanation_source, legal_basis_source:q.legal_basis_source };
  card.querySelectorAll("[data-src]").forEach(b=>b.onclick=()=>{
    const grp=b.dataset.src; card.querySelectorAll(`[data-src="${grp}"]`).forEach(x=>x.classList.toggle("active",x===b));
    if(grp.startsWith("as-")) srcVals.answer_source=b.dataset.val;
    else if(grp.startsWith("ls-")) srcVals.legal_basis_source=b.dataset.val;
    else srcVals.explanation_source=b.dataset.val;
  });
  // Alle "Gevalideerd"-mirrors op de sectie-toolbars houden dezelfde staat aan
  const mainValid = card.querySelector(`[data-valid="${q.id}"]`);
  const mirrors = card.querySelectorAll(`[data-valid-mirror="${q.id}"]`);
  const syncValidFrom = (src, val)=>{
    if(mainValid && mainValid!==src) mainValid.checked = val;
    mirrors.forEach(m=>{ if(m!==src) m.checked = val; });
  };
  mirrors.forEach(m=>m.onchange=()=>syncValidFrom(m, m.checked));
  if(mainValid) mainValid.onchange=()=>syncValidFrom(mainValid, mainValid.checked);
  // Afbeelding-upload: direct naar Supabase Storage → URL wegschrijven op de vraag
  const qimgFile   = card.querySelector(`[data-qimg-file="${q.id}"]`);
  const qimgRemove = card.querySelector(`[data-qimg-remove="${q.id}"]`);
  const qimgWrap   = card.querySelector(`[data-qimg="${q.id}"]`);
  const qimgStatus = card.querySelector(`[data-qimg-status="${q.id}"]`);
  const qimgPreview= qimgWrap ? qimgWrap.querySelector(".qimg-preview") : null;
  const setQimgStatus=(msg,kind)=>{ if(!qimgStatus) return; qimgStatus.textContent=msg||""; qimgStatus.style.color = kind==="err"?"var(--wrong)":kind==="ok"?"var(--correct)":""; };
  const refreshQimgPreview=(url)=>{
    q.image_url=url||null;
    if(qimgPreview){
      if(url){ qimgPreview.innerHTML=`<img src="${url}" alt="Vraag-afbeelding">`; qimgPreview.hidden=false; }
      else   { qimgPreview.innerHTML=""; qimgPreview.hidden=true; }
    }
    if(qimgRemove) qimgRemove.hidden = !url;
  };
  if(qimgFile) qimgFile.onchange=async e=>{
    const f=e.target.files && e.target.files[0]; if(!f) return;
    if(f.size > 5*1024*1024){ setQimgStatus("Bestand te groot (max 5 MB)","err"); qimgFile.value=""; return; }
    setQimgStatus("Uploaden…");
    const ext = (f.name.split(".").pop()||"bin").toLowerCase().replace(/[^a-z0-9]/g,"");
    const path = `q_${q.id}/${Date.now()}.${ext}`;
    const { error:upErr } = await sb.storage.from("question-images").upload(path, f, { upsert:true, contentType:f.type });
    if(upErr){ setQimgStatus("Upload mislukt: "+upErr.message,"err"); return; }
    const { data:pub } = sb.storage.from("question-images").getPublicUrl(path);
    const url = pub && pub.publicUrl;
    const { error:dbErr } = await sb.from("questions").update({ image_url:url }).eq("id",q.id);
    if(dbErr){ setQimgStatus("Opslaan mislukt: "+dbErr.message,"err"); return; }
    refreshQimgPreview(url);
    qimgFile.value="";
    setQimgStatus("Afbeelding opgeslagen","ok");
  };
  if(qimgRemove) qimgRemove.onclick=async()=>{
    if(!q.image_url) return;
    if(!confirm("Afbeelding verwijderen?")) return;
    // Probeer ook uit storage te wissen — path is alles na "/question-images/"
    const m = /\/question-images\/(.+)$/.exec(q.image_url||"");
    if(m) sb.storage.from("question-images").remove([decodeURIComponent(m[1])]).catch(()=>{});
    const { error:dbErr } = await sb.from("questions").update({ image_url:null }).eq("id",q.id);
    if(dbErr){ setQimgStatus("Wissen mislukt: "+dbErr.message,"err"); return; }
    refreshQimgPreview(null);
    setQimgStatus("Afbeelding verwijderd","ok");
  };

  // Type-wissel: schrijf question_type weg en herlaad de editor met de juiste sub-editor
  card.querySelectorAll(`[data-qtype="${q.id}"]`).forEach(btn=>btn.onclick=async()=>{
    const nv=btn.dataset.typeval;
    if(nv===qtype) return;
    if(!confirm(`Vraagtype wisselen naar "${nv}"? Bewaar eerst je andere wijzigingen (uitleg, wettekst, …) — die worden nu overschreven met wat er in de databank staat.`)) return;
    const { error }=await sb.from("questions").update({ question_type:nv }).eq("id",q.id);
    if(error) return toast(error.message,"err");
    toast("Type gewisseld","ok"); viewEditQuestion(q.id);
  });
  const addRm=el=>{ el.querySelector("[data-rmopt]").onclick=()=>el.remove(); };
  const addOptBtn = card.querySelector(`[data-addopt="${q.id}"]`);
  if(addOptBtn) addOptBtn.onclick=()=>{
    const wrap=card.querySelector(`[data-opts="${q.id}"]`);
    const nextIdx=wrap.querySelectorAll(".optrow").length;
    const div=document.createElement("div"); div.className="spread optrow"; div.style="gap:.4rem;margin:.2rem 0";
    const l=letter(nextIdx);
    const docBox = q._show_docent ? `<label class="cbxlab cbxlab-doc" title="Volgens de docent"><input type="checkbox" class="doc" data-q="${q.id}" style="width:auto"><span>D</span></label>` : "";
    div.innerHTML=`<label class="cbxlab" title="Juridisch juist"><input type="checkbox" class="corr" data-q="${q.id}" style="width:auto"><span>J</span></label>${docBox}<input data-opt="${q.id}" value="" style="flex:1"><button type="button" class="opt-ref-chip" data-insert="${l}" title="Klik om {${l}} in te voegen op je cursorpositie in het laatst gefocuste tekstvak">{${l}}</button><button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>`;
    wrap.appendChild(div); addRm(div);
    wireRefChip(div.querySelector(".opt-ref-chip"));
  };
  // Bijhouden welk rich-text vak (uitleg/wettelijke basis/wettekst/docent) laatst focus had
  const richFields = ["explanation","legal_basis","wettekst","docent_note"];
  let lastFocused = card.querySelector(`[data-f="explanation"][data-q="${q.id}"]`); // default = Uitleg
  richFields.forEach(f=>{
    const ta = card.querySelector(`[data-f="${f}"][data-q="${q.id}"]`);
    if(ta) ta.addEventListener("focus", ()=>{ lastFocused=ta; });
  });
  function wireRefChip(chip){
    chip.onclick=e=>{
      e.preventDefault();
      const raw = chip.dataset.insert || chip.dataset.insertSpecial;
      const ta = lastFocused;
      if(!ta) return;
      // Shift+klik op een letter-chip: als de cursor direct achter een `{...}`-groep staat,
      // voeg deze letter dan toe aan die groep (bv. {A} → {A,B}).
      if(e.shiftKey && chip.dataset.insert){
        const start = ta.selectionStart;
        const v = ta.value;
        const m = v.slice(0,start).match(/\{([A-Za-z](?:\s*,\s*[A-Za-z])*)\}$/);
        if(m){
          const existing = m[1].split(/\s*,\s*/).map(s=>s.toUpperCase());
          if(!existing.includes(raw.toUpperCase())){
            existing.push(raw.toUpperCase());
            const newTok = `{${existing.join(",")}}`;
            const before = v.slice(0, start - m[0].length);
            ta.value = before + newTok + v.slice(start);
            ta.focus();
            const pos = before.length + newTok.length;
            ta.setSelectionRange(pos, pos);
            toast(`Uitgebreid naar ${newTok}`,"ok");
            return;
          }
        }
        // val terug op normale insert
      }
      const token = `{${raw}}`;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const v = ta.value;
      ta.value = v.slice(0,start) + token + v.slice(end);
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
      // Feedback: toon in een toast naar welke optie deze verwijzing wijst
      if(chip.dataset.insert){
        const row = card.querySelector(`[data-opt-row="${chip.dataset.optIdx}"]`);
        const optInput = row ? row.querySelector(`[data-opt="${q.id}"]`) : null;
        const optText = optInput ? optInput.value : "";
        if(optText) toast(`${token} verwijst naar: "${optText.slice(0,60)}${optText.length>60?"…":""}"`,"ok");
        else toast(`${token} ingevoegd`,"ok");
      } else if(chip.dataset.insertSpecial){
        toast(`${token} ingevoegd — vertaalt automatisch naar het ${chip.dataset.insertSpecial==="juist"?"juiste antwoord":"docent-antwoord"}`,"ok");
      }
    };
  }
  card.querySelectorAll(".opt-ref-chip").forEach(wireRefChip);
  // Popup-versie: verzamelt LIVE de huidige opties + J/D-vinkjes uit de editor
  const pickerBtn = card.querySelector(`[data-editor-picker="${q.id}"]`);
  if(pickerBtn) pickerBtn.onclick=()=>{
    const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
    const options=[], corr=[], doc=[];
    rows.forEach((r,i)=>{
      const v=r.querySelector(`[data-opt="${q.id}"]`).value.trim();
      if(!v) return;
      const idx=options.length; options.push(v);
      if(r.querySelector(".corr").checked) corr.push(idx);
      if(r.querySelector(".doc").checked) doc.push(idx);
    });
    const liveQ = { id:q.id, options, correct_indexes:corr, docent_indexes:doc,
      answer_source:q.answer_source, explanation_source:q.explanation_source, legal_basis_source:q.legal_basis_source };
    openRefPicker(q.id, lastFocused, liveQ);
  };
  card.querySelectorAll(`[data-opts="${q.id}"] .optrow`).forEach(addRm);
  // waarschuwing bij J≠D: iedere J- of D-verandering evalueert opnieuw
  const paintMismatchWarn=()=>{
    const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
    const jIdxs=[], dIdxs=[];
    rows.forEach((r,i)=>{
      const c=r.querySelector(".corr"); if(c && c.checked) jIdxs.push(i);
      const d=r.querySelector(".doc");  if(d && d.checked) dIdxs.push(i);
    });
    const differs = dIdxs.length>0 && !setEq(jIdxs, dIdxs);
    const warn=card.querySelector(`[data-valid-warn="${q.id}"]`);
    if(warn) warn.hidden = !differs;
  };
  card.addEventListener("change", e=>{ if(e.target.matches(".corr, .doc")) paintMismatchWarn(); });
  paintMismatchWarn();
  card.querySelector(`[data-delq="${q.id}"]`).onclick=async()=>{
    if(!confirm("Vraag verwijderen?")) return;
    await sb.from("questions").delete().eq("id",q.id); toast("Verwijderd","ok"); viewBeheerQuiz(quizId);
  };
  // ---- Matrix-editor wiring (indien van toepassing) ----
  if(qtype==="matrix"){
    const table=card.querySelector(`[data-mx="${q.id}"]`);
    // In-memory model dat we live bijwerken en bij Save wegschrijven
    const state = {
      rows: arr(q.matrix_rows).slice(),
      cols: arr(q.matrix_cols).slice(),
      correct: arr(q.matrix_correct).slice(),
    };
    // Zorg dat correct-array evenlang is als rows
    while(state.correct.length < state.rows.length) state.correct.push(-1);
    state.correct.length = state.rows.length;
    const rerenderMatrix=()=>{
      const wrap=card.querySelector(".matrix-edit-wrap");
      if(!wrap) return;
      // Tijdelijk in q injecteren en HTML opnieuw genereren
      const tmp={...q, matrix_rows:state.rows, matrix_cols:state.cols, matrix_correct:state.correct};
      const parser=new DOMParser();
      const html=renderMatrixEditor(tmp);
      const doc=parser.parseFromString(`<div>${html}</div>`,"text/html");
      const newWrap=doc.querySelector(".matrix-edit-wrap");
      const newBtnrow=doc.querySelectorAll(".btnrow")[0];
      wrap.replaceWith(newWrap);
      // Vervang ook de bestaande btnrow (de "+rij/+kolom" knoppen)
      const btnRows=card.querySelectorAll(".btnrow");
      // De laatste btnrow met "+rij" hoort bij de matrix-editor — vind ze via het "data-mx-addrow" attribuut
      const existingAdd=card.querySelector(`[data-mx-addrow="${q.id}"]`);
      if(existingAdd && existingAdd.parentElement) existingAdd.parentElement.replaceWith(newBtnrow);
      wireMatrixEditor();
    };
    function wireMatrixEditor(){
      card.querySelectorAll(`[data-mx-row]`).forEach(inp=>inp.oninput=e=>{ state.rows[+inp.dataset.mxRow]=e.target.value; });
      card.querySelectorAll(`[data-mx-col]`).forEach(inp=>inp.oninput=e=>{ state.cols[+inp.dataset.mxCol]=e.target.value; });
      card.querySelectorAll(`[data-mx-corr-row]`).forEach(rb=>rb.onchange=()=>{
        const ri=+rb.dataset.mxCorrRow, ci=+rb.dataset.mxCorrCol;
        state.correct[ri]=ci;
      });
      const addRow=card.querySelector(`[data-mx-addrow="${q.id}"]`);
      if(addRow) addRow.onclick=()=>{ state.rows.push(""); state.correct.push(-1); rerenderMatrix(); };
      const addCol=card.querySelector(`[data-mx-addcol="${q.id}"]`);
      if(addCol) addCol.onclick=()=>{ state.cols.push(""); rerenderMatrix(); };
      card.querySelectorAll(`[data-mx-delrow]`).forEach(b=>b.onclick=()=>{
        const ri=+b.dataset.mxDelrow;
        state.rows.splice(ri,1); state.correct.splice(ri,1); rerenderMatrix();
      });
      card.querySelectorAll(`[data-mx-delcol]`).forEach(b=>b.onclick=()=>{
        const ci=+b.dataset.mxDelcol;
        state.cols.splice(ci,1);
        // rijen die deze kolom als juist hadden → -1; hogere indexen -1
        state.correct = state.correct.map(c=> c===ci ? -1 : (c>ci ? c-1 : c));
        rerenderMatrix();
      });
    }
    wireMatrixEditor();
    // Bind zo we bij Save direct de meest recente state hebben
    card.__matrixState = state;
  }

  card.querySelector(`[data-saveq="${q.id}"]`).onclick=async()=>{
    const text=card.querySelector(`[data-f="text"][data-q="${q.id}"]`).value.trim();
    const validated=card.querySelector(`[data-valid="${q.id}"]`).checked;
    const common={ text, validated,
      legal_basis:card.querySelector(`[data-f="legal_basis"][data-q="${q.id}"]`).value,
      wettekst:card.querySelector(`[data-f="wettekst"][data-q="${q.id}"]`).value,
      explanation:card.querySelector(`[data-f="explanation"][data-q="${q.id}"]`).value,
      answer_source:srcVals.answer_source, explanation_source:srcVals.explanation_source, legal_basis_source:srcVals.legal_basis_source };
    let payload;
    if(qtype==="matrix"){
      const st=card.__matrixState||{rows:[],cols:[],correct:[]};
      if(!st.rows.length || !st.cols.length) return toast("Voeg minstens één rij en één kolom toe","err");
      if(st.rows.some(r=>!String(r).trim())) return toast("Alle rij-labels invullen","err");
      if(st.cols.some(c=>!String(c).trim())) return toast("Alle kolom-labels invullen","err");
      payload={ ...common, question_type:"matrix", multi:false,
        options:[], correct_indexes:[], docent_indexes:null, docent_note:null,
        matrix_rows:st.rows, matrix_cols:st.cols, matrix_correct:st.correct };
    } else if(qtype==="open"){
      const modelAnswer=card.querySelector(`[data-f="open_answer"][data-q="${q.id}"]`).value;
      payload={ ...common, question_type:"open", multi:false,
        options:[], correct_indexes:[], docent_indexes:null, docent_note:null,
        matrix_rows:null, matrix_cols:null, matrix_correct:null,
        open_answer:modelAnswer };
    } else {
      const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
      const opts=[]; const correct=[]; const docent=[];
      rows.forEach(r=>{ const v=r.querySelector(`[data-opt="${q.id}"]`).value.trim(); if(!v) return;
        const idx=opts.length; opts.push(v);
        if(r.querySelector(".corr").checked) correct.push(idx);
        const dc=r.querySelector(".doc"); if(dc && dc.checked) docent.push(idx);
      });
      if(opts.length<2) return toast("Minstens 2 opties","err");
      if(validated && !correct.length) return toast("Vink een juist antwoord aan, of zet 'Gevalideerd' uit.","err");
      const multi=card.querySelector(`[data-multi="${q.id}"]`).checked || correct.length>1;
      const docentNoteEl=card.querySelector(`[data-f="docent_note"][data-q="${q.id}"]`);
      const docent_note = docentNoteEl ? docentNoteEl.value : (q.docent_note||"");
      // Als docent uit staat, laat bestaande waarden onaangeraakt (geen nieuwe D-input beschikbaar)
      const preserveDocent = !q._show_docent;
      payload={ ...common, question_type:"mcq", options:opts, correct_indexes:correct, multi };
      if(preserveDocent){
        // niets meegeven → bestaande docent_indexes/docent_note blijven zoals ze zijn
      } else {
        payload.docent_indexes = docent.length ? docent : null;
        payload.docent_note    = docent.length ? docent_note : null;
      }
    }
    const { error }=await sb.from("questions").update(payload).eq("id",q.id);
    if(error) return toast(error.message,"err");
    toast("Vraag opgeslagen (wijzigingen gelogd)","ok");
  };
}

/* ============================================================
   TEST-PREVIEW binnen de vraag-editor
   ============================================================ */
// Laat de beheerder de vraag "spelen" om de weergave te controleren zonder DB-writes
function renderTestPreview(q, chosen){
  const el=document.getElementById("testPreview"); if(!el) return;
  // Voor matrix/open is de test-preview beperkt tot een niet-interactieve samenvatting —
  // de beheerder kan altijd op "Opslaan & bekijken" klikken om de echte spelerweergave te zien.
  if(q.question_type==="matrix" || q.question_type==="open"){
    const summary = q.question_type==="matrix"
      ? `<div class="muted">Matrix met ${arr(q.matrix_rows).length} rijen × ${arr(q.matrix_cols).length} kolommen. Test de speler-weergave via "Opslaan & bekijken".</div>`
      : `<div class="muted">Open vraag${q.open_answer?" (modelantwoord ingesteld)":" (geen modelantwoord)"}. Test de speler-weergave via "Opslaan & bekijken".</div>`;
    el.innerHTML=`<div class="preview-hd"><div>${ICON.info} <strong>Preview</strong></div></div><div class="card" style="margin-top:.4rem"><div class="q-meta"><span class="q-num">Vraag ${q.qnum}</span>${questionTags(q)}</div><div class="q-text">${esc(q.text)}</div>${q.image_url?`<div class="q-image"><img src="${esc(q.image_url)}" alt="Vraag-afbeelding"></div>`:""}${summary}</div>`;
    return;
  }
  const correct=arr(q.correct_indexes);
  const docent=arr(q.docent_indexes);
  const docentDiffers=docent.length>0 && !setEq(docent,correct);
  const validated=q.validated!==false;
  const multi=q.multi || correct.length>1;
  const answered = chosen!=null;
  // Vaste volgorde (geen shuffle) zodat de beheerder zeker weet welke {A} met welke optie klopt
  const opts=(q.options||[]).map((o,i)=>{
    let cls="opt";
    if(answered){ cls+=" disabled";
      // In de test-preview: toon altijd het correcte antwoord in groen — ook bij niet-gevalideerde
      // vragen wil de beheerder zien wat er bedoeld is.
      if(correct.includes(i)) cls+=" correct";
      else if(inSet(chosen,i)) cls+=" wrong";
      if(docentDiffers && docent.includes(i)) cls+=" docent";
    }
    const docentBadge = answered && docentDiffers && docent.includes(i) ? `<span class="opt-doc" title="Volgens de docent">👨‍🏫</span>` : "";
    const correctBadge = answered && correct.includes(i) ? srcBadge(validated?"Juist antwoord":"Bedoeld als juist (niet gevalideerd)", q.answer_source) : "";
    const box = (!answered && multi) ? `<input type="checkbox" class="test-mopt" value="${i}" style="width:auto;margin-top:.15rem">` : "";
    return `<div class="${cls}" data-test-opt="${i}">${box}<span class="letter">${letter(i)}</span><span>${esc(o)} ${correctBadge}${docentBadge}</span></div>`;
  }).join("");
  const isRightNow = answered ? (validated ? setEq(chosen, correct) : null) : null;
  const statusPill = answered
    ? (isRightNow===true?`<span class="pill juist">juist beantwoord</span>`
       :isRightNow===false?`<span class="pill fout">fout beantwoord</span>`
       :`<span class="pill twijfel">antwoord genoteerd — in overleg</span>`)
    : `<span class="pill" style="background:var(--surface2);color:var(--text-muted)">nog niet beantwoord</span>`;
  el.innerHTML=`
    <div class="preview-hd">
      <div>${ICON.info} <strong>Test deze vraag</strong> <span class="muted" style="font-size:.78rem">— zoals de speler ze zal zien (zonder shuffle voor jouw referentie). Geen DB-writes.</span></div>
      <button class="btn btn-ghost btn-sm" id="testReset">↺ Opnieuw</button>
    </div>
    <div class="card" style="margin-top:.4rem">
      <div class="q-meta"><span class="q-num">Vraag ${q.qnum}</span>${questionTags(q)}${statusPill}</div>
      <div class="q-text">${esc(q.text)}</div>
      ${q.image_url?`<div class="q-image"><img src="${esc(q.image_url)}" alt="Vraag-afbeelding"></div>`:""}
      ${(!answered && (q.wettekst || q.legal_basis)) ? `<details class="prehelp"><summary>${ICON.info} Raadpleeg wettekst voor je antwoordt</summary>
        <div class="prehelp-body">
          ${q.legal_basis?`<div class="prehelp-legal"><strong>Wettelijke basis:</strong> ${html(translateOptRefs(q.legal_basis, q.id, q))}</div>`:""}
          ${q.wettekst?`<div class="wettekst">${html(translateOptRefs(q.wettekst, q.id, q))}</div>`:""}
        </div></details>`:""}
      <div id="testOpts">${opts}</div>
      ${(multi && !answered)?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="testCheckMulti">Nakijken</button></div>`:""}
      ${answered?`
      <div class="explain" style="margin-top:.8rem">
        <span class="lbl">Wettelijk juist antwoord ${srcBadge("Uitleg",q.explanation_source)}</span>${html(translateOptRefs(q.explanation||"— geen uitleg —", q.id, q))}
        ${q.legal_basis?`<div class="legal-inline"><strong>Wettelijke basis:</strong> ${srcBadge("Wettelijke basis",q.legal_basis_source)} ${html(translateOptRefs(q.legal_basis, q.id, q))}</div>`:""}
        ${q.wettekst?`<details class="wettekst-d"><summary>${ICON.info} Toon wettekst</summary><div class="wettekst">${html(translateOptRefs(q.wettekst, q.id, q))}</div></details>`:""}
      </div>
      ${(q._show_docent && docentDiffers) ? `<div class="docent-block differs">
        <div class="docent-hd">👨‍🏫 <strong>Volgens de docent</strong> <span class="pill" style="background:var(--warn-soft);color:var(--warn)">wijkt af van wettelijk antwoord</span></div>
        <ul class="docent-items">${docent.map(i=>`<li><strong>${letter(i)}.</strong> ${esc((q.options||[])[i]||"")}</li>`).join("")}</ul>
        ${q.docent_note?`<div class="docent-note">${esc(translateOptRefs(q.docent_note, q.id, q))}</div>`:""}
      </div>`:""}
      `:""}
    </div>
  `;
  document.getElementById("testReset").onclick=()=>renderTestPreview(q, null);
  if(!answered){
    if(multi){
      // Toggle chosen visueel + submit via nakijk-knop
      const syncChosen=()=>el.querySelectorAll("[data-test-opt]").forEach(row=>{
        const cb=row.querySelector(".test-mopt"); row.classList.toggle("chosen", !!(cb&&cb.checked));
      });
      el.querySelectorAll("[data-test-opt]").forEach(row=>row.onclick=e=>{
        if(e.target.tagName!=="INPUT"){ const cb=row.querySelector(".test-mopt"); if(cb) cb.checked=!cb.checked; }
        syncChosen();
      });
      document.getElementById("testCheckMulti").onclick=()=>{
        const sel=[...el.querySelectorAll(".test-mopt:checked")].map(c=>+c.value);
        if(!sel.length) return toast("Kruis minstens één antwoord aan","err");
        renderTestPreview(q, sel.sort((a,b)=>a-b));
      };
    } else {
      el.querySelectorAll("[data-test-opt]").forEach(row=>row.onclick=()=>renderTestPreview(q, [+row.dataset.testOpt]));
    }
  }
}

/* ============================================================
   ÉÉN VRAAG bewerken + flags/opmerkingen beheren
   ============================================================ */
async function viewEditQuestion(qid){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:q } = await sb.from("questions").select("*").eq("id",qid).single();
  if(!q){ app.innerHTML=`<div class="empty">Vraag niet gevonden.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("id,title,show_docent").eq("id",q.quiz_id).single();
  q._show_docent = !!(quiz && quiz.show_docent);
  const [{data:flags},{data:edits}] = await Promise.all([
    sb.from("flags").select("*").eq("question_id",qid).order("created_at",{ascending:false}),
    sb.from("question_edits").select("*").eq("question_id",qid).order("created_at",{ascending:false}),
  ]);
  const names=await namesFor([...(flags||[]).map(f=>f.user_id),...(edits||[]).map(e=>e.edited_by)]);
  app.innerHTML=`
    <div class="spread">
      <a class="muted" data-nav="#/beheer/quiz/${q.quiz_id}">← Alle vragen van "${esc(quiz?quiz.title:"")}"</a>
      <button class="btn btn-primary btn-sm" id="saveAndPreview">${ICON.check} Opslaan &amp; bekijken →</button>
    </div>
    <h1 style="margin:.5rem 0">Vraag ${q.qnum} bewerken</h1>

    <div class="preview-card" id="testPreview"></div>

    <div class="stack" id="qList">${questionEditor(q)}</div>

    <h2>Reacties (${(flags||[]).length})</h2>
    <div class="card" id="beheerReactieCompose">
      <div class="spread" style="align-items:center;margin-bottom:.4rem">
        <strong>${ICON.chat} Reactie of opmerking starten</strong>
        <span class="muted" style="font-size:.75rem">Wordt zichtbaar voor iedereen die deze vraag speelt.</span>
      </div>
      <div class="btnrow" id="beheerReactBtns" style="flex-wrap:wrap">
        <button type="button" class="chip-toggle active" data-ftype="commentaar">💬 Commentaar</button>
        <button type="button" class="chip-toggle" data-ftype="twijfel">Twijfel</button>
        <button type="button" class="chip-toggle" data-ftype="fout">Antwoord is fout</button>
        <button type="button" class="chip-toggle" data-ftype="juist">Antwoord is juist</button>
        ${q._show_docent?`<button type="button" class="chip-toggle" data-ftype="docent">👨‍🏫 Docent koos…</button>`:""}
      </div>
      ${q.question_type==="mcq" && (q.options||[]).length ? `
        <div id="beheerReactPref" hidden style="margin-top:.5rem">
          <label id="beheerRPrefLabel" style="font-size:.82rem">Welk antwoord vind jij dan juist?</label>
          <div class="opref-list">
            ${(q.options||[]).map((o,i)=>`<label class="opref-item"><input type="checkbox" class="beheer-opref" value="${i}"><span><strong>${letter(i)}.</strong> ${esc(o)}</span></label>`).join("")}
          </div>
        </div>` : ""}
      <label style="margin-top:.5rem;font-size:.82rem" id="beheerRMotLabel">Commentaar</label>
      <textarea id="beheerRMot" placeholder="Typ je reactie…" style="min-height:80px"></textarea>
      <div class="btnrow" style="margin-top:.4rem">
        <button class="btn btn-primary btn-sm" id="beheerRSubmit">Reactie plaatsen</button>
      </div>
    </div>
    <div class="stack" style="margin-top:.6rem">${(flags||[]).map(f=>`<div class="card"><div class="spread">
      <div><span class="pill ${f.type}">${f.type}</span> ${f.status==="afgehandeld"?`<span class="pill afgehandeld">afgehandeld</span>`:""} <span class="who">${esc(names[f.user_id]||"?")}</span>${arr(f.preferred_indexes).length?` <span class="muted">· verkiest <strong>${lettersOf(f.preferred_indexes)}</strong></span>`:""} <span class="when">${fmtDate(f.created_at)}</span>${f.toelichting?`<div class="cmt">${formatCommentBody(f.toelichting, qid, q)}</div>`:""}</div>
      <div class="btnrow" style="margin:0">${f.status==="open"?`<button class="btn btn-ghost btn-sm" data-resolve="${f.id}">${ICON.check} Afhandelen</button>`:""}<button class="btn btn-danger btn-sm" data-delflag="${f.id}">Verwijderen</button></div>
    </div></div>`).join("")||`<p class="muted">Geen reacties.</p>`}</div>

    <h2>Wijzigingshistoriek (${(edits||[]).length})</h2>
    <div class="stack">${(edits||[]).map(e=>`<div class="hist"><span class="who">${esc(names[e.edited_by]||"?")}</span> <span class="when">${fmtDate(e.created_at)}</span><div>${esc(e.summary)}</div></div>`).join("")||`<p class="muted">Geen wijzigingen.</p>`}</div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  wireQuestionEditor(q, q.quiz_id);
  renderTestPreview(q);
  // "Opslaan & bekijken" — trigger de bestaande save-knop en spring dan naar de speelweergave
  document.getElementById("saveAndPreview").onclick=async()=>{
    const saveBtn=document.querySelector(`[data-saveq="${q.id}"]`);
    if(!saveBtn) return;
    // Reset de toast-fout-vlag door de save uit te voeren; we luisteren naar de bestaande onclick
    saveBtn.click();
    // De bestaande save is async — geef de UI even tijd om een toast op te bouwen en dan navigeren.
    setTimeout(()=>PLAY_goto(q.quiz_id, q.id), 600);
  };
  // Beheerder start reactie/commentaar direct vanuit de editor
  let beheerFtype = "commentaar";
  const beheerReactBtns = document.getElementById("beheerReactBtns");
  const beheerPrefBox   = document.getElementById("beheerReactPref");
  const beheerPrefLabel = document.getElementById("beheerRPrefLabel");
  const beheerMotLabel  = document.getElementById("beheerRMotLabel");
  const beheerMotTA     = document.getElementById("beheerRMot");
  const syncBeheerReactUI=()=>{
    const needsPref = (beheerFtype==="twijfel"||beheerFtype==="fout"||beheerFtype==="docent") && q.question_type==="mcq" && (q.options||[]).length;
    if(beheerPrefBox) beheerPrefBox.hidden = !needsPref;
    if(beheerPrefLabel) beheerPrefLabel.textContent = beheerFtype==="docent" ? "Welk antwoord duidde de docent aan?" : "Welk antwoord vind jij dan juist?";
    if(beheerMotLabel){
      beheerMotLabel.textContent = beheerFtype==="commentaar" ? "Commentaar"
        : beheerFtype==="juist" ? "Waarom is dit antwoord juist? (optioneel)"
        : beheerFtype==="docent" ? "Wat zei de docent (optioneel)"
        : "Leg uit waarom";
    }
    if(beheerMotTA){
      beheerMotTA.placeholder = beheerFtype==="docent"
        ? "bv. 'Docent Peeters zei tijdens de les van 3/3 dat B correcter is'"
        : (beheerFtype==="commentaar" ? "Typ je reactie…" : "Leg uit waarom…");
    }
  };
  if(beheerReactBtns) beheerReactBtns.querySelectorAll("[data-ftype]").forEach(btn=>btn.onclick=()=>{
    beheerFtype = btn.dataset.ftype;
    beheerReactBtns.querySelectorAll("[data-ftype]").forEach(x=>x.classList.toggle("active", x===btn));
    syncBeheerReactUI();
  });
  syncBeheerReactUI();
  const beheerRSubmit = document.getElementById("beheerRSubmit");
  if(beheerRSubmit) beheerRSubmit.onclick=async()=>{
    const mot = (beheerMotTA && beheerMotTA.value || "").trim();
    const pref = [...document.querySelectorAll(".beheer-opref:checked")].map(c=>+c.value).sort((a,b)=>a-b);
    const needsPref = (beheerFtype==="twijfel"||beheerFtype==="fout"||beheerFtype==="docent") && q.question_type==="mcq" && (q.options||[]).length;
    if(beheerFtype==="docent" && needsPref && !pref.length) return toast("Duid aan welk antwoord de docent koos","err");
    if((beheerFtype==="twijfel"||beheerFtype==="fout"||beheerFtype==="commentaar") && !mot) return toast("Typ eerst een korte toelichting","err");
    beheerRSubmit.disabled=true;
    const { error } = await sb.from("flags").insert({ question_id:qid, user_id:ME.id, type:beheerFtype, toelichting:mot, preferred_indexes:pref });
    if(error){ beheerRSubmit.disabled=false; return toast(error.message,"err"); }
    toast("Reactie geplaatst","ok"); viewEditQuestion(qid);
  };
  app.querySelectorAll("[data-resolve]").forEach(b=>b.onclick=async()=>{
    const { error }=await sb.from("flags").update({status:"afgehandeld"}).eq("id",b.dataset.resolve);
    if(error) return toast(error.message,"err"); toast("Afgehandeld","ok"); viewEditQuestion(qid); });
  app.querySelectorAll("[data-delflag]").forEach(b=>b.onclick=async()=>{
    if(!confirm("Deze reactie verwijderen?")) return;
    const { error }=await sb.from("flags").delete().eq("id",b.dataset.delflag);
    if(error) return toast(error.message,"err"); toast("Verwijderd","ok"); viewEditQuestion(qid); });
}

/* ============================================================
   IMPORT via Markdown
   ============================================================ */
function parseQuizMarkdown(text){
  text=text.replace(/<!--[\s\S]*?-->/g,"");           // commentaar weg
  const lines=text.split(/\r?\n/);
  let title="", desc=""; const questions=[]; const errors=[];
  let cur=null, field=null;
  // Matrix-tabel wordt regel per regel opgebouwd: onthou headerrij + rijenbuffer
  let matrixHeaderSeen=false;
  const splitPipeRow=raw=>{
    // "| a | b |" → ["a","b"]  (haal buitenste pipes weg, split op |)
    let s=raw.trim();
    if(s.startsWith("|")) s=s.slice(1);
    if(s.endsWith("|")) s=s.slice(0,-1);
    return s.split("|").map(c=>c.trim());
  };
  const isSeparatorRow=cells=>cells.every(c=>/^:?-{2,}:?$/.test(c) || c===""|| /^-+$/.test(c));
  const push=()=>{ if(cur){ questions.push(cur); cur=null; } matrixHeaderSeen=false; };
  for(let raw of lines){
    const line=raw.trim();
    if(/^#\s*Titel:/i.test(line)){ title=line.replace(/^#\s*Titel:/i,"").trim(); continue; }
    if(/^#\s+/.test(line)&&!title){ title=line.replace(/^#+\s*/,"").trim(); continue; }
    if(/^Beschrijving:/i.test(line)){ desc=line.replace(/^Beschrijving:/i,"").trim(); continue; }
    if(/^##\s*/.test(line)){
      push();
      cur={
        text:"", question_type:"mcq", image_url:"",
        options:[], correct_indexes:[], docent_indexes:[], docent_note:"",
        matrix_rows:[], matrix_cols:[], matrix_correct:[],
        open_answer:"",
        legal_basis:"", wettekst:"", explanation:"", source:"mens", validated:true
      };
      field="text"; continue;
    }
    if(!cur) continue;
    let m;
    // Type-schakelaar: **Type:** matrix | open | mcq (default mcq)
    if((m=line.match(/^\*\*Type:\*\*\s*(\w+)/i))){
      const t=m[1].toLowerCase();
      if(t==="matrix" || t==="open" || t==="mcq") cur.question_type=t;
      field=null; continue;
    }
    // Modelantwoord voor open vragen
    if(/^\*\*Modelantwoord:\*\*/i.test(line)){
      cur.open_answer=line.replace(/^\*\*Modelantwoord:\*\*/i,"").trim();
      field="modelantwoord"; continue;
    }
    // Matrix-tabel: elke regel begint met "|"
    if(cur.question_type==="matrix" && line.startsWith("|")){
      const cells=splitPipeRow(line);
      if(isSeparatorRow(cells)) continue;  // markdown-tabelscheider negeren
      if(!matrixHeaderSeen){
        // eerste rij = kolomlabels (eerste cel mag leeg zijn = hoek)
        cur.matrix_cols=cells.slice(1);
        matrixHeaderSeen=true;
        field="matrix";
        continue;
      }
      // Datarij: eerste cel = rijlabel, andere cellen bevatten evt. "x"/"X" voor juist
      const rowLabel=cells[0];
      const marks=cells.slice(1);
      const correctIdx=marks.findIndex(c=>/^[xX✓✔]$/.test(c.trim()));
      cur.matrix_rows.push(rowLabel);
      cur.matrix_correct.push(correctIdx>=0 ? correctIdx : -1);
      field="matrix"; continue;
    }
    // Optie (MCQ): - [x] [d] tekst — enkel voor mcq
    if(cur.question_type==="mcq" && (m=line.match(/^-\s*\[( |x|X)\]\s*(?:\[( |d|D)\]\s*)?(.+)$/))){
      const idx=cur.options.length;
      if(m[1].toLowerCase()==="x") cur.correct_indexes.push(idx);
      if(m[2] && m[2].toLowerCase()==="d") cur.docent_indexes.push(idx);
      cur.options.push(m[3].trim()); field="opt"; continue;
    }
    if(/^\*\*Wettelijke basis:\*\*/i.test(line)){ cur.legal_basis=line.replace(/^\*\*Wettelijke basis:\*\*/i,"").trim(); field="legal"; continue; }
    if(/^\*\*Wettekst:\*\*/i.test(line)){ cur.wettekst=line.replace(/^\*\*Wettekst:\*\*/i,"").trim(); field="wettekst"; continue; }
    if(/^\*\*Uitleg:\*\*/i.test(line)){ cur.explanation=line.replace(/^\*\*Uitleg:\*\*/i,"").trim(); field="uitleg"; continue; }
    if(/^\*\*Docent(-toelichting)?:\*\*/i.test(line)){ cur.docent_note=line.replace(/^\*\*Docent(-toelichting)?:\*\*/i,"").trim(); field="docent"; continue; }
    if(/^\*\*Afbeelding:\*\*/i.test(line)){ cur.image_url=line.replace(/^\*\*Afbeelding:\*\*/i,"").trim(); field=null; continue; }
    if(/^\*\*Bron:\*\*/i.test(line)){ cur.source=/\b(ai|robot)\b/i.test(line)?"ai":"mens"; field=null; continue; }
    if(/^\*\*Gevalideerd:\*\*/i.test(line)){ cur.validated=!/nee|neen|geen|no|uit|false/i.test(line); field=null; continue; }
    if(line===""){
      // lege regel = paragraafgrens in multi-line velden
      if(field==="legal") cur.legal_basis+="\n\n";
      else if(field==="wettekst") cur.wettekst+="\n\n";
      else if(field==="uitleg") cur.explanation+="\n\n";
      else if(field==="modelantwoord") cur.open_answer+="\n\n";
      continue;
    }
    // vervolgtekst bij het lopende veld
    if(field==="text") cur.text=(cur.text?cur.text+" ":"")+line;
    else if(field==="legal") cur.legal_basis+=(cur.legal_basis.endsWith("\n\n")?"":" ")+line;
    else if(field==="wettekst") cur.wettekst+=(cur.wettekst.endsWith("\n\n")?"":" ")+line;
    else if(field==="uitleg") cur.explanation+=(cur.explanation.endsWith("\n\n")?"":" ")+line;
    else if(field==="modelantwoord") cur.open_answer+=(cur.open_answer.endsWith("\n\n")?"":" ")+line;
  }
  push();
  questions.forEach((q,i)=>{
    if(!q.text) errors.push(`Vraag ${i+1}: geen vraagtekst.`);
    if(q.question_type==="matrix"){
      if(!q.matrix_rows.length || !q.matrix_cols.length){
        errors.push(`Vraag ${i+1} (matrix): geen rijen/kolommen gevonden — voeg een tabel toe.`);
      }
      // matrix zonder aangeduid juist antwoord (alle -1) ⇒ niet-gevalideerd
      if(q.matrix_correct.every(c=>c===-1)) q.validated=false;
      q.multi=false;
    } else if(q.question_type==="open"){
      // Open vragen worden manueel/naderhand beoordeeld — geen "juist" tenzij modelantwoord
      if(!q.open_answer.trim()) q.validated=false;
      q.multi=false;
    } else {
      if(q.options.length<2) errors.push(`Vraag ${i+1}: minder dan 2 opties.`);
      if(!q.correct_indexes.length) q.validated=false;   // geen [x] ⇒ niet gevalideerd
      // Bij afwijkend docent-antwoord blijft de vraag "niet gevalideerd" tot een beheerder ze bevestigt.
      if(q.docent_indexes && q.docent_indexes.length && !setEq(q.docent_indexes, q.correct_indexes)) q.validated=false;
      q.multi=q.correct_indexes.length>1;
    }
  });
  if(!title) errors.push("Geen titel gevonden (# Titel: ...).");
  if(!questions.length) errors.push("Geen vragen gevonden (## Vraag ...).");
  return { title, desc, questions, errors };
}

async function viewImport(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:existingQuizzes } = await sb.from("quizzes").select("id,title,status").order("created_at",{ascending:false});
  const quizOptions=(existingQuizzes||[]).map(q=>`<option value="${q.id}">${esc(q.title)} — ${q.status}</option>`).join("");
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <h1>Quiz importeren</h1>
    <p class="muted">Plak een ingevuld Markdown-sjabloon of kies een <code>.md</code>-bestand. <a href="quiz-sjabloon.md" download>Leeg sjabloon downloaden</a>.</p>
    <div class="card">
      <label style="display:block;margin-bottom:.4rem"><strong>Bestemming</strong></label>
      <label style="display:flex;align-items:center;gap:.5rem"><input type="radio" name="importDest" value="new" checked style="width:auto"> Nieuwe quiz aanmaken (titel/beschrijving uit bestand)</label>
      <label style="display:flex;align-items:center;gap:.5rem;margin-top:.3rem"><input type="radio" name="importDest" value="existing" style="width:auto" ${quizOptions?"":"disabled"}> Vragen toevoegen aan bestaande quiz</label>
      <select id="targetQuiz" style="margin-top:.4rem;display:none">${quizOptions||`<option>(geen quizzen gevonden)</option>`}</select>
      <hr style="margin:.8rem 0;border:none;border-top:1px solid var(--border,#ddd)">
      <input type="file" id="mdFile" accept=".md,text/markdown,text/plain" style="margin-bottom:.6rem">
      <textarea id="mdText" style="min-height:220px" placeholder="…of plak hier de inhoud van je sjabloon"></textarea>
      <label style="display:flex;align-items:center;gap:.5rem;margin-top:.6rem"><input type="checkbox" id="aiAll" style="width:auto"> Deze hele import is door AI gegenereerd (herkomst = AI, tenzij een vraag zelf <code>**Bron:** mens</code> vermeldt)</label>
      <div class="btnrow"><button class="btn btn-ghost btn-sm" id="previewBtn">Voorbeeld</button>
        <button class="btn btn-primary btn-sm" id="importBtn">Importeren als concept</button></div>
    </div>
    <div id="importStatus" class="muted" style="margin-top:.6rem"></div>
    <div id="importPreview"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const status=m=>{ document.getElementById("importStatus").textContent=m||""; };
  const getDest=()=>document.querySelector('input[name="importDest"]:checked').value;
  const importBtn=document.getElementById("importBtn");
  const syncDest=()=>{
    const dest=getDest();
    document.getElementById("targetQuiz").style.display=dest==="existing"?"block":"none";
    importBtn.textContent=dest==="existing"?"Vragen toevoegen":"Importeren als concept";
    showPreview();
  };
  document.querySelectorAll('input[name="importDest"]').forEach(r=>r.onchange=syncDest);
  document.getElementById("mdFile").onchange=async e=>{
    const f=e.target.files[0]; if(f){ document.getElementById("mdText").value=await f.text(); showPreview(); }
  };
  const showPreview=()=>{
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    const dest=getDest();
    const box=document.getElementById("importPreview");
    const relevantErrors=dest==="existing"
      ? parsed.errors.filter(e=>!/Geen titel gevonden/i.test(e))
      : parsed.errors;
    const targetTitle=dest==="existing"
      ? (document.getElementById("targetQuiz").selectedOptions[0]?.textContent||"(geen)")
      : (parsed.title||"(geen titel)");
    box.innerHTML=`<div class="card">
      ${relevantErrors.length?`<div style="color:var(--wrong)"><strong>Aandachtspunten:</strong><ul>${relevantErrors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></div>`:`<p style="color:var(--correct)">${ICON.check} Geen fouten gevonden.</p>`}
      <p><strong>${dest==="existing"?"Doelquiz":"Nieuwe quiz"}:</strong> ${esc(targetTitle)} — ${parsed.questions.length} vragen ${dest==="existing"?"<span class=\"muted\">(titel/beschrijving uit bestand worden genegeerd)</span>":""}</p>
      ${parsed.questions.filter(q=>!q.validated).length?`<p class="muted">${parsed.questions.filter(q=>!q.validated).length} vraag/vragen zonder aangeduid juist antwoord → komen binnen als <strong>niet gevalideerd</strong>.</p>`:""}
      <ol>${parsed.questions.slice(0,8).map(q=>{
        const t=q.question_type||"mcq";
        let bad="";
        if(t==="matrix") bad=`matrix ${q.matrix_rows.length}×${q.matrix_cols.length}`;
        else if(t==="open") bad=`open${q.open_answer?" · modelantwoord":""}`;
        else bad=`juist: ${q.validated?lettersOf(q.correct_indexes):"in overleg"}${q.multi?" · meerkeuze":""}`;
        return `<li>${esc(q.text).slice(0,80)}… <span class="muted">(${bad})</span></li>`;
      }).join("")}</ol>
      ${parsed.questions.length>8?`<p class="muted">…en ${parsed.questions.length-8} meer.</p>`:""}
    </div>`;
    return parsed;
  };
  document.getElementById("previewBtn").onclick=showPreview;
  document.getElementById("targetQuiz").onchange=showPreview;
  importBtn.onclick=async()=>{
    const btn=importBtn;
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    showPreview();
    const dest=getDest();
    if(!parsed.questions.length){ toast("Geen vragen gevonden in het bestand.","err"); return; }
    if(dest==="new" && !parsed.title){ toast("Geen titel gevonden — controleer het bestand.","err"); return; }
    const blockingErrors = dest==="existing"
      ? parsed.errors.filter(e=>!/Geen titel gevonden/i.test(e))
      : parsed.errors;
    if(blockingErrors.length){ toast("Los eerst de aandachtspunten op.","err"); return; }
    btn.disabled=true;
    try{
      const aiAll=document.getElementById("aiAll").checked;
      let quizId, quizForNav, startOrder=0;
      if(dest==="existing"){
        quizId=document.getElementById("targetQuiz").value;
        if(!quizId) throw new Error("Kies een doelquiz.");
        status("Bestaande vragen tellen…");
        const { data:last }=await sb.from("questions").select("sort_order").eq("quiz_id",quizId).order("sort_order",{ascending:false}).limit(1);
        startOrder=(last&&last[0]?last[0].sort_order:0);
        quizForNav=quizId;
      } else {
        status("Quiz aanmaken…");
        const { data:quiz, error }=await sb.from("quizzes").insert({ title:parsed.title, description:parsed.desc, status:"concept", created_by:ME.id }).select().single();
        if(error) throw error;
        quizId=quiz.id; quizForNav=quiz.id;
      }
      const rows=parsed.questions.map((q,i)=>{
        const src = q.source==="ai" ? "ai" : (aiAll ? "ai" : "mens");
        const doc = (q.docent_indexes && q.docent_indexes.length) ? q.docent_indexes : null;
        const base={ quiz_id:quizId, sort_order:startOrder+i+1, text:q.text,
          question_type:q.question_type||"mcq",
          image_url:q.image_url||null,
          multi:!!q.multi, validated:q.validated!==false,
          legal_basis:q.legal_basis, wettekst:q.wettekst, explanation:q.explanation,
          answer_source:src, explanation_source:src, legal_basis_source: q.legal_basis ? src : null };
        if(q.question_type==="matrix"){
          return Object.assign(base, {
            options:[], correct_indexes:[],
            matrix_rows:q.matrix_rows, matrix_cols:q.matrix_cols, matrix_correct:q.matrix_correct,
            docent_indexes:null, docent_note:null,
          });
        }
        if(q.question_type==="open"){
          return Object.assign(base, {
            options:[], correct_indexes:[],
            open_answer:q.open_answer || null,
            docent_indexes:null, docent_note:null,
          });
        }
        return Object.assign(base, {
          options:q.options, correct_indexes:q.correct_indexes,
          docent_indexes:doc, docent_note: doc ? (q.docent_note||null) : null,
        });
      });
      const CHUNK=40;
      for(let i=0;i<rows.length;i+=CHUNK){
        status(`Vragen wegschrijven… ${Math.min(i+CHUNK,rows.length)}/${rows.length}`);
        const { error:e2 }=await sb.from("questions").insert(rows.slice(i,i+CHUNK));
        if(e2) throw e2;
      }
      status("");
      toast(dest==="existing"
        ? `Toegevoegd: ${rows.length} vragen aan bestaande quiz`
        : `Geïmporteerd: ${rows.length} vragen (concept)`,"ok");
      go("#/beheer/quiz/"+quizForNav);
    }catch(err){
      status("");
      toast("Import mislukt: "+(err.message||err),"err");
      btn.disabled=false;
    }
  };
}

/* ============================================================
   BOOT
   ============================================================ */
function renderLastUpdate(){
  const el=document.getElementById("lastUpdate"); if(!el) return;
  const d=new Date(document.lastModified);
  if(isNaN(d)) return;
  el.textContent="laatste update "+d.toLocaleDateString("nl-BE",{day:"2-digit",month:"short",year:"numeric"})+" "+d.toLocaleTimeString("nl-BE",{hour:"2-digit",minute:"2-digit"});
}
let visitLogged=false;
function shouldLogVisit(){
  try{
    const key="quiztet_last_visit_"+(ME&&ME.id||"");
    // Lokale datum in plaats van UTC — vermijdt dat een refresh na middernacht
    // in België (UTC+1/+2) een tweede visit registreert terwijl het pas de volgende dag is voor jou.
    const d=new Date();
    const today=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
    if(localStorage.getItem(key)===today) return false;
    localStorage.setItem(key, today);
    return true;
  }catch(e){ return true; }
}
async function boot(){
  renderLastUpdate();
  if(!sb){ document.getElementById("appHeader").hidden=true; route(); return; }
  await loadProfile();
  if(ME && !visitLogged && shouldLogVisit()){ visitLogged=true; sb.from("visits").insert({ user_id:ME.id }).then(()=>{},()=>{}); }
  if(ME) renderHeader();
  if(ME) loadGamesConfig();
  route();
  if(ME) refreshNotifyBadge();
}
if(sb){ sb.auth.onAuthStateChange((_e,_s)=>{ /* sessiewissels */ }); }
boot();
