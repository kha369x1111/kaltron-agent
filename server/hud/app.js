"use strict";
/* ============================== state ============================== */
const CONV = "kaltron-main";
let ws=null, wsReady=false, capturing=false, state="standby";
let audioCtx=null, workletNode=null, mediaStream=null, srcNode=null;
let inputAnalyser=null, outputAnalyser=null, silentSink=null;
let wakeArmed=false, wakePcm=[], wakeBytes=0, wakeEnergy=0, wakeFrames=0, wakeProbeBusy=false;
let playhead=0, activeSources=[], leftoverByte=null, audioArrived=false;
let level=0, turns=0;

const $=id=>document.getElementById(id);
const feed=$("feed");

/* ============================== language =========================== */
let lang=localStorage.getItem("lang") === "en" ? "en" : "ar";
let dictionary={};
const fallback={standby:"KALTRON — وضع الاستعداد",talk_hint:"اضغط الشخصية أو المسافة للتحدث",
  listening:"أستمع إليك",processing:"جارٍ المعالجة",working:"جارٍ العمل",
  speaking:"أتحدث الآن",engage_voice:"تفعيل الصوت",stop_send:"■ إيقاف وإرسال",
  online:"متصل",offline:"غير متصل",idle:"خامل",live:"مباشر",
  link_active:"الاتصال نشط",link_down:"الاتصال منقطع",voice_connected:"خادم الصوت متصل"};
const t=key=>dictionary[key]||fallback[key]||key;
async function setLanguage(next){
  const chosen=next === "en" ? "en" : "ar";
  let strings;
  try{
    const response=await fetch(`i18n/${chosen}.json`);
    if(!response.ok)throw new Error(`HTTP ${response.status}`);
    strings=await response.json();
  }catch(err){console.error("KALTRON language load failed",err);return}
  lang=chosen; dictionary=strings; localStorage.setItem("lang",lang);
  document.documentElement.lang=lang;
  document.documentElement.dir=lang==="ar"?"rtl":"ltr";
  document.querySelectorAll("[data-i18n]").forEach(el=>{
    const value=dictionary[el.dataset.i18n]; if(value)el.textContent=value;
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el=>{
    const value=dictionary[el.dataset.i18nPlaceholder]; if(value)el.placeholder=value;
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el=>{
    const value=dictionary[el.dataset.i18nTitle]; if(value)el.title=value;
  });
  $("langToggle").setAttribute("aria-label",lang==="ar"?"Switch to English":"التحويل إلى العربية");
  $("talkBtn").textContent=capturing?t("stop_send"):t("engage_voice");
  $("wakeArmBtn").textContent=t(wakeArmed?"disarm_wake":"arm_wake");
  $("stateLabel").textContent=t(state==="standby"?"standby":state==="thinking"?"processing":state==="tool"?"working":state);
  $("stateHint").textContent=t(state==="listening"?"send_hint":"talk_hint");
  $("wsState").textContent=t(wsReady?"online":"offline");
  $("micState").textContent=t(capturing?"live":mediaStream?"online":"idle");
  $("connState").textContent=t(wsReady?"link_active":"link_down");
  $("footMsg").textContent=t(wsReady?"voice_connected":"ready");
}
$("langToggle").onclick=()=>setLanguage(lang==="ar"?"en":"ar");
const initialLanguageReady=setLanguage(lang);

/* ============================== clock ============================== */
setInterval(()=>{const d=new Date();$("clock").textContent=d.toTimeString().slice(0,8)},500);

/* ============================== avatar ============================= */
function setState(st,label,hint){
  state=st;
  window.KaltronAvatar.setState(st);
  $("stateLabel").textContent=t(st==="standby"?"standby":st==="thinking"?"processing":st==="tool"?"working":st);
  $("stateHint").textContent=t(st==="listening"?"send_hint":"talk_hint");
}

// Whisper small on this CPU has also rendered the spoken name as يكتون/ياكتون.
const WAKE_WORD=/(?:\bkaltron\b|(?:يا\s*)?(?:كالترون|كاترون|كالتون|يكتون|ياكتون))/iu;
function checkWakeWord(text){
  if(text && WAKE_WORD.test(text))window.KaltronAvatar.wake();
}

/* ============================== feed =============================== */
function addMsg(cls,text){
  const d=document.createElement("div"); d.className="msg "+cls; d.textContent=text;
  feed.appendChild(d); feed.scrollTop=feed.scrollHeight;
  while(feed.children.length>80)feed.removeChild(feed.firstChild);
  return d;
}
function addActivity(text,toolName,preview){
  const a=$("activity");
  if(a.firstChild&&a.firstChild.textContent.startsWith("—"))a.innerHTML="";
  const d=document.createElement("div");
  const esc=s=>String(s||"").replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  d.innerHTML=toolName?`▸ ${esc(t("tool"))} <b>${esc(toolName)}</b> <span style="opacity:.7">${esc((preview||"").slice(0,60))}</span>`:`▸ ${esc(text)}`;
  a.prepend(d); while(a.children.length>40)a.removeChild(a.lastChild);
}

/* live partial transcript bubble */
let liveEl=null, currentRun=null;
function showLive(text){
  if(!text)return;
  checkWakeWord(text);
  if(!liveEl){liveEl=addMsg("you live","");}
  liveEl.textContent=text; feed.scrollTop=feed.scrollHeight;
}
function clearLive(){ if(liveEl){liveEl.remove(); liveEl=null;} }
function showStop(on){ $("stopBtn").style.display=on?"block":"none"; }
function stopRun(){
  stopPlayback();
  if(wsReady)ws.send(JSON.stringify({type:"stop_run"}));
  showStop(false);
}

/* approval cards */
function showApproval(e){
  const data=e.data||{};
  const esc=s=>String(s||"").replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]));
  const id=data.approval_id||data.id||"";
  const desc=data.preview||data.command||data.description||JSON.stringify(data).slice(0,300);
  const card=document.createElement("div"); card.className="appr";
  card.innerHTML=`<h3>${t("approval_required")}</h3><pre>${esc(desc)}</pre>
    <div class="row"><button class="btn">${t("allow")}</button><button class="btn danger">${t("deny")}</button></div>`;
  const [allowB,denyB]=card.querySelectorAll("button");
  const send=dec=>{ if(wsReady)ws.send(JSON.stringify({type:"approval_decision",run_id:e.run_id||currentRun,approval_id:id,decision:dec})); card.remove(); };
  allowB.onclick=()=>send("allow"); denyB.onclick=()=>send("deny");
  $("approvals").appendChild(card);
  addActivity(t("approval_requested"));
}

/* ============================== websocket ========================== */
function wsUrl(){return (location.protocol==="https:"?"wss://":"ws://")+location.host+"/ws"}
function connect(){
  ws=new WebSocket(wsUrl()); ws.binaryType="arraybuffer";
  ws.onopen=()=>{wsReady=true;$("wsDot").className="dot on";$("wsState").textContent=t("online");$("connState").textContent=t("link_active");$("footMsg").textContent=t("voice_connected")};
  ws.onclose=()=>{wsReady=false;wakeProbeBusy=false;$("wsDot").className="dot off";$("wsState").textContent=t("offline");$("connState").textContent=t("link_down");setState("standby");setTimeout(connect,3000)};
  ws.onerror=()=>{};
  ws.onmessage=ev=>{
    if(ev.data instanceof ArrayBuffer){playChunk(ev.data);return}
    let e; try{e=JSON.parse(ev.data)}catch{return}
    if(e.type==="summon_panel"){ summonPanel(e); }
    else if(e.type==="dismiss_panels"){ dismissAllPanels(); }
    else if(e.type==="wake_probe_result"){
      wakeProbeBusy=false;
      if(wakeArmed && !capturing && state==="standby" && WAKE_WORD.test(e.text||"")){
        window.KaltronAvatar.wake(); toggleTalk();
      }
    }
    else if(e.type==="partial_transcript"){ showLive(e.text); }
    else if(e.type==="transcript"){ clearLive(); if(e.text){checkWakeWord(e.text);addMsg("you",e.text)} }
    else if(e.type==="run_started"){ currentRun=e.run_id; showStop(true); }
    else if(e.type==="approval_request"){ showApproval(e); }
    else if(e.type==="agent_status"){
      if(e.state==="thinking"){setState("thinking","PROCESSING");showStop(true)}
      else if(e.state==="tool_use"){setState("tool","WORKING");addActivity("",e.tool||"tool",e.preview)}
      else if(e.state==="speaking")setState("speaking","SPEAKING");
      else if(e.state==="stopped"){setState("standby");showStop(false);stopPlayback();addMsg("sys",t("run_stopped"))}
    }
    else if(e.type==="error"){ clearLive(); addMsg("sys","error: "+e.message); setState("standby","STANDBY"); showStop(false); }
    else if(e.type==="done"){
      currentRun=null; showStop(false);
      const tm=e.timing||{};
      turns++; $("mTurns").textContent=turns;
      if(tm.end_of_speech_to_first_audio_seconds!=null)$("mFirst").textContent=tm.end_of_speech_to_first_audio_seconds+"s";
      if(tm.total_turn_seconds!=null)$("mTotal").textContent=tm.total_turn_seconds+"s";
      $("mBrain").textContent=tm.llm_provider||"—";
      if(tm.response_text)addMsg("kaltron",tm.response_text);
      setTimeout(()=>{if(state!=="listening")setState("standby","STANDBY")},400);
    }
  };
}
connect();

/* ============================== audio out ========================== */
function ensureCtx(){
  if(!audioCtx){
    try{ audioCtx=new (window.AudioContext||window.webkitAudioContext)({sampleRate:16000}); }
    catch{ audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }
    outputAnalyser=audioCtx.createAnalyser(); outputAnalyser.fftSize=1024;
    outputAnalyser.connect(audioCtx.destination);
    window.KaltronAvatar.attachOutputAnalyser(outputAnalyser);
  }
  if(audioCtx.state==="suspended")audioCtx.resume();
}
function playChunk(buf){
  ensureCtx();
  let bytes=new Uint8Array(buf);
  if(leftoverByte!==null){const m=new Uint8Array(bytes.length+1);m[0]=leftoverByte;m.set(bytes,1);bytes=m;leftoverByte=null}
  if(bytes.length%2===1){leftoverByte=bytes[bytes.length-1];bytes=bytes.subarray(0,bytes.length-1)}
  if(!bytes.length)return;
  const i16=new Int16Array(bytes.buffer,bytes.byteOffset,bytes.length/2);
  const f32=new Float32Array(i16.length);
  for(let i=0;i<i16.length;i++)f32[i]=i16[i]/32768;
  const ab=audioCtx.createBuffer(1,f32.length,16000); ab.copyToChannel(f32,0);
  const src=audioCtx.createBufferSource(); src.buffer=ab; src.connect(outputAnalyser);
  const t=Math.max(audioCtx.currentTime+0.06,playhead);
  src.start(t); playhead=t+ab.duration;
  activeSources.push(src); src.onended=()=>{activeSources=activeSources.filter(x=>x!==src)};
  audioArrived=true;
}
function stopPlayback(){ activeSources.forEach(s=>{try{s.stop()}catch{}}); activeSources=[]; playhead=0; }

/* ============================== audio in =========================== */
const workletCode=`
class PCM16K extends AudioWorkletProcessor{
  constructor(){super();this.frac=0;this.acc=0;this.n=0;this.out=[];}
  process(inputs){
    const ch=inputs[0][0]; if(!ch)return true;
    if(sampleRate===16000){            // context already at 16k: pass through
      for(let i=0;i<ch.length;i++){
        const v=Math.max(-1,Math.min(1,ch[i])); this.out.push(v*32767|0);
      }
    }else{                              // averaging (box-filter) downsample
      for(let i=0;i<ch.length;i++){
        this.acc+=ch[i]; this.n++; this.frac+=16000;
        if(this.frac>=sampleRate){ this.frac-=sampleRate;
          const v=Math.max(-1,Math.min(1,this.acc/this.n));
          this.out.push(v*32767|0); this.acc=0; this.n=0; }
      }
    }
    if(this.out.length>=1280){ // 80ms
      const a=new Int16Array(this.out.splice(0,1280));
      this.port.postMessage(a.buffer,[a.buffer]);
    }
    return true;
  }
}
registerProcessor("pcm16k",PCM16K);`;
let workletReady=false;
function sendWakeProbe(){
  if(!wakeArmed || !wsReady || capturing || state!=="standby" || wakeProbeBusy || wakeBytes<32000)return;
  if(wakeEnergy/Math.max(1,wakeFrames)<.025){
    wakePcm=[];wakeBytes=0;wakeEnergy=0;wakeFrames=0;return;
  }
  const bytes=new Uint8Array(wakeBytes);
  let offset=0;
  for(const chunk of wakePcm){bytes.set(chunk,offset);offset+=chunk.length}
  wakePcm=[];wakeBytes=0;wakeEnergy=0;wakeFrames=0;
  let binary="";
  for(let i=0;i<bytes.length;i+=4096)
    binary+=String.fromCharCode(...bytes.subarray(i,i+4096));
  wakeProbeBusy=true;
  ws.send(JSON.stringify({type:"wake_probe",pcm_b64:btoa(binary)}));
  setTimeout(()=>{wakeProbeBusy=false},15000);
}
function connectWakeAnalyser(){
  if(inputAnalyser || !srcNode)return;
  inputAnalyser=audioCtx.createAnalyser(); inputAnalyser.fftSize=1024;
  srcNode.connect(inputAnalyser);
  window.KaltronAvatar.attachInputAnalyser(inputAnalyser,action=>{
    if(action==="dismiss"){dismissGenie();return}
    if(wakeArmed && !capturing && wsReady)toggleTalk();
  });
}
async function initMic(){
  ensureCtx();
  if(!workletReady){
    const url=URL.createObjectURL(new Blob([workletCode],{type:"application/javascript"}));
    await audioCtx.audioWorklet.addModule(url); workletReady=true;
  }
  if(!mediaStream){
    mediaStream=await navigator.mediaDevices.getUserMedia({audio:{channelCount:1,sampleRate:16000,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    srcNode=audioCtx.createMediaStreamSource(mediaStream);
    workletNode=new AudioWorkletNode(audioCtx,"pcm16k");
    workletNode.port.onmessage=e=>{
      if(capturing&&wsReady)ws.send(e.data);
      // level meter
      const a=new Int16Array(e.data); let s=0;
      for(let i=0;i<a.length;i+=8)s+=Math.abs(a[i]);
      level=Math.min(1,(s/(a.length/8))/9000);
      if(wakeArmed && !capturing && state==="standby" && wsReady && !wakeProbeBusy){
        const chunk=new Uint8Array(e.data.slice(0));
        wakePcm.push(chunk);wakeBytes+=chunk.length;
        wakeEnergy+=level;wakeFrames++;
        if(wakeBytes>=80000)sendWakeProbe();
      }
      if(capturing)$("levelBar").style.width=(level*100).toFixed(0)+"%";
    };
    srcNode.connect(workletNode);
    silentSink=audioCtx.createGain(); silentSink.gain.value=0;
    workletNode.connect(silentSink); silentSink.connect(audioCtx.destination);
  }
  if(wakeArmed)connectWakeAnalyser();
  $("micDot").className="dot on"; $("micState").textContent=t("online");
}
function releaseMic(){
  if(!mediaStream)return;
  mediaStream.getTracks().forEach(track=>track.stop());mediaStream=null;
  srcNode?.disconnect();workletNode?.disconnect();silentSink?.disconnect();
  srcNode=null;workletNode=null;silentSink=null;
  $("micDot").className="dot";$("micState").textContent=t("idle");
}

$("wakeArmBtn").onclick=async()=>{
  if(wakeArmed){
    wakeArmed=false;wakePcm=[];wakeBytes=0;wakeEnergy=0;wakeFrames=0;wakeProbeBusy=false;
    if(inputAnalyser){srcNode?.disconnect(inputAnalyser);inputAnalyser.disconnect();inputAnalyser=null}
    window.KaltronAvatar.detachInputAnalyser();
    if(!capturing)releaseMic();
  }else{
    wakeArmed=true;
    try{await initMic()}catch(err){wakeArmed=false;addMsg("sys",t("mic_blocked")+": "+err.message)}
  }
  $("wakeArmBtn").textContent=t(wakeArmed?"disarm_wake":"arm_wake");
};

/* ============================== talk flow ========================== */
async function toggleTalk(){
  if(!capturing)window.KaltronAvatar.wake();
  if(!wsReady){addMsg("sys",t("voice_offline"));return}
  if(capturing){ // stop talking
    capturing=false;
    ws.send(JSON.stringify({type:"stop"}));
    $("talkBtn").textContent=t("engage_voice"); $("micState").textContent=t("online"); $("levelBar").style.width="0%";
    if(!wakeArmed)releaseMic();
    setState("thinking","PROCESSING");
    return;
  }
  // Mark the wake as active before the microphone promise. On a busy Windows
  // host, device startup can exceed the avatar's 20s standby timeout.
  setState("listening");
  try{await initMic()}catch(err){setState("standby");addMsg("sys",t("mic_blocked")+": "+err.message);return}
  stopPlayback();                       // barge-in
  audioArrived=false;
  ws.send(JSON.stringify({type:"start",sample_rate:16000,format:"pcm_s16le",channels:1,conversation:CONV}));
  capturing=true;
  wakePcm=[];wakeBytes=0;wakeEnergy=0;wakeFrames=0;
  $("talkBtn").textContent=t("stop_send"); $("micState").textContent=t("live");
  setState("listening","LISTENING","CLICK AGAIN TO SEND");
}
$("talkBtn").onclick=toggleTalk;
$("reactorWrap").onclick=toggleTalk;
function dismissGenie(){
  if(capturing){
    capturing=false;
    if(wsReady)ws.send(JSON.stringify({type:"cancel"}));
    $("talkBtn").textContent=t("engage_voice");
    $("levelBar").style.width="0%";
    if(!wakeArmed)releaseMic();
  }else if(state!=="standby")stopRun();
  setState("standby");
  window.KaltronAvatar.dismiss();
}
$("genieClose").onclick=e=>{e.stopPropagation();dismissGenie()};
window.addEventListener("kaltron:dismiss-request",dismissGenie);
$("reactorWrap").addEventListener("keydown",e=>{
  if(e.key==="Enter"){e.preventDefault();toggleTalk()}
});
$("stopBtn").onclick=stopRun;

/* ---- pop-up viewer ---- */
const DASH_PROXY=`https://${location.hostname}:9443`;
function openView(name,path){
  $("viewerTitle").textContent=path==="/kanban"?t("kanban_board").replace(/^▸\s*/,""):
    path==="/chat"?t("dashboard_chat").replace(/^▸\s*/,""):t("hermes_dashboard").replace(/^▸\s*/,"");
  $("viewerIframe").src=DASH_PROXY+path;
  $("viewer").classList.add("open");
}
function closeView(){
  $("viewer").classList.remove("open");
  $("viewerIframe").src="about:blank";
}
$("viewerClose").onclick=closeView;
$("viewerPop").onclick=()=>{window.open($("viewerIframe").src,"_blank");closeView()};
$("viewer").addEventListener("click",e=>{if(e.target.id==="viewer")closeView()});
addEventListener("keydown",e=>{
  if(e.key!=="Escape")return;
  if(document.querySelector(".holo:not(.dismiss)"))dismissAllPanels();
  else if($("viewer").classList.contains("open"))closeView();
  else if(window.KaltronAvatar.fullscreen)dismissGenie();
  else stopRun();
});
addEventListener("keydown",e=>{
  if(e.code==="Space"&&!/^(INPUT|BUTTON|TEXTAREA)$/.test(document.activeElement?.tagName||"")){
    e.preventDefault();toggleTalk();
  }
});

/* ============================== typed chat ========================= */
async function sendChat(){
  const inp=$("chatInput"); const text=inp.value.trim(); if(!text)return;
  inp.value=""; addMsg("you",text); setState("thinking","PROCESSING");
  try{
    const r=await fetch("/api/chat",{method:"POST",headers:{"Content-Type":"application/json"},
      body:JSON.stringify({input:text,conversation:CONV})});
    const j=await r.json();
    if(!r.ok)throw new Error(j.error||r.status);
    (j.tools||[]).forEach(t=>addActivity("",t.name,t.preview));
    addMsg("kaltron",j.text||t("no_reply"));
    if(/^\/(new|reset|clear)\b/i.test(text)){     // slash reset → also clear the visible feed
      setTimeout(()=>{feed.innerHTML="";addMsg("sys",t("conversation_reset"));},800);
    }
  }catch(err){ addMsg("sys",t("chat_error")+": "+err.message); }
  if(state!=="listening")setState("standby","STANDBY");
}
$("sendBtn").onclick=sendChat;
$("clearBtn").onclick=()=>{feed.innerHTML="";addMsg("sys",t("chat_cleared"));};
$("chatInput").addEventListener("keydown",e=>{if(e.key==="Enter")sendChat()});

/* ============================== widgets ============================ */
async function jget(path){const r=await fetch("/api/hermes"+path);if(!r.ok)throw new Error(r.status);return r.json()}
async function refreshHealth(){
  try{
    const h=await jget("/health/detailed");
    $("apiDot").className="dot on"; $("apiState").textContent=t("online");
    const st=h.sessions||h.session_stats||{}; const rs=h.resources||{};
    $("hSessions").textContent=st.active??st.total??"ok";
    $("hAgents").textContent=h.running_agents??h.agents??"0";
    $("hCpu").textContent=rs.cpu_percent!=null?rs.cpu_percent+"%":"—";
    $("hMem").textContent=rs.memory_percent!=null?rs.memory_percent+"%":(rs.rss||"—");
    $("hWhen").textContent=new Date().toTimeString().slice(0,8);
  }catch{ $("apiDot").className="dot off"; $("apiState").textContent=t("offline"); }
}
async function refreshSkills(){
  try{
    const s=await jget("/v1/skills"); const list=Array.isArray(s)?s:(s.data||s.skills||[]);
    $("skillCount").textContent=list.length;
    $("skillsList").innerHTML=list.slice(0,14).map(x=>`<div>▸ ${x.name||x}</div>`).join("");
  }catch{ $("skillCount").textContent="?"; }
}
async function refreshJobs(){
  try{
    const j=await jget("/api/jobs"); const list=Array.isArray(j)?j:(j.jobs||j.data||[]);
    $("jobsList").innerHTML=list.length?list.slice(0,8).map(x=>
      `<div>▸ ${x.name||x.prompt?.slice(0,38)||x.id} <span class="${x.paused?"warn":"ok"}">${x.paused?"paused":"on"}</span></div>`).join("")
      :"<div>— none —</div>";
  }catch{ $("jobsList").innerHTML="<div>—</div>"; }
}
async function refreshMachines(){
  try{
    const r=await fetch("/api/machines"); const j=await r.json();
    $("machinesList").innerHTML=(j.machines||[]).map(m=>{
      const bits=[];
      if(m.cpu!=null)bits.push(`CPU ${Math.round(m.cpu)}%`);
      if(m.mem!=null)bits.push(`MEM ${Math.round(m.mem)}%`);
      if(m.gpu_util!=null)bits.push(`GPU ${Math.round(m.gpu_util)}%`);
      if(m.vram_used!=null&&m.vram_total!=null)bits.push(`VRAM ${m.vram_used}/${m.vram_total}G`);
      if(m.gpu_temp!=null)bits.push(`${m.gpu_temp}°`);
      if(!bits.length&&m.note)bits.push(m.note);
      return `<div class="kv"><span><span class="dot ${m.online?"on":"off"}"></span>${m.name}</span><b>${bits.join(" · ")||(m.online?"online":"offline")}</b></div>`;
    }).join("");
  }catch{ $("machinesList").innerHTML=`<div class='kv'><span>${t("unavailable")}</span></div>`; }
}
const fmtK=n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"k":String(n||0);
async function refreshUsage(){
  try{
    const r=await fetch("/api/usage"); const j=await r.json();
    const t=j.llm?.today||{};
    $("uTok").textContent=`${fmtK(t.llm_in||0)} in / ${fmtK(t.llm_out||0)} out`;
    $("uTurns").textContent=t.turns||0;
    if(j.llm?.today_cost!=null){$("uCostRow").style.display="flex";$("uCost").textContent="$"+j.llm.today_cost.toFixed(2)}
    $("uTts").textContent=fmtK(t.tts_chars||0)+" chars";
  }catch{}
}
refreshHealth();refreshSkills();refreshJobs();refreshMachines();refreshUsage();
setInterval(refreshUsage,60000);
setInterval(refreshHealth,15000); setInterval(refreshJobs,60000); setInterval(refreshMachines,10000);
setInterval(refreshSkills,120000);

/* ====================== holographic media panels ==================== */
function holoWhoosh(up=true){
  try{
    ensureCtx();
    if(!audioCtx || audioCtx.state!=="running") return;   // needs prior user gesture
    const t=audioCtx.currentTime;
    const o1=audioCtx.createOscillator(), o2=audioCtx.createOscillator(), g=audioCtx.createGain();
    const f0=up?150:850, f1=up?850:120;
    o1.type="sawtooth"; o2.type="sine";
    o1.frequency.setValueAtTime(f0,t); o1.frequency.exponentialRampToValueAtTime(f1,t+.42);
    o2.frequency.setValueAtTime(f0*2.02,t); o2.frequency.exponentialRampToValueAtTime(f1*2.02,t+.42);
    g.gain.setValueAtTime(.0001,t);
    g.gain.exponentialRampToValueAtTime(.11,t+.07);
    g.gain.exponentialRampToValueAtTime(.0001,t+.55);
    o1.connect(g); o2.connect(g); g.connect(audioCtx.destination);
    o1.start(t); o2.start(t); o1.stop(t+.6); o2.stop(t+.6);
  }catch{}
}
function holoBootTicker(el){
  const lines=()=>Array.from({length:3},()=>
    "0x"+Math.random().toString(16).slice(2,8).toUpperCase()+"  "+
    (Math.random()*90).toFixed(4)+"N "+(Math.random()*180).toFixed(4)+"W");
  el.innerHTML=lines().join("<br>");
  const iv=setInterval(()=>{el.innerHTML=lines().join("<br>")},65);
  setTimeout(()=>{clearInterval(iv); el.style.opacity="0";
    setTimeout(()=>el.remove(),700)},1000);
}
function embedURL(src){
  const yt=src.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([\w-]{6,})/);
  if(yt) return `https://www.youtube.com/embed/${yt[1]}?autoplay=1`;
  return src;
}
let lastSummon={key:"",t:0};
function summonPanel(opts){
  const o=opts||{};
  const media=o.media||o.type||"iframe", src=o.src||"", title=(o.title||"INCOMING FEED").toUpperCase();
  // dedupe: stale WS reconnects can deliver the same broadcast multiple times
  const key=media+"|"+src+"|"+title;
  if(key===lastSummon.key && Date.now()-lastSummon.t<8000) return null;
  lastSummon={key, t:Date.now()};
  const position=["left","right","center"].includes(o.position)?o.position:"center";
  const p=document.createElement("div");
  p.className="holo pos-"+position; p.dataset.fx="hologram";
  let inner="";
  const esrc=encodeURI(src);
  if(media==="image") inner=`<img class="holoContent" src="${esrc}" alt="">`;
  else if(media==="video" && !/youtube|youtu\.be/.test(src))
    inner=`<video class="holoContent" src="${esrc}" controls autoplay playsinline></video>`;
  else inner=`<iframe class="holoContent" src="${embedURL(src)}" allow="autoplay; fullscreen; encrypted-media"></iframe>`;
  p.innerHTML=`
    <svg class="holoFrame" preserveAspectRatio="none" viewBox="0 0 100 100">
      <rect x="0.5" y="0.5" width="99" height="99" pathLength="100" vector-effect="non-scaling-stroke"/>
      <path d="M0.5 8 V0.5 H8" vector-effect="non-scaling-stroke"/>
      <path d="M92 0.5 H99.5 V8" vector-effect="non-scaling-stroke"/>
      <path d="M99.5 92 V99.5 H92" vector-effect="non-scaling-stroke"/>
      <path d="M8 99.5 H0.5 V92" vector-effect="non-scaling-stroke"/>
    </svg>
    <div class="holoBar"><span>◈ ${title}</span><span class="hx" title="dismiss">✕</span></div>
    <div class="holoContentWrap">${inner}</div>
    <div class="holoHex"></div>
    <div class="holoScan"></div>
    <div class="holoChroma c1"></div>
    <div class="holoChroma c2"></div>
    <div class="holoBoot"></div>`;
  $("holoStage").appendChild(p);
  holoWhoosh(true);
  // camera dolly: the whole HUD recedes briefly while the panel arrives
  document.getElementById("grid").classList.add("dolly");
  setTimeout(()=>document.getElementById("grid").classList.remove("dolly"),900);
  holoBootTicker(p.querySelector(".holoBoot"));
  p.addEventListener("animationend",e=>{
    if(e.animationName==="holoApproach") p.classList.add("idle");
    if(e.animationName==="holoDismiss") p.remove();
  });
  p.querySelector(".hx").onclick=()=>dismissPanel(p);
  addActivity(t("hologram")+": "+title.toLowerCase());
  return p;
}
function dismissPanel(p){
  if(!p||p.classList.contains("dismiss"))return;
  p.classList.remove("idle");
  holoWhoosh(false);
  p.classList.add("dismiss");
  setTimeout(()=>p.remove(),700);  // safety net if animationend is missed
}
function dismissAllPanels(){document.querySelectorAll(".holo").forEach(dismissPanel)}
window.summonPanel=summonPanel; window.dismissAllPanels=dismissAllPanels;

/* ============================== auth gate ========================== */
async function checkAuth(){
  try{
    const r=await fetch("/api/usage");
    if(r.status===401){showPinGate();return false}
  }catch{}
  return true;
}
function showPinGate(){
  $("pinGate").style.display="flex";
  $("pinInput").focus();
}
$("pinBtn").onclick=async()=>{
  const v=$("pinInput").value.trim(); if(!v)return;
  document.cookie=`kaltron_token=${encodeURIComponent(v)}; path=/; max-age=31536000; secure; samesite=lax`;
  const r=await fetch("/api/usage");
  if(r.status===401){$("pinMsg").textContent=t("access_denied");$("pinInput").value="";return}
  location.reload();
};
$("pinInput")&&$("pinInput").addEventListener("keydown",e=>{if(e.key==="Enter")$("pinBtn").click()});
checkAuth();

/* ============================== boot sequence ====================== */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const BOOT_LINES=[
  ["boot_init",380],["boot_hud",300],
  ["boot_hermes",650],["boot_voice",420],
  ["boot_memory",420],["boot_nominal",550],
];
let bootRunning=false;
async function bootSequence(full){
  if(bootRunning)return; bootRunning=true;
  await initialLanguageReady;
  const boot=$("boot");
  boot.classList.remove("done"); boot.style.display="flex";
  document.body.classList.remove("booted"); document.body.classList.add("booting");
  const bl=$("bootLines"); bl.innerHTML="";
  const scale=full?1:0.32;
  for(const [key,d] of BOOT_LINES){
    const div=document.createElement("div"); div.innerHTML="▸ "+t(key)+" <b>OK</b>";
    bl.appendChild(div); await sleep(d*scale);
  }
  await sleep(full?350:120);
  // staggered panel power-on
  document.querySelectorAll(".panel").forEach((p,i)=>p.style.animationDelay=(120+i*95)+"ms");
  boot.classList.add("done");
  document.body.classList.remove("booting"); document.body.classList.add("booted");
  if(full){
    try{
      const h=new Date().getHours();
      const f=h<12?"morning":h<18?"afternoon":"evening";
      await new Audio("audio/boot.mp3").play();
    }catch{/* audio needs a user gesture; B-key boots always have one */}
  }
  setTimeout(()=>{boot.style.display="none"},900);
  bootRunning=false;
}
addEventListener("keydown",e=>{
  if((e.key==="b"||e.key==="B")&&document.activeElement!==$("chatInput"))bootSequence(true);
});
bootSequence(new URLSearchParams(location.search).get("boot")==="full");

initialLanguageReady.then(()=>{
  const message=addMsg("sys",t("hud_online"));
  message.dataset.i18n="hud_online";
});
