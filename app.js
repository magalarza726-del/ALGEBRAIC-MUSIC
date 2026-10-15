import {SIZE, ZERO, DEFAULT_A, DEFAULT_B, validDiscrete, toNormalized, calculate, matrixText} from "./matrix.mjs";

const $ = selector => document.querySelector(selector);
const INSTRUMENTS = [
  {name:"Bombo", short:"Bombo", family:"kick", color:"#a7b0ff"},
  {name:"Hi-hat abierto", short:"HH abierto", family:"hho", color:"#75e5cb"},
  {name:"Hi-hat cerrado", short:"HH cerrado", family:"hhc", color:"#79c3f3"},
  {name:"Redoblante", short:"Caja", family:"snare", color:"#efb77c"},
  {name:"Crash 1", short:"Crash 1", family:"crash", color:"#d2a4ff"},
  {name:"Crash 2", short:"Crash 2", family:"china", color:"#f09db0"},
  {name:"Tom 1", short:"Tom alto", family:"tomhi", color:"#90d6fb"},
  {name:"Tom 2", short:"Tom bajo", family:"tomlo", color:"#edce81"}
];
const CATALOG = await (await fetch("./sound-bank.json")).json();
const BANK = CATALOG.banks;
const storageKey = "algebraic-music-v1";
const initialTracks = () => INSTRUMENTS.map(v => ({family:v.family, volume:100, pan:0, tune:0, mute:false}));
const cleanTrack = (t, i) => ({
  family: BANK[t?.family] ? t.family : INSTRUMENTS[i].family,
  volume: Math.max(0,Math.min(150,Number(t?.volume ?? 100)||0)),
  pan: Math.max(-100,Math.min(100,Number(t?.pan ?? 0)||0)),
  tune: Math.max(-12,Math.min(12,Number(t?.tune ?? 0)||0)),
  mute:!!t?.mute
});
function defaultState() {
  return { A:DEFAULT_A.map(row=>[...row]), B:DEFAULT_B.map(row=>[...row]), bpm:110,
    playSource:"C", operation:"average", normalization:"fixed", master:80,
    velocityCurve:"natural", compression:"soft", room:12, tracks:initialTracks() };
}
function loadSaved() {
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey) || "null");
    if (!parsed || !validDiscrete(parsed.A) || !validDiscrete(parsed.B)) return defaultState();
    return sanitize(parsed);
  } catch { return defaultState(); }
}
function sanitize(parsed) {
  const defaults=defaultState();
  return {
    A:parsed.A.map(row=>[...row]),B:parsed.B.map(row=>[...row]),
    bpm:clampInt(parsed.bpm,40,240,110),
    playSource:["A","B","C"].includes(parsed.playSource)?parsed.playSource:"C",
    operation:["sum","average","subtract","matrixProduct","hadamard","transpose","reverse","invertIntensity","inverse"].includes(parsed.operation)?parsed.operation:"average",
    normalization:["fixed","peak","range"].includes(parsed.normalization)?parsed.normalization:"fixed",
    master:clampInt(parsed.master,0,100,80),
    velocityCurve:["natural","dynamic","compressed"].includes(parsed.velocityCurve)?parsed.velocityCurve:"natural",
    compression:["soft","off"].includes(parsed.compression)?parsed.compression:"soft",
    room:clampInt(parsed.room,0,35,12),
    tracks:Array.from({length:SIZE},(_,i)=>cleanTrack(parsed.tracks?.[i] || defaults.tracks[i],i))
  };
}
function clampInt(value,min,max,fallback) {
  const number=Number(value);
  return Number.isFinite(number)?Math.round(Math.max(min,Math.min(max,number))):fallback;
}
let state=loadSaved();
let derived=calculate(state.A,state.B,state.operation,state.normalization);
let toastTimer;
function notify(message) {
  const el=$("#toast"); el.textContent=message;el.classList.add("visible");
  clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove("visible"),2800);
}
function persist() {
  try { localStorage.setItem(storageKey,JSON.stringify(state)); }
  catch { notify("El navegador no permite guardar esta sesión."); }
}
function gridFor(source) { return source==="C"?derived.discrete:state[source]; }

class DrumAudio {
  constructor() {
    const Ctx=window.AudioContext || window.webkitAudioContext;
    this.ctx=Ctx?new Ctx():null;
    this.samples=new Map();
    this.custom=new Map();
    this.pending=new Map();
    this.hitCounter=new Map();
    this.base=null;
    this.activeVoices=new Set();
    this.openHats=[];
    this.loaded=0;
    this.total=0;
    this.failed=0;
    if (!this.ctx) {
      $("#sampleStatus").textContent="Web Audio no está disponible.";
      $("#audioStatus").classList.add("error"); return;
    }
    this.bus=this.ctx.createGain();
    this.room=this.ctx.createConvolver();
    this.room.buffer=makeRoomImpulse(this.ctx);
    this.roomGain=this.ctx.createGain();
    this.roomGain.gain.value=state.room / 100;
    this.bus.connect(this.room);
    this.room.connect(this.roomGain);
    this.compressor=this.ctx.createDynamicsCompressor();
    this.compressor.threshold.value=-15;
    this.compressor.knee.value=18;
    this.compressor.ratio.value=3;
    this.compressor.attack.value=.004;
    this.compressor.release.value=.12;
    this.master=this.ctx.createGain();
    this.master.gain.value=state.master/100*.8;
    this.master.connect(this.ctx.destination);
    this.roomGain.connect(this.master);
    this.setCompression(state.compression);
    this.channels=INSTRUMENTS.map((_,i)=>{
      const gain=this.ctx.createGain();
      const pan=this.ctx.createStereoPanner();
      gain.connect(pan);pan.connect(this.bus);
      gain.gain.value=state.tracks[i].mute?0:state.tracks[i].volume/100;
      pan.pan.value=state.tracks[i].pan/100;
      return {gain,pan};
    });
    this.loadDefault().catch(error=>console.error("Audio bank error:",error));
  }
  async ensureContext() {
    if (!this.ctx) throw Error("Este navegador no tiene soporte Web Audio.");
    // El resume debe invocarse desde un gesto del usuario.
    if (this.ctx.state!=="running") await this.ctx.resume();
    if (this.ctx.state!=="running") throw Error("No se pudo activar el audio.");
  }
  setCompression(mode) {
    if (!this.bus) return;
    this.bus.disconnect();
    this.compressor.disconnect();
    if(mode==="soft") {this.bus.connect(this.compressor);this.compressor.connect(this.master);}
    else this.bus.connect(this.master);
  }
  applyMaster(){if(this.master)this.master.gain.setTargetAtTime(state.master/100*.8,this.ctx.currentTime,.02);}
  applyRoom(){if(this.roomGain)this.roomGain.gain.setTargetAtTime(state.room/100,this.ctx.currentTime,.04);}
  applyTrack(i){
    if(!this.channels)return;
    const t=state.tracks[i];
    this.channels[i].gain.gain.setTargetAtTime(t.mute?0:t.volume/100,this.ctx.currentTime,.015);
    this.channels[i].pan.pan.setTargetAtTime(t.pan/100,this.ctx.currentTime,.015);
  }
  sampleFile(family,intensity,rr) {
    const b=BANK[family];
    return b.type==="acoustic"
      ?family+"_vl"+b.levels[intensity-1]+"_rr"+rr+".flac"
      :family+"_v"+intensity+".wav";
  }
  async probeLocal() {
    if(this.base!==null) return this.base;
    try {
      const res=await fetch("./assets/samples/kick_vl1_rr1.flac",{cache:"force-cache"});
      this.base=res.ok?"local":"remote";
    }catch {this.base="remote";}
    return this.base;
  }
  async loadDefault() {
    await this.probeLocal();
    const families=[...new Set(state.tracks.map(t=>t.family))];
    await Promise.all(families.map(f=>this.loadFamily(f)));
    this.report();
  }
  async loadFamily(family) {
    if(!BANK[family]) return;
    if(this.pending.has(family)) return this.pending.get(family);
    const files=[];
    const bank=BANK[family];
    const levels=bank.type==="acoustic"?3:bank.files.length;
    for(let vel=1;vel<=levels;vel++) for(let rr=1;rr<=(bank.rr||1);rr++)
      files.push({vel,rr,file:this.sampleFile(family,vel,rr)});
    this.total+=files.length;
    this.report();
    // Máximo 2 peticiones concurrentes por instrumento; evita saturar la red.
    const task=(async()=>{
      for(let i=0;i<files.length;i+=2) await Promise.all(files.slice(i,i+2).map(async entry=>{
        const key=family+"/"+entry.vel+"/"+entry.rr;
        if(this.samples.has(key))return;
        const local="./assets/samples/"+entry.file;
        const remote=bank.type==="acoustic"
          ? CATALOG.sources.acoustic+bank.folder+"/samples/"+entry.file
          : CATALOG.sources.electronic+bank.files[entry.vel-1];
        try {
          const url=this.base==="local"?local:remote;
          let response=await fetch(url,{cache:"force-cache"});
          if(!response.ok && url!==remote) response=await fetch(remote,{cache:"force-cache"});
          if(!response.ok) throw Error("HTTP "+response.status);
          const bytes=await response.arrayBuffer();
          const decoded=await this.ctx.decodeAudioData(bytes);
          this.samples.set(key,decoded);
          this.loaded++;
        }catch(error){this.failed++;console.warn("Sample unavailable",entry.file,error);}
        this.report();
      }));
    })();
    this.pending.set(family,task);
    return task;
  }
  report() {
    const total=this.total;
    $("#sampleStatus").textContent= this.failed && !this.loaded
      ?"No se pudieron cargar muestras. Revisa la conexión."
      :this.failed?"Algunas muestras no están disponibles"
      :this.loaded<total?"Cargando banco de sonidos…":"Banco de sonidos listo";
    $("#sampleCounter").textContent=this.loaded+" / "+total;
    $("#sampleProgress").style.width=(total?100*this.loaded/total:0)+"%";
    const status=$("#audioStatus");
    status.textContent=this.loaded>0?"Audio HQ · "+this.loaded+" muestras":this.failed?"Sin audio disponible":"Cargando muestras...";
    status.classList.toggle("ready",this.loaded>0);
    status.classList.toggle("error",this.failed>0&&!this.loaded);
  }
  chooseBuffer(i,level) {
    const user=this.custom.get(i);
    if(user?.some(Boolean)) {
      const direct=user[level-1];
      const existing=direct || user.find(Boolean);
      if(existing)return existing;
    }
    const family=state.tracks[i].family;
    const counterKey=family+"/"+level;
    const rrCount=BANK[family].rr||1;
    const rr=(this.hitCounter.get(counterKey)||0)%rrCount+1;
    this.hitCounter.set(counterKey,(this.hitCounter.get(counterKey)||0)+1);
    return this.samples.get(family+"/"+level+"/"+rr)
      ||this.samples.get(family+"/"+level+"/1")
      ||this.samples.get(family+"/1/1") || null;
  }
  velocityGain(level) {
    const curve={natural:[0,.28,.60,1],dynamic:[0,.12,.42,1],compressed:[0,.55,.78,1]}[state.velocityCurve]||[0,.28,.60,1];
    return curve[level];
  }
  trigger(row,level,at=this.ctx?.currentTime) {
    if(!this.ctx||level<1||level>3||state.tracks[row].mute)return false;
    const buffer=this.chooseBuffer(row,level);
    if(!buffer)return false;
    const time=Math.max(at,this.ctx.currentTime+.002);
    const sample=this.ctx.createBufferSource();
    sample.buffer=buffer;
    sample.playbackRate.value=Math.pow(2,state.tracks[row].tune/12);
    const lowpass=this.ctx.createBiquadFilter();
    lowpass.type="lowpass";
    lowpass.frequency.value=[0,12500,17000,20000][level];
    lowpass.Q.value=.35;
    const velocity=this.ctx.createGain();
    velocity.gain.setValueAtTime(this.velocityGain(level),time);
    sample.connect(lowpass);lowpass.connect(velocity);velocity.connect(this.channels[row].gain);
    if(["hhc","hhp","trapHat","vintageHat"].includes(state.tracks[row].family)) {
      for(const active of this.openHats) {
        if(active.time>time)continue;
        active.gain.gain.cancelScheduledValues(time);
        active.gain.gain.setTargetAtTime(.0001,time,.015);
      }
      this.openHats=this.openHats.filter(entry=>entry.time>time);
    }
    if(["hho","trapOpenHat"].includes(state.tracks[row].family)) this.openHats.push({gain:velocity,time});
    const voice={sample,velocity,row};
    this.activeVoices.add(voice);
    sample.onended=()=>{this.activeVoices.delete(voice);this.openHats=this.openHats.filter(v=>v.gain!==velocity);try{sample.disconnect();lowpass.disconnect();velocity.disconnect();}catch{}};
    sample.start(time);
    return true;
  }
  stopVoices() {
    for(const voice of [...this.activeVoices]) {
      try {voice.sample.stop(this.ctx.currentTime+.005);}catch{}
    }
    this.openHats=[];
  }
  async setCustomLayer(row,level,file) {
    if(!file)return;
    const bytes=await file.arrayBuffer();
    const buffer=await this.ctx.decodeAudioData(bytes);
    const existing=this.custom.get(row)||[null,null,null];
    existing[level-1]=buffer;
    this.custom.set(row,existing);
  }
  async exportPattern(grid,bpm) {
    if(!this.ctx)throw Error("No hay motor de audio.");
    const sampleRate=44100;
    const stepTime=60/bpm/2;
    const bars=4;
    const duration=bars*SIZE*stepTime+3.5;
    const offline=new OfflineAudioContext(2,Math.ceil(duration*sampleRate),sampleRate);
    const sum=offline.createGain();
    const limiter=offline.createDynamicsCompressor();
    limiter.threshold.value=-12;limiter.ratio.value=3;limiter.knee.value=12;
    limiter.attack.value=.003;limiter.release.value=.15;
    const master=offline.createGain();master.gain.value=state.master/100*.8;
    sum.connect(limiter);limiter.connect(master);master.connect(offline.destination);
    if(state.room>0){
      const room=offline.createConvolver();room.buffer=makeRoomImpulse(offline);
      const wet=offline.createGain();wet.gain.value=state.room/100;
      sum.connect(room);room.connect(wet);wet.connect(master);
    }
    const channels=state.tracks.map(t=>{
      const volume=offline.createGain();volume.gain.value=t.mute?0:t.volume/100;
      const pan=offline.createStereoPanner();pan.pan.value=t.pan/100;
      volume.connect(pan);pan.connect(sum);return volume;
    });
    for(let bar=0;bar<bars;bar++){
      for(let step=0;step<SIZE;step++) {
        const time=(bar*SIZE+step)*stepTime+.025;
        for(let i=0;i<SIZE;i++) {
          const level=grid[i][step];
          if(level===0||state.tracks[i].mute)continue;
          const buffer=this.chooseBuffer(i,level);
          if(!buffer)continue;
          const sample=offline.createBufferSource();sample.buffer=buffer;
          sample.playbackRate.value=Math.pow(2,state.tracks[i].tune/12);
          const filter=offline.createBiquadFilter();filter.type="lowpass";
          filter.frequency.value=[0,12500,17000,20000][level];
          const gain=offline.createGain();gain.gain.value=this.velocityGain(level);
          sample.connect(filter);filter.connect(gain);gain.connect(channels[i]);sample.start(time);
        }
      }
    }
    return audioBufferToWav(await offline.startRendering());
  }
}
function audioBufferToWav(buffer){
  const channels=2, rate=buffer.sampleRate, frames=buffer.length;
  const bytes=new ArrayBuffer(44+frames*channels*2),v=new DataView(bytes);
  const word=(offset,text)=>{for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i));};
  word(0,"RIFF");v.setUint32(4,36+frames*4,true);word(8,"WAVE");word(12,"fmt ");
  v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,2,true);
  v.setUint32(24,rate,true);v.setUint32(28,rate*4,true);v.setUint16(32,4,true);
  v.setUint16(34,16,true);word(36,"data");v.setUint32(40,frames*4,true);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  let p=44;
  for(let i=0;i<frames;i++)for(const signal of [left[i],right[i]]){
    const x=Math.max(-1,Math.min(1,signal));
    v.setInt16(p,x<0?x*32768:x*32767,true);p+=2;
  }
  return new Blob([bytes],{type:"audio/wav"});
}
function makeRoomImpulse(ctx) {
  const frames=Math.ceil(ctx.sampleRate*.65);
  const impulse=ctx.createBuffer(2,frames,ctx.sampleRate);
  let seed=190871;
  for(let ch=0;ch<2;ch++){
    const data=impulse.getChannelData(ch);
    for(let i=0;i<frames;i++){
      seed=(Math.imul(seed,1664525)+1013904223)>>>0;
      const noise=(seed/4294967296)*2-1;
      const time=i/ctx.sampleRate;
      const onset=Math.min(1,time/.017);
      data[i]=noise*onset*Math.exp(-time*8.8)*.22;
    }
  }
  return impulse;
}
const audio=new DrumAudio();
let isPlaying=false,timer=null,nextTime=0,nextStep=0,visualEvents=[],raf=null,visibleStep=-1;
function paintHead(step) {
  if(visibleStep===step)return;
  visibleStep=step;
  document.querySelectorAll(".pad").forEach(el=>el.classList.toggle("current-step",step>=0&&+el.dataset.col===step));
  document.querySelectorAll("#transportSteps span").forEach((el,i)=>el.classList.toggle("active",i===step));
}
function animatePlayhead(){
  if(!isPlaying||!audio.ctx)return;
  const now=audio.ctx.currentTime;
  while(visualEvents.length&&visualEvents[0].time<=now+.009)paintHead(visualEvents.shift().step);
  raf=requestAnimationFrame(animatePlayhead);
}
function schedule(){
  if(!audio.ctx)return;
  const ahead=audio.ctx.currentTime+.13;
  while(nextTime<ahead){
    const pattern=gridFor(state.playSource);
    for(let r=0;r<SIZE;r++)if(pattern[r][nextStep]>0)audio.trigger(r,pattern[r][nextStep],nextTime);
    visualEvents.push({time:nextTime,step:nextStep});
    nextStep=(nextStep+1)%SIZE;
    nextTime+=60/state.bpm/2;
  }
}
function playbackUi(){
  $("#playIcon").textContent=isPlaying?"Ⅱ":"▶";
  $("#playBtn").classList.toggle("playing",isPlaying);
  $("#playState").textContent=isPlaying?"Reproduciendo matriz "+state.playSource:"Listo para tocar";
}
async function play(){
  try{await audio.ensureContext();}catch(error){notify(error.message);return;}
  if(audio.loaded===0){notify("Todavía no hay sonidos cargados. Espera a que termine la descarga.");return;}
  isPlaying=true;nextTime=audio.ctx.currentTime+.05;nextStep=0;visualEvents=[];
  schedule();timer=setInterval(schedule,25);raf=requestAnimationFrame(animatePlayhead);playbackUi();
}
function stop(){
  isPlaying=false;clearInterval(timer);timer=null;cancelAnimationFrame(raf);
  visualEvents=[];nextStep=0;paintHead(-1);audio.stopVoices();playbackUi();
}
function previewPattern(source){
  state.playSource=source;$("#playSource").value=source;persist();
  if(isPlaying){stop();play();}else play();
}
function count(matrix){return matrix.flat().filter(v=>v>0).length;}
function matrixMarkup(grid,letter,readonly=false) {
  let html='<div></div>';
  for(let col=0;col<SIZE;col++)html+='<div class="step-label '+(col%2===0?'strong-step':'')+'">'+(col+1)+'</div>';
  for(let r=0;r<SIZE;r++){
    const track=INSTRUMENTS[r];
    html+='<div class="row-label" title="'+track.name+'"><i class="row-dot" style="--track-color:'+track.color+'"></i><b>'+track.short+'</b></div>';
    for(let c=0;c<SIZE;c++) {
      const level=grid[r][c];
      html+='<button type="button" class="pad" data-matrix="'+letter+'" data-row="'+r+'" data-col="'+c+'" data-level="'+level+'" title="'+track.name+', paso '+(c+1)+', intensidad '+level+'" aria-label="'+track.name+', paso '+(c+1)+', intensidad '+level+'"'+(readonly?' disabled':'')+'>'+(level||'·')+'</button>';
    }
  }
  return html;
}
function renderMath(){
  derived=calculate(state.A,state.B,state.operation,state.normalization);
  $("#matrixA").innerHTML=matrixMarkup(state.A,"A");
  $("#matrixB").innerHTML=matrixMarkup(state.B,"B");
  $("#matrixC").innerHTML=matrixMarkup(derived.discrete,"C",true);
  $("#countA").textContent=count(state.A)+" golpes";
  $("#countB").textContent=count(state.B)+" golpes";
  $("#countC").textContent=count(derived.discrete)+" golpes activos";
  $("#operationExplanation").textContent=derived.description;
  $("#formula").textContent=derived.formula;
  $("#mathError").hidden=!derived.error;
  $("#mathError").textContent=derived.error||"";
  $("#numericA").textContent=matrixText(toNormalized(state.A));
  $("#numericB").textContent=matrixText(toNormalized(state.B));
  $("#numericC").textContent=matrixText(derived.continuous);
  $("#numericRaw").textContent=matrixText(derived.raw);
  $("#resultDescriptor").textContent="0–3 · "+({peak:"pico relativo",range:"mínimo/máximo",fixed:"escala fija"}[state.normalization]);
  paintHead(-1);
  persist();
}
function handlePad(event,delta=null){
  const button=event.target.closest(".pad");
  if(!button||!button.dataset.row)return;
  if(button.dataset.matrix==="C")return;
  const matrix=button.dataset.matrix,r=+button.dataset.row,c=+button.dataset.col;
  if(event.shiftKey){audio.ensureContext().then(()=>{if(!audio.trigger(r,state[matrix][r][c]))notify("No hay una muestra disponible.");}).catch(e=>notify(e.message));return;}
  const old=state[matrix][r][c];
  const next=(old+(delta===null?1:delta)+4)%4;
  state[matrix][r][c]=next;
  renderMath();
  if(next)audio.ensureContext().then(()=>audio.trigger(r,next)).catch(()=>{});
}
function syncControls(){
  $("#bpmInput").value=state.bpm;$("#playSource").value=state.playSource;
  $("#masterGain").value=state.master;$("#masterValue").textContent=state.master+"%";
  $("#operation").value=state.operation;$("#normalization").value=state.normalization;
  $("#velocityCurve").value=state.velocityCurve;$("#compression").value=state.compression;
  $("#room").value=state.room;$("#roomValue").textContent=state.room+"%";
}
function renderMixer(){
  const opens=new Set([...document.querySelectorAll(".mixer-channel[open]")].map(el=>+el.dataset.track));
  $("#mixer").innerHTML=state.tracks.map((track,i)=>{
    const inst=INSTRUMENTS[i];
    const cats=[...new Set(Object.values(BANK).map(info=>info.category))];
    const options=cats.map(category=>'<optgroup label="'+category+'">'+Object.entries(BANK)
      .filter(([_,info])=>info.category===category)
      .map(([value,info])=>'<option value="'+value+'" '+(track.family===value?'selected':'')+'>'+info.name+'</option>').join("")+'</optgroup>').join("");
    const layers=[1,2,3].map((v)=>'<label>'+["Suave (1)","Media (2)","Fuerte (3)"][v-1]+'<input type="file" accept="audio/*,.wav,.flac,.mp3,.m4a,.ogg" data-custom="'+i+'" data-layer="'+v+'" aria-label="Cargar muestra '+v+' de '+inst.name+'"></label>').join("");
    return '<details class="mixer-channel" data-track="'+i+'" style="--track-color:'+inst.color+'" '+(opens.has(i)?'open':'')+'>'+
      '<summary><i class="mix-dot"></i><strong>'+inst.name+'</strong><button type="button" class="channel-preview" data-preview="'+i+'" title="Escuchar golpe fuerte">♪</button><span class="mix-value" id="mixValue'+i+'">'+track.volume+'%</span><span class="chevron">▾</span></summary>'+
      '<div class="channel-details"><label>SONIDO<select data-field="family" data-track="'+i+'">'+options+'</select></label>'+
      '<label class="range-line">Volumen<input type="range" min="0" max="150" step="1" data-field="volume" data-track="'+i+'" value="'+track.volume+'"><output>'+track.volume+'%</output></label>'+
      '<label class="range-line">Afinación<input type="range" min="-12" max="12" step="1" data-field="tune" data-track="'+i+'" value="'+track.tune+'"><output>'+track.tune+' st</output></label>'+
      '<label class="range-line">Pan L/R<input type="range" min="-100" max="100" step="1" data-field="pan" data-track="'+i+'" value="'+track.pan+'"><output>'+track.pan+'</output></label>'+
      '<label><span><input type="checkbox" data-field="mute" data-track="'+i+'" '+(track.mute?'checked':'')+'> Silenciar canal</span></label>'+
      '<div class="file-layer"><strong>MIS PROPIAS MUESTRAS</strong>'+layers+'<small class="custom-status" id="customStatus'+i+'"></small></div></div></details>';
  }).join("");
}
function updateMixer(event){
  const target=event.target;
  const field=target.dataset.field, i=Number(target.dataset.track);
  if(!field||!Number.isInteger(i)||i<0||i>=SIZE)return;
  state.tracks[i][field]=field==="mute"?target.checked:field==="family"?target.value:Number(target.value);
  if(field==="family") {audio.custom.delete(i);audio.loadFamily(target.value);renderMixer();}
  else {if(target.nextElementSibling?.tagName==="OUTPUT")target.nextElementSibling.textContent=target.value+(field==="volume"?"%":field==="tune"?" st":"");const amount=$("#mixValue"+i);if(amount)amount.textContent=state.tracks[i].volume+"%";}
  audio.applyTrack(i);persist();
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);const a=document.createElement("a");
  a.href=url;a.download=name;document.body.append(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
function downloadProject(){
  const data={...state,format:"algebraic-music-v2",resultRaw:derived.raw,resultContinuous:derived.continuous,resultDiscrete:derived.discrete,
    notice:"Los archivos de audio personalizados no están incluidos en este JSON."};
  downloadBlob(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}),"ALGEBRAIC-MUSIC-proyecto.json");
  notify("Proyecto JSON descargado.");
}
function resetProject(){
  if(!confirm("¿Restaurar la demo inicial? Se reemplazarán tus matrices y controles guardados."))return;
  stop();state=defaultState();audio.custom.clear();syncControls();renderMixer();audio.applyMaster();
  audio.setCompression(state.compression);audio.applyRoom();
  state.tracks.forEach((_,i)=>audio.applyTrack(i));renderMath();audio.loadDefault();notify("Demo restaurada.");
}
function wire(){
  $("#transportSteps").innerHTML=Array.from({length:SIZE},()=>"<span></span>").join("");
  ["A","B"].forEach(m=>{
    const node=$("#matrix"+m);
    node.addEventListener("click",event=>handlePad(event));
    node.addEventListener("contextmenu",event=>{if(event.target.closest(".pad")){event.preventDefault();handlePad(event,-1);}});
  });
  document.querySelectorAll("[data-action]").forEach(button=>button.addEventListener("click",()=>{
    const m=button.dataset.target;
    state[m]=button.dataset.action==="clear"?ZERO():Array.from({length:SIZE},(_,r)=>Array.from({length:SIZE},(_,c)=>Math.random()<([.48,.08,.70,.38,.09,.07,.24,.24][r])?1+Math.floor(Math.random()*3):0));
    renderMath();
  }));
  $("#playBtn").addEventListener("click",()=>isPlaying?stop():play());
  $("#stopBtn").addEventListener("click",stop);
  $("#previewA").addEventListener("click",()=>previewPattern("A"));
  $("#previewB").addEventListener("click",()=>previewPattern("B"));
  $("#previewC").addEventListener("click",()=>previewPattern("C"));
  $("#bpmInput").addEventListener("change",event=>{state.bpm=clampInt(event.target.value,40,240,110);event.target.value=state.bpm;persist();});
  $("#bpmDown").addEventListener("click",()=>{$("#bpmInput").value=clampInt(state.bpm-5,40,240,110);$("#bpmInput").dispatchEvent(new Event("change"));});
  $("#bpmUp").addEventListener("click",()=>{$("#bpmInput").value=clampInt(state.bpm+5,40,240,110);$("#bpmInput").dispatchEvent(new Event("change"));});
  $("#playSource").addEventListener("change",event=>{state.playSource=event.target.value;playbackUi();persist();});
  $("#masterGain").addEventListener("input",event=>{state.master=+event.target.value;$("#masterValue").textContent=state.master+"%";audio.applyMaster();persist();});
  $("#operation").addEventListener("change",event=>{state.operation=event.target.value;renderMath();});
  $("#normalization").addEventListener("change",event=>{state.normalization=event.target.value;renderMath();});
  $("#velocityCurve").addEventListener("change",event=>{state.velocityCurve=event.target.value;persist();});
  $("#compression").addEventListener("change",event=>{state.compression=event.target.value;audio.setCompression(state.compression);persist();});
  $("#room").addEventListener("input",event=>{state.room=+event.target.value;$("#roomValue").textContent=state.room+"%";audio.applyRoom();persist();});
  $("#copyToA").addEventListener("click",()=>{state.A=derived.discrete.map(row=>[...row]);renderMath();notify("C copiada a A.");});
  $("#copyToB").addEventListener("click",()=>{state.B=derived.discrete.map(row=>[...row]);renderMath();notify("C copiada a B.");});
  $("#mixer").addEventListener("input",event=>{if(event.target.dataset.field&&event.target.type==="range")updateMixer(event);});
  $("#mixer").addEventListener("change",async event=>{
    const target=event.target;
    if(target.dataset.custom!==undefined){
      const i=+target.dataset.custom,level=+target.dataset.layer;
      try {await audio.setCustomLayer(i,level,target.files?.[0]);$("#customStatus"+i).textContent="✓ Muestra "+level+" cargada en memoria";notify("Muestra personalizada lista.");}
      catch(error){notify("No se pudo decodificar el archivo: "+error.message);}return;
    }
    if(target.dataset.field&&target.type!=="range")updateMixer(event);
  });
  $("#mixer").addEventListener("click",event=>{
    const btn=event.target.closest("[data-preview]");
    if(!btn)return;event.preventDefault();event.stopPropagation();
    const i=+btn.dataset.preview;
    audio.ensureContext().then(()=>{if(!audio.trigger(i,3))notify("Muestra todavía no disponible.");}).catch(err=>notify(err.message));
  });
  $("#resetMixer").addEventListener("click",()=>{
    state.tracks=initialTracks();audio.custom.clear();renderMixer();
    state.tracks.forEach((t,i)=>{audio.applyTrack(i);audio.loadFamily(t.family);});
    persist();notify("Mezcla restablecida.");
  });
  $("#saveBtn").addEventListener("click",downloadProject);
  $("#openProjectInput").addEventListener("change",async event=>{
    const file=event.target.files?.[0];if(!file)return;
    try {
      const parsed=JSON.parse(await file.text());
      if(!validDiscrete(parsed.A)||!validDiscrete(parsed.B))throw Error("El JSON no contiene matrices 8×8 válidas.");
      stop();state=sanitize(parsed);audio.custom.clear();syncControls();renderMixer();
      state.tracks.forEach((t,i)=>{audio.applyTrack(i);audio.loadFamily(t.family);});
      audio.applyMaster();audio.applyRoom();audio.setCompression(state.compression);renderMath();notify("Proyecto abierto.");
    }catch(error){notify("No se pudo abrir el proyecto: "+error.message);}
    event.target.value="";
  });
  $("#exportWav").addEventListener("click",async()=>{
    const button=$("#exportWav");button.disabled=true;button.textContent="Renderizando WAV…";
    try {
      if(!audio.loaded)throw Error("Espera hasta que se carguen las muestras.");
      const blob=await audio.exportPattern(gridFor(state.playSource),state.bpm);
      downloadBlob(blob,"ALGEBRAIC-MUSIC-"+state.playSource+".wav");notify("Audio WAV exportado.");
    }catch(error){notify("Exportación fallida: "+error.message);}
    finally{button.disabled=false;button.textContent="↓ Exportar patrón WAV (4 compases)";}
  });
  $("#resetAll").addEventListener("click",resetProject);
  const dialog=$("#helpDialog");
  $("#helpBtn").addEventListener("click",()=>dialog.showModal());
  $("#closeHelp").addEventListener("click",()=>dialog.close());
  $("#closeHelpBottom").addEventListener("click",()=>dialog.close());
  dialog.addEventListener("click",event=>{if(event.target===dialog)dialog.close();});
  document.addEventListener("keydown",event=>{
    if(event.code!=="Space"||event.repeat||event.target.matches("input,select,button,textarea")||dialog.open)return;
    event.preventDefault();isPlaying?stop():play();
  });
  window.addEventListener("pagehide",()=>{if(isPlaying)stop();});
}
syncControls();renderMixer();renderMath();wire();
