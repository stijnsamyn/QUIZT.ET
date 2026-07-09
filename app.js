/* ============================================================
   QUIZT.ET — frontend (vanilla JS + Supabase)
   ============================================================ */
"use strict";

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
  if(q.multi || arr(q.correct_indexes).length>1) t.push(`<span class="tag">Meerkeuze ${infoTip("Er kunnen meerdere antwoorden juist zijn — kruis alle juiste aan.")}</span>`);
  if(arr(q.docent_indexes).length && !setEq(q.docent_indexes, q.correct_indexes)) t.push(`<span class="tag tag-doc">👨‍🏫 Docent wijkt af ${infoTip("De docent koos een ander antwoord dan het wettelijk juiste. Beide worden getoond na je antwoord.")}</span>`);
  return t.join(" ");
}
function isRight(q, chosen){ return q.validated===false ? null : setEq(chosen, q.correct_indexes); }
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
  s = s.replace(/\{([A-Za-z])\}/g, (m, ch)=>{
    const upper=ch.toUpperCase();
    const origIdx=upper.charCodeAt(0)-65;
    if(origIdx<0||origIdx>25) return m;
    const l=letterForOrig(qid, origIdx);
    // beheerder mag ook kleine {a} typen → we respecteren de casing
    return ch===upper ? l : l.toLowerCase();
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

async function route(){
  if(!sb){ app.innerHTML=`<div class="card"><h1>Nog niet geconfigureerd</h1><p class="muted">Vul je Supabase-gegevens in <code>config.js</code> in. Zie SETUP.md.</p></div>`; return; }
  if(!ME){ document.getElementById("appHeader").hidden=true; return viewLogin(); }
  renderHeader();
  const h=(location.hash||"#/").slice(1);
  const p=h.split("/").filter(Boolean);   // ["quiz","<id>","overzicht"]
  app.innerHTML=`<div class="loading">Laden…</div>`;
  try{
    if(p.length===0) return viewHome();
    if(p[0]==="quiz" && p[2]==="overzicht") return viewOverview(p[1]);
    if(p[0]==="quiz" && p[2]==="stats") return viewQuizStats(p[1]);
    if(p[0]==="quiz") return viewPlay(p[1]);
    if(p[0]==="stats" && p[1]==="vragen") return viewStatsVragen();
    if(p[0]==="stats" && p[1]==="gebruikers") return viewStatsGebruikers();
    if(p[0]==="tetris") return viewTetris();
    if(p[0]==="meldingen") return viewMeldingen();
    if(p[0]==="account") return viewAccount();
    if(p[0]==="beheer" && p[1]==="vraag") return viewEditQuestion(p[2]);
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
  const { data:quizzes, error } = await sb.from("quizzes").select("*").order("created_at");
  if(error) throw error;
  // aantal vragen per quiz + mijn voortgang
  const { data:qs } = await sb.from("questions").select("id,quiz_id");
  const counts={}, q2quiz={}; (qs||[]).forEach(q=>{ counts[q.quiz_id]=(counts[q.quiz_id]||0)+1; q2quiz[q.id]=q.quiz_id; });
  const myAns={};
  const qids=(qs||[]).map(q=>q.id);
  if(qids.length){ const {data:mine}=await sb.from("answers").select("question_id").eq("user_id",ME.id).in("question_id",qids);
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
  app.innerHTML=`
    <div class="spread"><h1>Quizzen</h1>${isEditor()?`<button class="btn btn-primary btn-sm" data-nav="#/beheer">Beheer</button>`:""}</div>
    <div class="dev-note">${ICON.info} QUIZT.ET wordt nog volop ontwikkeld — vernieuw af en toe eens de pagina om de laatste functies te hebben. <button class="btn btn-ghost btn-sm" id="hardRefresh" style="margin-left:.5rem">Nu vernieuwen</button></div>
    ${quizzes&&quizzes.length?`<div class="grid" style="margin-top:1rem">${cards}</div>`:`<div class="empty">Nog geen quizzen.</div>`}
    <div id="tetrisTop"></div>`;
  app.querySelectorAll("[data-open]").forEach(c=>c.onclick=()=>go("#/quiz/"+c.dataset.open));
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const hr=document.getElementById("hardRefresh");
  if(hr) hr.onclick=()=>{ const base=location.href.split("?")[0].split("#")[0]; location.href=base+"?_="+Date.now()+location.hash; };
  renderTetrisTop3();
}

async function bestPerUser(limit){
  const { data:rows }=await sb.from("tetris_scores").select("user_id,score,lines,level,created_at").order("score",{ascending:false}).limit(200);
  const seen=new Set(); const best=[]; (rows||[]).forEach(r=>{ if(seen.has(r.user_id)) return; seen.add(r.user_id); best.push(r); });
  return best.slice(0, limit||best.length);
}
async function renderTetrisTop3(){
  const el=document.getElementById("tetrisTop"); if(!el) return;
  const top=await bestPerUser(3);
  if(!top.length){ el.innerHTML=`<div class="card tetris-top-card"><div class="tetris-top-hd">${ICON.info} <strong>Tetris top-3</strong></div><p class="muted" style="font-size:.85rem">Nog niemand op het bord. Speel Tetris na een sessie van minstens 25 vragen met ≥80% juist en zet jezelf als eerste!</p><a class="ilink" data-nav="#/tetris">Naar het volledige scorebord →</a></div>`; }
  else {
    const names=await namesFor(top.map(t=>t.user_id));
    el.innerHTML=`
      <div class="card tetris-top-card">
        <div class="tetris-top-hd">🏆 <strong>Tetris top-3</strong> <span class="muted" style="font-size:.78rem">— beste score per speler</span></div>
        <ol class="tetris-top-list">${top.map((t,i)=>`<li><span class="tetris-medal">${["🥇","🥈","🥉"][i]}</span><span class="tetris-name">${esc(names[t.user_id]||"?")}</span><span class="tetris-num">${t.score}</span></li>`).join("")}</ol>
        <div class="muted" style="font-size:.78rem">Tetris is enkel te spelen na een oefensessie van minstens 25 vragen met ≥80% juist. Op die manier verdien je je pauze.</div>
        <a class="ilink" data-nav="#/tetris" style="font-size:.85rem">Naar het volledige scorebord →</a>
      </div>`;
  }
  el.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
}

async function viewTetris(){
  app.innerHTML=`<div class="loading">Scorebord laden…</div>`;
  const top=await bestPerUser(50);
  const myRank = top.findIndex(t=>t.user_id===ME.id);
  const names=await namesFor(top.map(t=>t.user_id));
  app.innerHTML=`
    <a class="muted" data-nav="#/">← Quizzen</a>
    <h1 style="margin:.5rem 0">🧱 Tetris scorebord</h1>
    <div class="card" style="margin-top:.8rem">
      <div class="setup-hd">${ICON.info} Spelregels</div>
      <ul class="tetris-rules">
        <li>Tetris ontgrendel je na een oefensessie van <strong>minstens 25 vragen</strong>.</li>
        <li>In die sessie moet je <strong>minstens 80% juist</strong> hebben. Niet gehaald? Dan geen pauze.</li>
        <li>Elke afspeelde game telt — enkel je <strong>beste score</strong> per speler staat in de ranglijst.</li>
        <li>Toetsenbord: ← → bewegen, ↑ draaien, ↓ sneller, spatie = plonsen, P = pauze.</li>
        <li>Op mobiel gebruik je de knoppen onderaan.</li>
      </ul>
    </div>
    <h2>Top ${top.length}</h2>
    ${top.length?`<div class="card" style="padding:.3rem"><table>
      <thead><tr><th>#</th><th>Naam</th><th>Score</th><th>Lijnen</th><th>Level</th><th>Datum</th></tr></thead>
      <tbody>${top.map((t,i)=>`<tr${t.user_id===ME.id?' style="background:var(--accent-soft)"':''}><td><strong>${i+1}</strong></td><td>${esc(names[t.user_id]||"?")}${t.user_id===ME.id?' <span class="muted" style="font-size:.72rem">(jij)</span>':''}</td><td><strong>${t.score}</strong></td><td>${t.lines}</td><td>${t.level}</td><td class="muted" style="font-size:.75rem">${fmtDate(t.created_at)}</td></tr>`).join("")}</tbody>
    </table></div>`:`<p class="muted">Nog geen scores. Speel een rondje na een geslaagde oefensessie en zet jezelf als eerste op het bord!</p>`}
    ${myRank>=0?`<p class="muted" style="margin-top:.6rem;font-size:.85rem">Jouw beste score: rang ${myRank+1} met ${top[myRank].score} punten.</p>`:top.length?`<p class="muted" style="margin-top:.6rem;font-size:.85rem">Je staat nog niet op het bord.</p>`:""}`;
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
  if(mode==="nummer"||mode==="volgorde") return all.slice().sort(byNum);
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
    NOTIFY_COUNT = items.length;
    const el = document.getElementById("notifyBadge");
    if(el){ el.textContent = NOTIFY_COUNT; el.hidden = NOTIFY_COUNT===0; }
  }catch(e){}
}
async function viewPlay(quizId){
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  if(!quiz){ app.innerHTML=`<div class="empty">Quiz niet gevonden.</div>`; return; }
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  PLAY.quiz=quiz; PLAY.all=questions||[]; PLAY.i=0; PLAY.answers={}; PLAY.history={}; PLAY.everWrong=new Set();
  PLAY.savedSession = await loadSession(quizId);
  const ids=PLAY.all.map(q=>q.id);
  if(ids.length){
    const [{data:mine},{data:wrongEvents}]=await Promise.all([
      sb.from("answers").select("*").eq("user_id",ME.id).in("question_id",ids),
      sb.from("answer_events").select("question_id").eq("user_id",ME.id).eq("quiz_id",quizId).eq("is_correct",false),
    ]);
    (mine||[]).forEach(a=>{ PLAY.answers[a.question_id]=a.chosen_indexes||[]; PLAY.history[a.question_id]=a.chosen_indexes||[]; });
    (wrongEvents||[]).forEach(e=>PLAY.everWrong.add(e.question_id));
  }
  // open flags voor deze quiz (voor iedereen zichtbaar op het startscherm)
  PLAY.openFlags=[]; PLAY.flagNames={};
  if(ids.length){ const {data:of}=await sb.from("flags").select("id,question_id,type,toelichting,created_at,user_id").eq("status","open").neq("type","juist").in("question_id",ids).order("type").order("created_at",{ascending:false});
    PLAY.openFlags=of||[]; PLAY.flagNames=await namesFor(PLAY.openFlags.map(f=>f.user_id)); }
  if(PLAY.pendingJump){
    const jid=PLAY.pendingJump; PLAY.pendingJump=null;
    PLAY.session={size:"alle",focus:"alle",order:"nummer"}; PLAY.mode="nummer";
    PLAY.questions=orderQuestions(PLAY.all, PLAY.answers, "nummer");
    const idx=PLAY.questions.findIndex(x=>x.id===jid);
    PLAY.i=idx>=0?idx:0; renderQuestion();
  } else renderPlaySetup();
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
  ];
  const chips=(grp,list,cur)=>list.map(([v,l,tip])=>`<button class="chip-toggle ${v===cur?"active":""}" data-${grp}="${v}" title="${esc(tip||"")}">${l}${tip?` <span class="infotip chip-i" tabindex="0" data-tip="${esc(tip)}" onclick="event.stopPropagation();">${ICON.info}</span>`:""}</button>`).join("");
  const focusLabel=f=>({alle:"alle vragen",foute:"je huidig foute vragen",onbeantwoord:"nog niet beantwoorde vragen",nietjuist:"nog niet juiste vragen",ooitFout:"historisch foute vragen"})[f];
  const orderLabel=o=>({slim:"slim geoefend",nummer:"op vraagnummer",willekeurig:"willekeurig",foutEerst:"fouten eerst",gemistEerst:"gemiste eerst"})[o];
  const summaryStr=()=>{
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
      Meer over deze quiz: <a class="ilink" data-nav="#/quiz/${PLAY.quiz.id}/overzicht">Overzicht van alle vragen</a> · <a class="ilink" data-nav="#/quiz/${PLAY.quiz.id}/stats">Statistiek van deze quiz</a>
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
  const paintSummary=()=>{ const el=document.getElementById("setupSummary"); if(el) el.innerHTML=summaryStr(); };
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
  PLAY.session={ size, focus, order }; PLAY.mode=order;
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
  // volgorde van de opties eenmalig door elkaar schudden per sessie
  PLAY.optOrder=PLAY.optOrder||{};
  if(!PLAY.optOrder[q.id]) PLAY.optOrder[q.id]=shuffle((q.options||[]).map((_,i)=>i));
  const order=PLAY.optOrder[q.id];
  const docent=arr(q.docent_indexes);
  const docentDiffers=docent.length>0 && !setEq(docent, correct);
  const opts=order.map((origIdx,pos)=>{
    const o=(q.options||[])[origIdx];
    let cls="opt"; let box="";
    if(answered){ cls+=" disabled";
      if(validated){ if(correct.includes(origIdx)) cls+=" correct"; else if(inSet(chosen,origIdx)) cls+=" wrong"; }
      else if(inSet(chosen,origIdx)) cls+=" chosen";
      if(docentDiffers && docent.includes(origIdx)) cls+=" docent";
    }
    else if(multi){ box=`<input type="checkbox" class="mopt" value="${origIdx}" style="width:auto;margin-top:.15rem">`; }
    const docentBadge = answered && docentDiffers && docent.includes(origIdx) ? `<span class="opt-doc" title="Volgens de docent">👨‍🏫</span>` : "";
    return `<div class="${cls}" data-opt="${origIdx}">${box}<span class="letter">${letter(pos)}</span><span>${esc(o)} ${answered&&validated&&correct.includes(origIdx)?srcBadge("Juist antwoord",q.answer_source):""}${docentBadge}</span></div>`;
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
    <div class="progress">
      <div class="muted" style="font-size:.75rem;margin-bottom:.15rem">Voortgang in deze sessie</div>
      <div class="bar"><span style="width:${pct(answeredN,total)}%"></span><div class="lab">Beantwoord ${answeredN}/${total}</div></div>
      <div class="progress-legend">
        <span class="dot ok"></span> Juist: ${correctN}
        <span class="dot bad"></span> Fout: ${wrongN}
        ${overlegN?`<span class="dot warn"></span> In overleg: ${overlegN}`:""}
        <span class="dot none"></span> Nog te doen: ${unanswered}
        ${allDone?`<span class="pill" style="background:var(--correct-soft);color:var(--correct)">${ICON.check} Sessie voltooid</span>`:""}
        <span style="margin-left:auto"></span>
        <span class="muted">Volgorde:</span>
        <button class="chip-toggle ${PLAY.mode==="slim"?"active":""}" data-mode="slim" title="Nooit-beantwoorde vragen krijgen voorrang, dan fout beantwoorde">Slim oefenen</button>
        <button class="chip-toggle ${PLAY.mode==="nummer"?"active":""}" data-mode="nummer">Op nummer</button>
      </div>
    </div>
    <div class="btnrow" style="margin-bottom:.8rem">
      <button class="btn btn-ghost btn-sm" id="prevBtn" ${PLAY.i===0?"disabled":""}>← Vorige</button>
      <button class="btn btn-ghost btn-sm" id="nextBtn" ${PLAY.i>=total-1?"disabled":""}>Volgende →</button>
      ${unanswered?`<button class="btn btn-primary btn-sm" id="nextUnans">Volgende in deze sessie →</button>`:`<button class="btn btn-primary btn-sm" id="doneBtn">Bekijk resultaat →</button>`}
      ${isEditor()?`<button class="btn btn-ghost btn-sm" id="editQ" style="margin-left:auto">Bewerk deze vraag</button>`:""}
    </div>
    <div class="card">
      <div class="q-meta"><span class="q-num">Vraag ${q.qnum}</span>${questionTags(q)}${answered?(isRight(q,chosen)===true?`<span class="pill juist">juist beantwoord</span>`:isRight(q,chosen)===false?`<span class="pill fout">fout beantwoord</span>`:`<span class="pill twijfel">antwoord genoteerd — in overleg</span>`):((PLAY.history&&PLAY.history[q.id]!=null)?(isRight(q,PLAY.history[q.id])===true?`<span class="pill" style="background:var(--correct-soft);color:var(--correct);opacity:.75">eerder juist</span>`:isRight(q,PLAY.history[q.id])===false?`<span class="pill" style="background:var(--wrong-soft);color:var(--wrong);opacity:.75">eerder fout</span>`:`<span class="pill" style="background:var(--warn-soft);color:var(--warn);opacity:.75">eerder beantwoord</span>`):`<span class="pill" style="background:var(--surface2);color:var(--text-muted)">nieuwe vraag voor jou</span>`)}</div>
      <div class="q-text">${esc(q.text)}</div>
      ${(!answered && (q.wettekst || q.legal_basis)) ? `<details class="prehelp"><summary>${ICON.info} Raadpleeg wettekst voor je antwoordt</summary>
        <div class="prehelp-body">
          ${q.legal_basis?`<div class="prehelp-legal"><strong>Wettelijke basis:</strong> ${html(translateOptRefs(q.legal_basis, q.id, q))}</div>`:""}
          ${q.wettekst?`<div class="wettekst">${html(translateOptRefs(q.wettekst, q.id, q))}</div>`:""}
        </div></details>`:""}
      <div id="opts">${opts}</div>
      ${(multi&&!answered)?`<div class="btnrow"><button class="btn btn-primary btn-sm" id="checkMulti">Nakijken</button></div>`:""}
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
  if(nsBtn) nsBtn.onclick=()=>renderPlaySetup();
  const eqBtn=document.getElementById("editQ");
  if(eqBtn) eqBtn.onclick=()=>go("#/beheer/vraag/"+q.id);
  const dBtn=document.getElementById("doneBtn");
  if(dBtn) dBtn.onclick=()=>renderPlayDone();
  app.querySelectorAll("[data-mode]").forEach(b=>b.onclick=()=>{
    if(PLAY.mode===b.dataset.mode) return;
    PLAY.mode=b.dataset.mode;
    const curId=PLAY.questions[PLAY.i].id;
    PLAY.questions=orderQuestions(PLAY.questions, PLAY.answers, PLAY.mode);
    PLAY.i=Math.max(0, PLAY.questions.findIndex(x=>x.id===curId));
    renderQuestion();
  });
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

async function answerQuestion(q, idxArray){
  if(PLAY.answering) return;
  PLAY.answering=true;
  app.querySelectorAll("[data-opt],#checkMulti").forEach(el=>el.style.pointerEvents="none");
  const chosen=arr(idxArray).slice().sort((a,b)=>a-b);
  const is_correct = isRight(q, chosen);   // null bij niet-gevalideerde vraag
  try{
    const { error:e1 } = await sb.from("answers").upsert({ question_id:q.id, user_id:ME.id, chosen_indexes:chosen, is_correct, updated_at:new Date().toISOString() },{ onConflict:"question_id,user_id" });
    if(e1) throw e1;
    await sb.from("answer_events").insert({ question_id:q.id, quiz_id:PLAY.quiz.id, user_id:ME.id, is_correct });
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
      ${(()=>{ const eligible=qs.length>=25 && scored>0 && p>=80;
        return `<div class="brain-break">
          <div class="muted" style="font-size:.82rem;margin-bottom:.4rem">${eligible?"Je hebt een pauze verdiend 🎉":"Speel Tetris na een sessie van minstens 25 vragen met ≥80% juist."}</div>
          <button class="btn btn-ghost btn-sm" id="openTetris" ${eligible?"":"disabled"} title="${eligible?"Speel een rondje Tetris":"Vergrendeld — je moet minstens 25 vragen doen én 80% juist scoren"}">🧱 Speel Tetris ${eligible?"":"🔒"}</button>
        </div>`; })()}
    </div>

    <div class="done-review">
      <div class="spread" style="margin-bottom:.5rem">
        <h2 style="margin:0;font-size:1rem">Overzicht van deze sessie</h2>
        <div class="btnrow" style="margin:0">
          <button class="btn btn-ghost btn-sm" id="rvFilterAll" data-rvf="alle">Alle (${qs.length})</button>
          <button class="btn btn-ghost btn-sm" id="rvFilterWrong" data-rvf="fout">Enkel fout (${wrong})</button>
        </div>
      </div>
      <p class="muted" style="font-size:.8rem;margin-bottom:.6rem">Klik een vraag open om de uitleg, wettelijke basis en het volledige juiste antwoord te zien.</p>
      <div class="stack" id="rvList">${renderDoneReview(qs, "alle")}</div>
    </div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  const aw=document.getElementById("againWrong"); if(aw) aw.onclick=()=>startSession("alle","foute",PLAY.mode||"slim");
  document.getElementById("againNew").onclick=()=>renderPlaySetup();
  const tb=document.getElementById("openTetris"); if(tb && !tb.disabled) tb.onclick=openTetris;
  app.querySelectorAll("[data-rvf]").forEach(b=>b.onclick=()=>{
    const f=b.dataset.rvf;
    app.querySelectorAll("[data-rvf]").forEach(x=>x.classList.toggle("active", x===b));
    document.getElementById("rvList").innerHTML=renderDoneReview(qs, f);
    wireDoneReview();
  });
  document.getElementById("rvFilterAll").classList.add("active");
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
    return `<details class="rv-item ${status}">
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
          if(validated && correct.includes(i)) cls+=" correct";
          if(answered && inSet(chosen,i) && validated && !correct.includes(i)) cls+=" wrong";
          if(docentDiffers && docent.includes(i)) cls+=" docent";
          return `<div class="${cls}"><strong>${letter(i)}.</strong> ${esc(o)}${validated&&correct.includes(i)?' <span class="pill juist" style="margin-left:.3rem">juist</span>':""}${docentDiffers&&docent.includes(i)?' <span class="pill" style="margin-left:.3rem;background:rgba(192,38,211,.12);color:#a21caf">docent</span>':""}</div>`;
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
  const board=Array.from({length:ROWS},()=>Array(COLS).fill(0));
  let piece=null, next=null, score=0, lines=0, level=1;
  let dropInterval=800, dropTimer=0, lastTime=0, paused=false, over=false;
  let hi=parseInt(localStorage.getItem(HS_KEY)||"0",10);
  const rand=()=>{ const k=NAMES[Math.floor(Math.random()*NAMES.length)]; const p=PIECES[k]; return {c:p.c, m:p.m.map(r=>r.slice()), x:Math.floor((COLS-p.m[0].length)/2), y:0}; };
  const collide=(p,dx=0,dy=0,m=p.m)=>{ for(let r=0;r<m.length;r++) for(let c=0;c<m[r].length;c++){ if(!m[r][c]) continue; const x=p.x+c+dx, y=p.y+r+dy; if(x<0||x>=COLS||y>=ROWS) return true; if(y>=0 && board[y][x]) return true; } return false; };
  const rotate=m=>{ const N=m.length, M=m[0].length; const nm=Array.from({length:M},()=>Array(N).fill(0)); for(let r=0;r<N;r++) for(let c=0;c<M;c++) nm[c][N-1-r]=m[r][c]; return nm; };
  const merge=()=>{ for(let r=0;r<piece.m.length;r++) for(let c=0;c<piece.m[r].length;c++){ if(piece.m[r][c] && piece.y+r>=0) board[piece.y+r][piece.x+c]=piece.m[r][c]; } };
  const clearLines=()=>{ let n=0; for(let r=ROWS-1;r>=0;r--){ if(board[r].every(v=>v)){ board.splice(r,1); board.unshift(Array(COLS).fill(0)); n++; r++; } } if(n){ const pts=[0,100,300,500,800][n]||0; score+=pts*level; lines+=n; level=1+Math.floor(lines/10); dropInterval=Math.max(80, 800-(level-1)*70); } };
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
  const reset=()=>{ board.forEach(r=>r.fill(0)); score=0; lines=0; level=1; dropInterval=800; dropTimer=0; over=false; paused=false; next=rand(); spawn(); };
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

function renderFlagThread(flags, names, qid){
  // Bouw thread: roots (parent_id null) chronologisch, met children eronder (chronologisch)
  const byParent={ null:[] };
  flags.forEach(f=>{ const p=f.parent_id||"null"; (byParent[p]=byParent[p]||[]).push(f); });
  const letterFn = qid ? (idxs=>lettersOfForQ(qid, idxs)) : lettersOf;
  const renderOne=(f, depth)=>{
    const isReply=!!f.parent_id;
    const kids=byParent[f.id]||[];
    return `<div class="flag-item ${f.type} ${isReply?"is-reply":""}" data-flag-id="${f.id}" style="${depth>0?`margin-left:${Math.min(depth,3)*1.2}rem;`:""}">
      <div class="flag-head">
        ${isReply?`<span class="flag-reply-arrow" title="Antwoord op reactie hierboven">↳</span>`:""}
        <span class="pill ${f.type}">${f.type}</span>
        ${f.status==="afgehandeld"?`<span class="pill afgehandeld">afgehandeld</span>`:""}
        <span class="who">${esc(names[f.user_id]||"?")}</span>
        ${arr(f.preferred_indexes).length?` <span class="muted">· verkiest <strong>${letterFn(f.preferred_indexes)}</strong></span>`:""}
        <span class="when">${fmtDate(f.created_at)}</span>
        <button class="btn btn-ghost btn-sm flag-reply-btn" data-reply-to="${f.id}" title="Reageer op deze reactie">Reageer</button>
      </div>
      ${f.toelichting?`<div class="flag-body">${esc(translateOptRefs(f.toelichting, qid))}</div>`:""}
      <div class="flag-reply-form" data-reply-form-for="${f.id}" hidden>
        <textarea class="flag-reply-text" placeholder="Reageer op ${esc(names[f.user_id]||"deze reactie")}…"></textarea>
        <div class="ref-hint">💡 <strong>Tip:</strong> gebruik <code>{A}</code>, <code>{B}</code>, <code>{C}</code> … om te verwijzen naar antwoordopties — dat wordt vertaald naar de letter die iedereen in zijn eigen shuffle ziet.</div>
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
  const docentBlock=(hasOfficialDocent || hasDocentConsensus) ? (()=>{
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
          <button class="chip-toggle" data-ftype="docent">👨‍🏫 Onze docent koos…</button>
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
          <div class="ref-hint">💡 <strong>Tip:</strong> verwijs naar een antwoordoptie met <code>{A}</code>, <code>{B}</code>, <code>{C}</code> … De app vertaalt die naar de letter die de andere spelers in hun eigen shuffle zien, zodat je opmerking bij iedereen klopt.</div>
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
    <div id="svTable"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  mountStatsTable("svTable", agg, qtitle);
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
  const [{data:flags},{data:myEvents}] = await Promise.all([
    sb.from("flags").select("*").eq("user_id",ME.id).order("created_at",{ascending:false}).range(0,9999),
    sb.from("answer_events").select("is_correct,created_at").eq("user_id",ME.id).range(0,49999),
  ]);
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

    <h2>Mijn reacties (${(flags||[]).length})</h2>
    <div class="stack">
      ${(flags||[]).map(f=>`<div class="card"><div class="spread"><div><span class="pill ${f.type}">${f.type}</span> ${arr(f.preferred_indexes).length?`<span class="muted">· verkiest <strong>${lettersOf(f.preferred_indexes)}</strong></span> `:""}${qlink(f.question_id)} <span class="when">${fmtDate(f.created_at)}</span>${f.toelichting?`<div>${esc(f.toelichting)}</div>`:""}</div><button class="btn btn-danger btn-sm" data-delflag="${f.id}">Verwijderen</button></div></div>`).join("")||`<p class="muted">Je hebt nog geen reacties geplaatst.</p>`}
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
        <li><code>{A}</code> <code>{B}</code> <code>{C}</code> … — verwijst naar de <strong>positie in de editor</strong>: <code>{A}</code> = eerste optie in het formulier, <code>{B}</code> = tweede, enz. Klik op de chip naast een optie om die automatisch in te voegen op je cursorpositie.</li>
        <li><code>{juist}</code> — verwijst <em>altijd</em> naar het juiste antwoord (welke letter dat ook geworden is na shuffle). Handig als je "antwoord {juist} is correct omdat…" wil schrijven zonder over een specifieke optie na te denken.</li>
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
        const snippet = f.toelichting ? (f.toelichting.length>140 ? esc(f.toelichting.slice(0,140))+"…" : esc(f.toelichting)) : "";
        return `<div class="notify-flag ${f.type}">
          <div class="notify-flag-head">
            <span class="fg-type">${f.type}</span>
            <span class="fg-who">${esc(names[f.user_id]||"?")}</span>
            <span class="fg-when">${fmtDate(f.created_at)} <span class="muted">(${humanAgo(new Date(f.created_at).getTime())})</span></span>
          </div>
          ${snippet?`<div class="fg-body">${snippet}</div>`:""}
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
  // Vragen ophalen voor de flags (voor labeling en groepering)
  let qmap={};
  if(flagCount){ const {data:qq}=await sb.from("questions").select("id,qnum,quiz_id,text").in("id",[...new Set((openFlags||[]).map(f=>f.question_id))]); (qq||[]).forEach(q=>qmap[q.id]=q); }
  const quizById={}; (quizzes||[]).forEach(q=>quizById[q.id]=q);
  const names=await namesFor((openFlags||[]).map(f=>f.user_id));

  const tabs=[
    { key:"quizzen", label:"Quizzen", count:(quizzes||[]).length, always:true },
    { key:"flags",   label:"Open flags", count:flagCount, always:true },
    { key:"gebruikers", label:"Gebruikers", count:USER_COUNT!=null?USER_COUNT:null, admin:true },
    { key:"instellingen", label:"Instellingen", count:null, admin:true },
  ].filter(t=>t.always || (t.admin && isAdmin()));

  app.innerHTML=`
    <div class="spread"><h1>Beheer</h1>
      <div class="btnrow" style="margin:0">
        <button class="btn btn-ghost btn-sm" id="newQuiz">+ Nieuwe quiz</button>
        <button class="btn btn-ghost btn-sm" data-nav="#/beheer/import">Quiz importeren</button>
      </div></div>
    <div class="beheer-tabs">${tabs.map(t=>`<a class="beheer-tab ${t.key===tab?"active":""}" data-nav="#/beheer${t.key==="quizzen"?"":"/"+t.key}">${t.label}${t.count!=null?` <span class="beheer-tab-count">${t.count}</span>`:""}</a>`).join("")}</div>
    <div id="beheerContent"></div>
  `;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("newQuiz").onclick=createQuiz;

  const content=document.getElementById("beheerContent");
  if(tab==="quizzen"){
    content.innerHTML=`
      <div class="stack" style="margin-top:1rem">${(quizzes||[]).map(q=>`
        <div class="card"><div class="spread">
          <div><strong>${esc(q.title)}</strong> <span class="badge ${q.status==="gepubliceerd"?"pub":"concept"}">${q.status}</span>
            <div class="muted">${esc(q.description||"")}</div></div>
          <div class="btnrow" style="margin:0">
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
      <p class="muted" style="font-size:.85rem;margin-top:.8rem">Reacties zijn per vraag gegroepeerd. Klik op de vraagtitel om naar de vraag te gaan; markeer flags per stuk of alles voor deze vraag ineens af.</p>
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
      const bodyPreview = f.toelichting ? (f.toelichting.length>140 ? esc(f.toelichting.slice(0,140))+"…" : esc(f.toelichting)) : "";
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
      const bodyPreview = f.toelichting ? (f.toelichting.length>140 ? esc(f.toelichting.slice(0,140))+"…" : esc(f.toelichting)) : "";
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
  box.innerHTML=`<label style="display:flex;align-items:center;gap:.6rem;margin:0">
    <input type="checkbox" id="regOpen" style="width:auto" ${data&&data.registration_open?"checked":""}> Registratie open (nieuwe accounts toegestaan)</label>`;
  document.getElementById("regOpen").onchange=async e=>{
    const { error }=await sb.from("app_settings").update({registration_open:e.target.checked}).eq("id",1);
    if(error) return toast(error.message,"err");
    toast("Instelling opgeslagen","ok");
  };
}

/* ============================================================
   BEHEER — quiz bewerken (vragen CRUD, herkomst-toggles)
   ============================================================ */
async function viewBeheerQuiz(quizId){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("*").eq("id",quizId).single();
  const { data:questions } = await sb.from("questions").select("*").eq("quiz_id",quizId).order("sort_order");
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <div class="card" style="margin-top:.6rem">
      <label>Titel</label><input id="qzTitle" value="${esc(quiz.title)}">
      <label>Beschrijving</label><textarea id="qzDesc">${esc(quiz.description||"")}</textarea>
      <div class="btnrow"><button class="btn btn-primary btn-sm" id="saveQuiz">Quiz opslaan</button>
        <span class="badge ${quiz.status==="gepubliceerd"?"pub":"concept"}">${quiz.status}</span></div>
    </div>
    <div class="spread"><h2>Vragen (${(questions||[]).length})</h2>
      <button class="btn btn-ghost btn-sm" id="addQ">+ Vraag toevoegen</button></div>
    <input id="qSearch" placeholder="Zoek een vraag — op nummer of tekst…" style="margin-bottom:.6rem">
    <div class="muted" id="qSearchInfo" style="margin-bottom:.6rem;display:none"></div>
    <div class="stack" id="qList"></div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  document.getElementById("saveQuiz").onclick=async()=>{
    await sb.from("quizzes").update({ title:document.getElementById("qzTitle").value, description:document.getElementById("qzDesc").value }).eq("id",quizId);
    toast("Opgeslagen","ok");
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

function srcToggle(id, val){
  return `<div class="btnrow" style="margin:.2rem 0 0">
    <button type="button" class="chip-toggle ${val==="mens"?"active":""}" data-src="${id}" data-val="mens">${ICON.person} mens</button>
    <button type="button" class="chip-toggle ${val==="ai"?"active":""}" data-src="${id}" data-val="ai">${ICON.robot} AI</button></div>`;
}
function questionEditor(q){
  const corr=arr(q.correct_indexes);
  const doc=arr(q.docent_indexes);
  return `<div class="card" data-qcard="${q.id}">
    <div class="spread"><span class="q-num">Vraag ${q.qnum}</span>
      <button class="btn btn-danger btn-sm" data-delq="${q.id}">Verwijderen</button></div>
    <label>Vraagtekst</label><textarea data-f="text" data-q="${q.id}">${esc(q.text)}</textarea>
    <label style="display:flex;align-items:center;gap:.5rem;font-weight:400"><input type="checkbox" data-valid="${q.id}" style="width:auto" ${q.validated!==false?"checked":""}> Gevalideerd juist antwoord ${infoTip("Uit = er is nog geen officieel juist antwoord; de groep bepaalt het via opmerkingen en flags. De vraag krijgt dan de tag 'Niet gevalideerd'. Als J (juridisch) en D (docent) verschillen, staat deze vlag standaard uit tot een beheerder bewust bevestigt.")}</label>
    <div data-valid-warn="${q.id}" class="valid-mismatch" hidden>⚠️ J en D verschillen — vragen worden standaard <strong>niet-gevalideerd</strong> bewaard tot je hier bewust bevestigt door dit vinkje aan te zetten.</div>
    <label style="display:flex;align-items:center;gap:.5rem;font-weight:400"><input type="checkbox" data-multi="${q.id}" style="width:auto" ${q.multi?"checked":""}> Meerkeuze (meerdere juiste antwoorden)</label>
    <label>Antwoordopties — vink <strong>J</strong> aan voor het wettelijk juiste antwoord, en <strong>D</strong> voor het antwoord dat de docent koos (indien verschillend) ${infoTip("J = juridisch/officieel juist antwoord. D = wat de docent aanduidde — enkel invullen als die afwijkt van J. Als beide leeg blijven bij één optie, telt die niet mee.")}</label>
    <div data-opts="${q.id}">${(q.options||[]).map((o,i)=>`
      <div class="spread optrow" style="gap:.4rem;margin:.2rem 0">
        <label class="cbxlab" title="Juridisch juist"><input type="checkbox" class="corr" data-q="${q.id}" value="${i}" ${corr.includes(i)?"checked":""} style="width:auto"><span>J</span></label>
        <label class="cbxlab cbxlab-doc" title="Volgens de docent"><input type="checkbox" class="doc" data-q="${q.id}" value="${i}" ${doc.includes(i)?"checked":""} style="width:auto"><span>D</span></label>
        <input data-opt="${q.id}" value="${esc(o)}" style="flex:1">
        <button type="button" class="opt-ref-chip" data-insert="${letter(i)}" title="Klik om {${letter(i)}} in te voegen op je cursorpositie in het laatst gefocuste tekstvak">{${letter(i)}}</button>
        <button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>
      </div>`).join("")}</div>
    <button class="btn btn-ghost btn-sm" data-addopt="${q.id}">+ optie</button>
    <label>Toelichting docent (optioneel) ${infoTip("Korte uitleg waarom de docent een ander antwoord kiest dan wat wettelijk juist is. Wordt getoond in het docent-blok bij de vraag. Verwijs naar antwoordopties met {A} {B} {C} … — die worden vertaald naar de letter die de speler ziet.")}</label>
    <textarea data-f="docent_note" data-q="${q.id}" placeholder="bv. De docent noteert antwoord {B} als praktijk-antwoord…">${esc(q.docent_note||"")}</textarea>
    <label>Herkomst juist antwoord</label>${srcToggle("as-"+q.id, q.answer_source)}
    <label>Wettelijke basis ${infoTip("Verwijs naar antwoordopties met {A} {B} {C} … De app vertaalt die naar de letter die de gebruiker in zijn geschudde volgorde ziet.")}</label>
    <textarea data-f="legal_basis" data-q="${q.id}">${esc(q.legal_basis||"")}</textarea>
    <label>Herkomst wettelijke basis</label>${srcToggle("ls-"+q.id, q.legal_basis_source)}
    <label>Wettekst (volledige artikels, uitklapbaar bij de vraag) ${infoTip("Volledige artikeltekst. Verwijs naar antwoordopties met {A} {B} {C} … indien nodig.")}</label>
    <textarea data-f="wettekst" data-q="${q.id}">${esc(q.wettekst||"")}</textarea>
    <label>Uitleg ${infoTip("Waarom is dit antwoord juist? Verwijs naar antwoordopties met {A} {B} {C} … — de app vertaalt die naar de letter die de gebruiker daadwerkelijk ziet, zodat je uitleg altijd klopt. Bv. 'Antwoord {A} is juist omdat art. 34 Sv. …'. Speciale tokens: {juist} = altijd de juiste antwoordletter, {docent} = het antwoord dat de docent koos.")}</label>
    <div class="ref-chip-row">
      <span class="muted" style="font-size:.72rem">Invoegen:</span>
      <button type="button" class="opt-ref-chip opt-ref-special" data-insert-special="juist" title="Voeg {juist} in — verwijst altijd naar het juiste antwoord, ongeacht shuffle">{juist}</button>
      <button type="button" class="opt-ref-chip opt-ref-special" data-insert-special="docent" title="Voeg {docent} in — verwijst naar het antwoord dat de docent koos">{docent}</button>
    </div>
    <textarea data-f="explanation" data-q="${q.id}">${esc(q.explanation||"")}</textarea>
    <label>Herkomst uitleg</label>${srcToggle("es-"+q.id, q.explanation_source)}
    <div class="btnrow"><button class="btn btn-primary btn-sm" data-saveq="${q.id}">Vraag opslaan</button></div>
  </div>`;
}
function wireQuestionEditor(q, quizId){
  const card=document.querySelector(`[data-qcard="${q.id}"]`);
  const srcVals={ answer_source:q.answer_source, explanation_source:q.explanation_source, legal_basis_source:q.legal_basis_source };
  card.querySelectorAll("[data-src]").forEach(b=>b.onclick=()=>{
    const grp=b.dataset.src; card.querySelectorAll(`[data-src="${grp}"]`).forEach(x=>x.classList.toggle("active",x===b));
    if(grp.startsWith("as-")) srcVals.answer_source=b.dataset.val;
    else if(grp.startsWith("ls-")) srcVals.legal_basis_source=b.dataset.val;
    else srcVals.explanation_source=b.dataset.val;
  });
  const addRm=el=>{ el.querySelector("[data-rmopt]").onclick=()=>el.remove(); };
  card.querySelector(`[data-addopt="${q.id}"]`).onclick=()=>{
    const wrap=card.querySelector(`[data-opts="${q.id}"]`);
    const nextIdx=wrap.querySelectorAll(".optrow").length;
    const div=document.createElement("div"); div.className="spread optrow"; div.style="gap:.4rem;margin:.2rem 0";
    const l=letter(nextIdx);
    div.innerHTML=`<label class="cbxlab" title="Juridisch juist"><input type="checkbox" class="corr" data-q="${q.id}" style="width:auto"><span>J</span></label><label class="cbxlab cbxlab-doc" title="Volgens de docent"><input type="checkbox" class="doc" data-q="${q.id}" style="width:auto"><span>D</span></label><input data-opt="${q.id}" value="" style="flex:1"><button type="button" class="opt-ref-chip" data-insert="${l}" title="Klik om {${l}} in te voegen op je cursorpositie in het laatst gefocuste tekstvak">{${l}}</button><button class="btn btn-ghost btn-sm" data-rmopt="${q.id}">×</button>`;
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
      const token = `{${raw}}`;
      const ta = lastFocused;
      if(!ta) return;
      const start = ta.selectionStart, end = ta.selectionEnd;
      const v = ta.value;
      ta.value = v.slice(0,start) + token + v.slice(end);
      ta.focus();
      const pos = start + token.length;
      ta.setSelectionRange(pos, pos);
    };
  }
  card.querySelectorAll(".opt-ref-chip").forEach(wireRefChip);
  card.querySelectorAll(`[data-opts="${q.id}"] .optrow`).forEach(addRm);
  // waarschuwing bij J≠D: iedere J- of D-verandering evalueert opnieuw
  const paintMismatchWarn=()=>{
    const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
    const jIdxs=[], dIdxs=[];
    rows.forEach((r,i)=>{ if(r.querySelector(".corr").checked) jIdxs.push(i); if(r.querySelector(".doc").checked) dIdxs.push(i); });
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
  card.querySelector(`[data-saveq="${q.id}"]`).onclick=async()=>{
    const text=card.querySelector(`[data-f="text"][data-q="${q.id}"]`).value.trim();
    const rows=[...card.querySelectorAll(`[data-opts="${q.id}"] .optrow`)];
    const opts=[]; const correct=[]; const docent=[];
    rows.forEach(r=>{ const v=r.querySelector(`[data-opt="${q.id}"]`).value.trim(); if(!v) return;
      const idx=opts.length; opts.push(v);
      if(r.querySelector(".corr").checked) correct.push(idx);
      if(r.querySelector(".doc").checked) docent.push(idx);
    });
    if(opts.length<2) return toast("Minstens 2 opties","err");
    const validated=card.querySelector(`[data-valid="${q.id}"]`).checked;
    if(validated && !correct.length) return toast("Vink een juist antwoord aan, of zet 'Gevalideerd' uit.","err");
    const multi=card.querySelector(`[data-multi="${q.id}"]`).checked || correct.length>1;
    const docent_note=card.querySelector(`[data-f="docent_note"][data-q="${q.id}"]`).value;
    const payload={ text, options:opts, correct_indexes:correct, multi, validated,
      docent_indexes: docent.length? docent : null,
      docent_note: docent.length? docent_note : null,
      legal_basis:card.querySelector(`[data-f="legal_basis"][data-q="${q.id}"]`).value,
      wettekst:card.querySelector(`[data-f="wettekst"][data-q="${q.id}"]`).value,
      explanation:card.querySelector(`[data-f="explanation"][data-q="${q.id}"]`).value,
      answer_source:srcVals.answer_source, explanation_source:srcVals.explanation_source, legal_basis_source:srcVals.legal_basis_source };
    const { error }=await sb.from("questions").update(payload).eq("id",q.id);
    if(error) return toast(error.message,"err");
    toast("Vraag opgeslagen (wijzigingen gelogd)","ok");
  };
}

/* ============================================================
   ÉÉN VRAAG bewerken + flags/opmerkingen beheren
   ============================================================ */
async function viewEditQuestion(qid){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  const { data:q } = await sb.from("questions").select("*").eq("id",qid).single();
  if(!q){ app.innerHTML=`<div class="empty">Vraag niet gevonden.</div>`; return; }
  const { data:quiz } = await sb.from("quizzes").select("id,title").eq("id",q.quiz_id).single();
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
    <div class="stack" id="qList">${questionEditor(q)}</div>

    <h2>Reacties (${(flags||[]).length})</h2>
    <div class="stack">${(flags||[]).map(f=>`<div class="card"><div class="spread">
      <div><span class="pill ${f.type}">${f.type}</span> ${f.status==="afgehandeld"?`<span class="pill afgehandeld">afgehandeld</span>`:""} <span class="who">${esc(names[f.user_id]||"?")}</span>${arr(f.preferred_indexes).length?` <span class="muted">· verkiest <strong>${lettersOf(f.preferred_indexes)}</strong></span>`:""} <span class="when">${fmtDate(f.created_at)}</span>${f.toelichting?`<div>${esc(f.toelichting)}</div>`:""}</div>
      <div class="btnrow" style="margin:0">${f.status==="open"?`<button class="btn btn-ghost btn-sm" data-resolve="${f.id}">${ICON.check} Afhandelen</button>`:""}<button class="btn btn-danger btn-sm" data-delflag="${f.id}">Verwijderen</button></div>
    </div></div>`).join("")||`<p class="muted">Geen reacties.</p>`}</div>

    <h2>Wijzigingshistoriek (${(edits||[]).length})</h2>
    <div class="stack">${(edits||[]).map(e=>`<div class="hist"><span class="who">${esc(names[e.edited_by]||"?")}</span> <span class="when">${fmtDate(e.created_at)}</span><div>${esc(e.summary)}</div></div>`).join("")||`<p class="muted">Geen wijzigingen.</p>`}</div>`;
  app.querySelectorAll("[data-nav]").forEach(a=>a.onclick=()=>go(a.dataset.nav));
  wireQuestionEditor(q, q.quiz_id);
  // "Opslaan & bekijken" — trigger de bestaande save-knop en spring dan naar de speelweergave
  document.getElementById("saveAndPreview").onclick=async()=>{
    const saveBtn=document.querySelector(`[data-saveq="${q.id}"]`);
    if(!saveBtn) return;
    // Reset de toast-fout-vlag door de save uit te voeren; we luisteren naar de bestaande onclick
    saveBtn.click();
    // De bestaande save is async — geef de UI even tijd om een toast op te bouwen en dan navigeren.
    setTimeout(()=>PLAY_goto(q.quiz_id, q.id), 600);
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
  const push=()=>{ if(cur){ questions.push(cur); cur=null; } };
  for(let raw of lines){
    const line=raw.trim();
    if(/^#\s*Titel:/i.test(line)){ title=line.replace(/^#\s*Titel:/i,"").trim(); continue; }
    if(/^#\s+/.test(line)&&!title){ title=line.replace(/^#+\s*/,"").trim(); continue; }
    if(/^Beschrijving:/i.test(line)){ desc=line.replace(/^Beschrijving:/i,"").trim(); continue; }
    if(/^##\s*/.test(line)){ push(); cur={ text:"", options:[], correct_indexes:[], docent_indexes:[], docent_note:"", legal_basis:"", wettekst:"", explanation:"", source:"mens", validated:true }; field="text"; continue; }
    if(!cur) continue;
    let m;
    // Optie: - [x] [d] tekst — [x/X] = juridisch juist (J), [d/D] = docent koos dit (D)
    if((m=line.match(/^-\s*\[( |x|X)\]\s*(?:\[( |d|D)\]\s*)?(.+)$/))){
      const idx=cur.options.length;
      if(m[1].toLowerCase()==="x") cur.correct_indexes.push(idx);
      if(m[2] && m[2].toLowerCase()==="d") cur.docent_indexes.push(idx);
      cur.options.push(m[3].trim()); field="opt"; continue;
    }
    if(/^\*\*Wettelijke basis:\*\*/i.test(line)){ cur.legal_basis=line.replace(/^\*\*Wettelijke basis:\*\*/i,"").trim(); field="legal"; continue; }
    if(/^\*\*Wettekst:\*\*/i.test(line)){ cur.wettekst=line.replace(/^\*\*Wettekst:\*\*/i,"").trim(); field="wettekst"; continue; }
    if(/^\*\*Uitleg:\*\*/i.test(line)){ cur.explanation=line.replace(/^\*\*Uitleg:\*\*/i,"").trim(); field="uitleg"; continue; }
    if(/^\*\*Docent(-toelichting)?:\*\*/i.test(line)){ cur.docent_note=line.replace(/^\*\*Docent(-toelichting)?:\*\*/i,"").trim(); field="docent"; continue; }
    if(/^\*\*Bron:\*\*/i.test(line)){ cur.source=/\b(ai|robot)\b/i.test(line)?"ai":"mens"; field=null; continue; }
    if(/^\*\*Gevalideerd:\*\*/i.test(line)){ cur.validated=!/nee|neen|geen|no|uit|false/i.test(line); field=null; continue; }
    if(line===""){
      // lege regel = paragraafgrens in multi-line velden
      if(field==="legal") cur.legal_basis+="\n\n";
      else if(field==="wettekst") cur.wettekst+="\n\n";
      else if(field==="uitleg") cur.explanation+="\n\n";
      continue;
    }
    // vervolgtekst bij het lopende veld
    if(field==="text") cur.text=(cur.text?cur.text+" ":"")+line;
    else if(field==="legal") cur.legal_basis+=(cur.legal_basis.endsWith("\n\n")?"":" ")+line;
    else if(field==="wettekst") cur.wettekst+=(cur.wettekst.endsWith("\n\n")?"":" ")+line;
    else if(field==="uitleg") cur.explanation+=(cur.explanation.endsWith("\n\n")?"":" ")+line;
  }
  push();
  questions.forEach((q,i)=>{
    if(!q.text) errors.push(`Vraag ${i+1}: geen vraagtekst.`);
    if(q.options.length<2) errors.push(`Vraag ${i+1}: minder dan 2 opties.`);
    if(!q.correct_indexes.length) q.validated=false;   // geen [x] ⇒ niet gevalideerd
    // Bij afwijkend docent-antwoord blijft de vraag "niet gevalideerd" tot een beheerder ze bevestigt.
    if(q.docent_indexes && q.docent_indexes.length && !setEq(q.docent_indexes, q.correct_indexes)) q.validated=false;
    q.multi=q.correct_indexes.length>1;
  });
  if(!title) errors.push("Geen titel gevonden (# Titel: ...).");
  if(!questions.length) errors.push("Geen vragen gevonden (## Vraag ...).");
  return { title, desc, questions, errors };
}

async function viewImport(){
  if(!isEditor()){ app.innerHTML=`<div class="empty">Geen toegang.</div>`; return; }
  app.innerHTML=`
    <a class="muted" data-nav="#/beheer">← Beheer</a>
    <h1>Quiz importeren</h1>
    <p class="muted">Plak een ingevuld Markdown-sjabloon of kies een <code>.md</code>-bestand. <a href="quiz-sjabloon.md" download>Leeg sjabloon downloaden</a>.</p>
    <div class="card">
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
  document.getElementById("mdFile").onchange=async e=>{
    const f=e.target.files[0]; if(f){ document.getElementById("mdText").value=await f.text(); showPreview(); }
  };
  const showPreview=()=>{
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    const box=document.getElementById("importPreview");
    box.innerHTML=`<div class="card">
      ${parsed.errors.length?`<div style="color:var(--wrong)"><strong>Aandachtspunten:</strong><ul>${parsed.errors.map(e=>`<li>${esc(e)}</li>`).join("")}</ul></div>`:`<p style="color:var(--correct)">${ICON.check} Geen fouten gevonden.</p>`}
      <p><strong>${esc(parsed.title||"(geen titel)")}</strong> — ${parsed.questions.length} vragen</p>
      ${parsed.questions.filter(q=>!q.validated).length?`<p class="muted">${parsed.questions.filter(q=>!q.validated).length} vraag/vragen zonder aangeduid juist antwoord → komen binnen als <strong>niet gevalideerd</strong>.</p>`:""}
      <ol>${parsed.questions.slice(0,8).map(q=>`<li>${esc(q.text).slice(0,80)}… <span class="muted">(juist: ${q.validated?lettersOf(q.correct_indexes):"in overleg"}${q.multi?" · meerkeuze":""})</span></li>`).join("")}</ol>
      ${parsed.questions.length>8?`<p class="muted">…en ${parsed.questions.length-8} meer.</p>`:""}
    </div>`;
    return parsed;
  };
  document.getElementById("previewBtn").onclick=showPreview;
  document.getElementById("importBtn").onclick=async()=>{
    const btn=document.getElementById("importBtn");
    const parsed=parseQuizMarkdown(document.getElementById("mdText").value);
    showPreview();
    if(!parsed.title || !parsed.questions.length){ toast("Niets te importeren — controleer het bestand.","err"); return; }
    if(parsed.errors.length){ toast("Los eerst de aandachtspunten op.","err"); return; }
    btn.disabled=true;
    try{
      const aiAll=document.getElementById("aiAll").checked;
      status("Quiz aanmaken…");
      const { data:quiz, error }=await sb.from("quizzes").insert({ title:parsed.title, description:parsed.desc, status:"concept", created_by:ME.id }).select().single();
      if(error) throw error;
      const rows=parsed.questions.map((q,i)=>{
        const src = q.source==="ai" ? "ai" : (aiAll ? "ai" : "mens");
        const doc = (q.docent_indexes && q.docent_indexes.length) ? q.docent_indexes : null;
        return { quiz_id:quiz.id, sort_order:i+1, text:q.text, options:q.options, correct_indexes:q.correct_indexes, multi:!!q.multi, validated:q.validated!==false,
          docent_indexes:doc, docent_note: doc ? (q.docent_note||null) : null,
          legal_basis:q.legal_basis, wettekst:q.wettekst, explanation:q.explanation,
          answer_source:src, explanation_source:src, legal_basis_source: q.legal_basis ? src : null };
      });
      const CHUNK=40;
      for(let i=0;i<rows.length;i+=CHUNK){
        status(`Vragen wegschrijven… ${Math.min(i+CHUNK,rows.length)}/${rows.length}`);
        const { error:e2 }=await sb.from("questions").insert(rows.slice(i,i+CHUNK));
        if(e2) throw e2;
      }
      status("");
      toast(`Geïmporteerd: ${rows.length} vragen (concept)`,"ok");
      go("#/beheer/quiz/"+quiz.id);
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
  route();
  if(ME) refreshNotifyBadge();
}
if(sb){ sb.auth.onAuthStateChange((_e,_s)=>{ /* sessiewissels */ }); }
boot();
