import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, onValue, runTransaction, remove, onDisconnect
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js?v=6.4.0";
import { turnConfig } from "./turn-config.js?v=6.4.0";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
const els = {
  homeView:$("homeView"), lobbyView:$("lobbyView"), gameView:$("gameView"),
  playerName:$("playerName"), avatarPicker:$("avatarPicker"), createRoomBtn:$("createRoomBtn"),
  showJoinBtn:$("showJoinBtn"), joinBox:$("joinBox"), roomCodeInput:$("roomCodeInput"),
  joinRoomBtn:$("joinRoomBtn"), homeMessage:$("homeMessage"), connectionBadge:$("connectionBadge"),
  lobbyRoomCode:$("lobbyRoomCode"), copyCodeBtn:$("copyCodeBtn"), shareRoomBtn:$("shareRoomBtn"),
  lobbyPlayers:$("lobbyPlayers"), lobbyStatus:$("lobbyStatus"), lobbyRules:$("lobbyRules"), leaveLobbyBtn:$("leaveLobbyBtn"),
  matchMode:$("matchMode"), targetScore:$("targetScore"), targetWrap:$("targetWrap"),
  scoreRows:$("scoreRows"), roundNo:$("roundNo"), targetScoreLabel:$("targetScoreLabel"), opponentBar:$("opponentBar"), meBar:$("meBar"),
  board:$("board"), hand:$("hand"), stockCount:$("stockCount"), drawBtn:$("drawBtn"),
  passBtn:$("passBtn"), turnBanner:$("turnBanner"), reactions:$("gameView").querySelector(".reactions"),
  reactionBubble:$("reactionBubble"), sideModal:$("sideModal"), playLeftBtn:$("playLeftBtn"),
  playRightBtn:$("playRightBtn"), cancelSideBtn:$("cancelSideBtn"), roundModal:$("roundModal"),
  roundEmoji:$("roundEmoji"), roundTitle:$("roundTitle"), roundText:$("roundText"),
  newRoundBtn:$("newRoundBtn"), resultHomeBtn:$("resultHomeBtn"), shareInGameBtn:$("shareInGameBtn"),
  leaveGameBtn:$("leaveGameBtn"), soundBtn:$("soundBtn"), toast:$("toast"), gameLayout:$("gameLayout"),
  socialDock:$("socialDock"), chatToggleBtn:$("chatToggleBtn"), chatUnread:$("chatUnread"), chatPreview:$("chatPreview"), chatPanel:$("chatPanel"),
  chatCloseBtn:$("chatCloseBtn"), chatMessages:$("chatMessages"), chatForm:$("chatForm"), chatInput:$("chatInput"),
  voiceCallBtn:$("voiceCallBtn"), voiceCallLabel:$("voiceCallLabel"), voiceActiveBar:$("voiceActiveBar"),
  voiceStatusText:$("voiceStatusText"), voiceMuteBtn:$("voiceMuteBtn"), voiceHangupBtn:$("voiceHangupBtn"),
  voiceIncomingModal:$("voiceIncomingModal"), voiceCallerName:$("voiceCallerName"), voiceAcceptBtn:$("voiceAcceptBtn"),
  voiceDeclineBtn:$("voiceDeclineBtn"), remoteAudio:$("remoteAudio"),
  mobileGameHud:$("mobileGameHud"), mobileOpponentAvatar:$("mobileOpponentAvatar"), mobileOpponentName:$("mobileOpponentName"),
  mobileOpponentCount:$("mobileOpponentCount"), mobileOpponentScore:$("mobileOpponentScore"), mobileRoundLabel:$("mobileRoundLabel"),
  mobileTargetLabel:$("mobileTargetLabel"), mobileMeScore:$("mobileMeScore"), mobileMeName:$("mobileMeName"),
  mobileMeCount:$("mobileMeCount"), mobileMeAvatar:$("mobileMeAvatar"), mobileShareBtn:$("mobileShareBtn"), mobileLeaveBtn:$("mobileLeaveBtn"),
  starterRule:$("starterRule"), blockedScoring:$("blockedScoring"), handSortSelect:$("handSortSelect"),
  historyPanel:$("historyPanel"), historyList:$("historyList"), clearHistoryBtn:$("clearHistoryBtn"),
  installAppBtn:$("installAppBtn"), tableThemeBtn:$("tableThemeBtn"), reconnectBanner:$("reconnectBanner"),
  faithReminderToast:$("faithReminderToast"), faithReminderCloseBtn:$("faithReminderCloseBtn"),
  roundScoreline:$("roundScoreline"), roundProgress:$("roundProgress"), matchStats:$("matchStats")
};

const state = {
  uid:null, roomCode:null, room:null, roomUnsub:null, selectedAvatar:"😎",
  pendingTile:null, sound:true, lastReactionAt:0, roundModalShownFor:null, starting:false,
  chatOpen:false, lastChatCount:0, lastChatAt:0, lastBoardCount:null, lastBoardRound:null,
  peer:null, localStream:null, remoteStream:null, currentCallId:null, incomingCall:null,
  voiceUnsub:null, voiceSignalReady:false, pendingIce:[], seenIce:new Set(), remoteDescriptionSet:false,
  voiceMuted:false, processingVoice:false, dbConnected:false, everConnected:false, installPrompt:null,
  lastSavedMatchKey:null, lastMoveAt:0, roundRevealTimer:null, manualHandOrder:[], suppressTileClickUntil:0,
  dragPlayActive:false, dragTargetSide:null, dragGhost:null
};

function setView(name){
  ["home","lobby","game"].forEach(v => els[v+"View"].classList.toggle("active", v===name));
}
function toast(msg){
  els.toast.textContent=msg; els.toast.classList.remove("hidden");
  clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.add("hidden"),2200);
}
function hideFaithReminder(){
  if(!els.faithReminderToast)return;
  els.faithReminderToast.classList.add("hidden");
  els.faithReminderToast.classList.remove("reminder-enter");
  clearTimeout(hideFaithReminder.t);
}
function maybeShowFaithReminder(room){
  if(!els.faithReminderToast || !room?.game || room.status!=="playing" || Number(room.game.round||0)!==1)return;
  const startedAt=Number(room.game.startedAt||0);if(!startedAt||!state.roomCode)return;
  const key=`domino_faith_reminder_${state.roomCode}_${startedAt}`;
  if(localStorage.getItem(key)==="1")return;
  localStorage.setItem(key,"1");
  els.faithReminderToast.classList.remove("hidden");
  els.faithReminderToast.classList.remove("reminder-enter");
  void els.faithReminderToast.offsetWidth;
  els.faithReminderToast.classList.add("reminder-enter");
  clearTimeout(hideFaithReminder.t);
  hideFaithReminder.t=setTimeout(hideFaithReminder,5200);
}
function vibrateMove(tile){
  try{if(!navigator.vibrate)return;const [a,b]=String(tile||"").split("-");navigator.vibrate(a===b?[24,28,24]:22);}catch{}
}
function setTableTheme(theme){
  theme=theme==="wood"?"wood":"green";document.documentElement.dataset.tableTheme=theme;
  localStorage.setItem("domino_table_theme",theme);
  if(els.tableThemeBtn){els.tableThemeBtn.textContent="🎨";els.tableThemeBtn.title=theme==="wood"?"الطاولة الحالية: خشبي — اضغط للأخضر":"الطاولة الحالية: أخضر — اضغط للخشبي";els.tableThemeBtn.setAttribute("aria-label","تغيير شكل الطاولة");}
}
function cycleTableTheme(){setTableTheme((document.documentElement.dataset.tableTheme||"green")==="green"?"wood":"green");}
function getHistory(){try{return JSON.parse(localStorage.getItem("domino_match_history")||"[]").filter(Boolean).slice(0,10);}catch{return []}}
function renderHistory(){
  if(!els.historyPanel||!els.historyList)return;const items=getHistory();els.historyPanel.classList.toggle("hidden",!items.length);
  els.historyList.innerHTML=items.map(h=>`<article class="history-item"><div><b>${escapeHtml(h.meName||"أنت")} ${h.meScore||0} <span>—</span> ${h.opScore||0} ${escapeHtml(h.opName||"صاحبك")}</b><small>${escapeHtml(h.result||"")} • ${h.rounds||1} جولات • ${new Date(h.at||Date.now()).toLocaleDateString("ar-EG")}</small></div><span class="history-badge">${h.won?"🏆":"🎯"}</span></article>`).join("");
}
function saveMatchHistory(room){
  if(room.status!=="matchOver"||!room.game?.endedAt)return;const key=`${state.roomCode}-${room.game.endedAt}`;
  const items=getHistory();if(items.some(x=>x.key===key))return;const opp=otherUid(room),me=room.players?.[state.uid]||{},op=room.players?.[opp]||{};
  const won=room.game.matchWinnerUid===state.uid;items.unshift({key,at:Date.now(),meName:me.name||"أنت",opName:op.name||"صاحبك",meScore:me.score||0,opScore:op.score||0,won,result:won?"فوز":"خسارة",rounds:room.stats?.rounds||room.game.round||1,target:room.settings?.targetScore||null});
  localStorage.setItem("domino_match_history",JSON.stringify(items.slice(0,10)));state.lastSavedMatchKey=key;renderHistory();
}
function sortHandTiles(hand){
  const mode=els.handSortSelect?.value||localStorage.getItem("domino_hand_sort")||"smart";const arr=[...hand];if(mode==="original")return arr;
  if(mode==="manual"){const alive=new Set(arr);state.manualHandOrder=state.manualHandOrder.filter(t=>alive.has(t));for(const t of arr)if(!state.manualHandOrder.includes(t))state.manualHandOrder.push(t);return [...state.manualHandOrder];}
  const nums=t=>t.split("-").map(Number),isD=t=>{const[a,b]=nums(t);return a===b};
  if(mode==="doubles")return arr.sort((x,y)=>(isD(y)-isD(x))||(pips(y)-pips(x)));
  if(mode==="number")return arr.sort((x,y)=>{const[a,b]=nums(x),[c,d]=nums(y);return Math.max(c,d)-Math.max(a,b)||Math.min(c,d)-Math.min(a,b)});
  return arr.sort((x,y)=>(isD(y)-isD(x))||(Math.max(...nums(y))-Math.max(...nums(x)))||(pips(y)-pips(x)));
}
function enableManualTileDrag(el,tile){
  el.dataset.tile=tile;let startX=0,startY=0,dragging=false;
  el.addEventListener("pointerdown",e=>{if(els.handSortSelect?.value!=="manual")return;startX=e.clientX;startY=e.clientY;dragging=false;el.setPointerCapture?.(e.pointerId);});
  el.addEventListener("pointermove",e=>{
    if(els.handSortSelect?.value!=="manual"||!el.hasPointerCapture?.(e.pointerId)||state.dragPlayActive)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    // Manual rack ordering is intentionally horizontal. Upward/vertical motion is
    // reserved for dragging a playable tile onto the table.
    if(Math.abs(dx)>11 && Math.abs(dx)>Math.abs(dy)*1.15){dragging=true;el.classList.add("hand-dragging");e.preventDefault();}
  });
  el.addEventListener("pointerup",e=>{if(!dragging){try{el.releasePointerCapture?.(e.pointerId)}catch{}return;}const under=document.elementFromPoint(e.clientX,e.clientY)?.closest?.("#hand .tile");const target=under?.dataset?.tile;el.classList.remove("hand-dragging");try{el.releasePointerCapture?.(e.pointerId)}catch{};if(target&&target!==tile){const order=sortHandTiles(normalizeTiles(state.room?.game?.hands?.[state.uid]));const from=order.indexOf(tile),to=order.indexOf(target);if(from>=0&&to>=0){order.splice(from,1);order.splice(to,0,tile);state.manualHandOrder=order;renderHand(normalizeTiles(state.room?.game?.hands?.[state.uid]),state.room?.game?.board,state.room?.status==="playing"&&state.room?.game?.turn===state.uid);}}state.suppressTileClickUntil=Date.now()+350;e.preventDefault();});
}

function clearDropTargets(){
  els.board?.querySelectorAll(".board-drop-zone").forEach(z=>z.classList.remove("is-valid","drag-over","tap-choice"));
  els.hand?.querySelectorAll(".tile.selected-for-play").forEach(t=>t.classList.remove("selected-for-play"));
}
function refreshDropTargets(tile,board,{tapChoice=false}={}){
  clearDropTargets();
  if(!tile)return;
  els.board?.querySelectorAll(".board-drop-zone").forEach(z=>{
    const side=z.dataset.logicalSide||"right";
    const valid=!normalizeTiles(board).length || canPlaySide(tile,board,side);
    z.classList.toggle("is-valid",valid);
    z.classList.toggle("tap-choice",valid&&tapChoice);
  });
}
function dropZoneCenter(zone){const r=zone.getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2,rect:r};}
function nearestDropZone(tile,board,x,y){
  const zones=[...els.board.querySelectorAll(".board-drop-zone")].filter(z=>!normalizeTiles(board).length||canPlaySide(tile,board,z.dataset.logicalSide||"right"));
  if(!zones.length)return null;
  if(!normalizeTiles(board).length){
    const br=els.board.getBoundingClientRect();
    if(x>=br.left&&x<=br.right&&y>=br.top&&y<=br.bottom)return zones[0];
  }
  let best=null,bestD=Infinity;
  for(const z of zones){const c=dropZoneCenter(z),d=Math.hypot(x-c.x,y-c.y);if(d<bestD){best=z;bestD=d;}}
  const mobile=window.matchMedia("(max-width: 620px)").matches;
  return bestD<=(mobile?92:108)?best:null;
}
function makePlayDragGhost(tile){
  const ghost=tileEl(tile,false,true);ghost.classList.add("drag-play-ghost");document.body.appendChild(ghost);return ghost;
}
function positionPlayGhost(ghost,x,y,zone=null,tile=""){
  let gx=x,gy=y;
  ghost.classList.remove("snapped","snap-horizontal");
  if(zone){const c=dropZoneCenter(zone);gx=c.x;gy=c.y;ghost.classList.add("snapped");
    const visual=zone.dataset.visualSide||"right",[a,b]=String(tile).split("-");
    if(a!==b&&(visual==="left"||visual==="right"))ghost.classList.add("snap-horizontal");
  }
  ghost.style.left=`${gx}px`;ghost.style.top=`${gy}px`;
}
function finishPlayDragVisual(ghost,success=false){
  if(!ghost)return;
  ghost.classList.add(success?"drop-success":"drop-cancel");
  setTimeout(()=>ghost.remove(),success?150:180);
}
function enableGameTileDrag(el,tile,index,board,playable){
  if(!playable)return;
  el.classList.add("drag-playable");
  let sx=0,sy=0,mode=false,ghost=null,target=null,pid=null;
  const move=e=>{
    if(pid!==e.pointerId)return;
    const dx=e.clientX-sx,dy=e.clientY-sy;
    if(!mode){
      // A deliberate upward/vertical lift starts table play. Horizontal motion
      // remains available for hand scrolling/manual ordering.
      if(Math.hypot(dx,dy)<9)return;
      if(!(dy<-5 || Math.abs(dy)>Math.abs(dx)*.72))return;
      mode=true;state.dragPlayActive=true;state.suppressTileClickUntil=Date.now()+500;
      ghost=makePlayDragGhost(tile);state.dragGhost=ghost;el.classList.add("play-drag-source");document.body.classList.add("domino-dragging");
      refreshDropTargets(tile,board);
      try{navigator.vibrate?.(12)}catch{}
    }
    e.preventDefault();
    target=nearestDropZone(tile,board,e.clientX,e.clientY);
    els.board.querySelectorAll(".board-drop-zone").forEach(z=>z.classList.toggle("drag-over",z===target));
    state.dragTargetSide=target?.dataset.logicalSide||null;
    positionPlayGhost(ghost,e.clientX,e.clientY,target,tile);
  };
  const end=e=>{
    if(pid!==e.pointerId)return;
    window.removeEventListener("pointermove",move,{capture:true});window.removeEventListener("pointerup",end,{capture:true});window.removeEventListener("pointercancel",cancel,{capture:true});
    try{el.releasePointerCapture?.(e.pointerId)}catch{}
    if(!mode)return;
    e.preventDefault();el.classList.remove("play-drag-source");document.body.classList.remove("domino-dragging");state.dragPlayActive=false;state.dragGhost=null;
    const side=target?.dataset.logicalSide||null;clearDropTargets();state.dragTargetSide=null;
    if(side){finishPlayDragVisual(ghost,true);state.pendingTile=null;try{navigator.vibrate?.([14,18,18])}catch{};playTile(index,tile,side);}
    else{finishPlayDragVisual(ghost,false);toast("سيب القطعة عند الطرف المضيء.");}
  };
  const cancel=e=>{target=null;end(e)};
  el.addEventListener("pointerdown",e=>{
    if(state.dragPlayActive)return;pid=e.pointerId;sx=e.clientX;sy=e.clientY;mode=false;target=null;
    try{el.setPointerCapture?.(e.pointerId)}catch{}
    window.addEventListener("pointermove",move,{capture:true,passive:false});window.addEventListener("pointerup",end,{capture:true,passive:false});window.addEventListener("pointercancel",cancel,{capture:true,passive:false});
  });
}

function chooseStarterByRules(hands,room,randomUid=null,previousWinnerUid=null){
  const rule=room?.settings?.starterRule||"winner";
  if(rule==="winner" && previousWinnerUid && previousWinnerUid!=="draw" && [room.hostUid,room.guestUid].includes(previousWinnerUid)) return previousWinnerUid;
  if(rule==="host")return room.hostUid;
  if(rule==="random")return randomUid||([room.hostUid,room.guestUid].filter(Boolean)[Math.random()<.5?0:1]);
  return chooseStarter(hands);
}
function updateReconnectUi(connected){
  state.dbConnected=connected;
  els.connectionBadge.textContent=connected?"متصل":"غير متصل";els.connectionBadge.className=`badge ${connected?"online":"offline"}`;
  if(!connected&&state.everConnected)els.reconnectBanner?.classList.remove("hidden");else els.reconnectBanner?.classList.add("hidden");
  if(connected&&state.everConnected&&updateReconnectUi.wasOffline)toast("رجع الاتصال — المباراة مستمرة ✅");
  updateReconnectUi.wasOffline=!connected;if(connected)state.everConnected=true;
}
function audioContext(){
  return audioContext.ctx || (audioContext.ctx = new (window.AudioContext||window.webkitAudioContext)());
}
const soundBuffers={};
async function preloadSounds(){
  try{
    const ac=audioContext();
    for(const [kind,url] of Object.entries({play:"./assets/domino-place-real.wav?v=6.4.0",double:"./assets/domino-double-real.wav?v=6.4.0",draw:"./assets/domino-draw-real.wav?v=6.4.0",win:"./assets/domino-win.wav?v=6.4.0"})){
      if(soundBuffers[kind]) continue;
      const res=await fetch(url); if(!res.ok) continue;
      soundBuffers[kind]=await ac.decodeAudioData(await res.arrayBuffer());
    }
  }catch(e){ console.warn("Sound preload failed",e); }
}
function unlockAudio(){
  try{
    const ac=audioContext(); if(ac.state==="suspended") ac.resume(); preloadSounds();
  }catch{}
}
function fallbackDominoSound(kind="play"){
  try{
    const ac=audioContext(),now=ac.currentTime;
    const noise=(at,dur,gain,freq)=>{
      const len=Math.max(1,Math.floor(ac.sampleRate*dur)),buf=ac.createBuffer(1,len,ac.sampleRate),d=buf.getChannelData(0);
      for(let i=0;i<len;i++) d[i]=(Math.random()*2-1)*Math.exp(-i/(len*.12));
      const s=ac.createBufferSource(),f=ac.createBiquadFilter(),g=ac.createGain();s.buffer=buf;f.type="bandpass";f.frequency.value=freq;f.Q.value=1.3;
      g.gain.setValueAtTime(gain,at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);s.connect(f);f.connect(g);g.connect(ac.destination);s.start(at);s.stop(at+dur);
    };
    const ring=(f,at,gain,dur)=>{const o=ac.createOscillator(),g=ac.createGain();o.type="triangle";o.frequency.value=f;g.gain.setValueAtTime(gain,at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);o.connect(g);g.connect(ac.destination);o.start(at);o.stop(at+dur)};
    if(kind==="draw"){noise(now,.07,.05,1100);ring(180,now,.018,.09);}
    else if(kind==="error"){ring(150,now,.02,.08);}
    else{noise(now,.045,.08,1900);ring(145,now,.035,.12);ring(920,now+.004,.018,.045);}
  }catch{}
}
function dominoSound(kind="play"){
  if(!state.sound) return;
  try{
    const ac=audioContext(); if(ac.state==="suspended") ac.resume();
    const key=kind==="win"?"win":kind==="draw"?"draw":kind==="double"?"double":kind==="error"?null:"play";
    if(key&&soundBuffers[key]){
      const playOne=(delay=0,g=.9,rate=1)=>{const src=ac.createBufferSource(),gain=ac.createGain();src.buffer=soundBuffers[key];src.playbackRate.value=rate;gain.gain.value=g;src.connect(gain);gain.connect(ac.destination);src.start(ac.currentTime+delay);};
      playOne(0,kind==="draw"?.82:kind==="double"?.96:.92,1);return;
    }
  }catch{}
  fallbackDominoSound(kind);
}
window.addEventListener("pointerdown",unlockAudio,{once:true,passive:true});
preloadSounds();

function getProfile(){
  return {
    name:(els.playerName.value.trim() || localStorage.getItem("domino_name") || "لاعب").slice(0,18),
    avatar:state.selectedAvatar || localStorage.getItem("domino_avatar") || "😎"
  };
}
function saveProfile(){
  const p=getProfile(); localStorage.setItem("domino_name",p.name); localStorage.setItem("domino_avatar",p.avatar);
}
function normalizeTiles(obj){ return !obj ? [] : Array.isArray(obj) ? obj.filter(Boolean) : Object.values(obj); }
function playerIds(room){ return [room?.hostUid,room?.guestUid].filter(Boolean); }
function otherUid(room){ return playerIds(room).find(id=>id!==state.uid); }
function roomRef(code=state.roomCode){ return ref(db,`rooms/${code}`); }

async function ensureAuth(){
  if(auth.currentUser){ state.uid=auth.currentUser.uid; return; }
  await signInAnonymously(auth); state.uid=auth.currentUser.uid;
}

onAuthStateChanged(auth,u=>{state.uid=u?.uid||null;if(!u)updateReconnectUi(false);});
onValue(ref(db,".info/connected"),snap=>updateReconnectUi(snap.val()===true));

function newDeck(){
  const d=[]; for(let a=0;a<=6;a++) for(let b=a;b<=6;b++) d.push(`${a}-${b}`); return d;
}
function shuffle(arr){
  const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a;
}
function pips(tile){ return tile.split("-").map(Number).reduce((a,b)=>a+b,0); }
function chooseStarter(hands){
  let best={uid:null,val:-1,double:false};
  for(const [uid,tilesRaw] of Object.entries(hands)){
    for(const t of normalizeTiles(tilesRaw)){
      const [a,b]=t.split("-").map(Number), dbl=a===b, val=dbl?100+a:a+b;
      if(val>best.val){best={uid,val,double:dbl};}
    }
  }
  return best.uid || Object.keys(hands)[0];
}
function boardEnds(board){
  const b=normalizeTiles(board); if(!b.length)return {left:null,right:null};
  return {left:Number(b[0].split("-")[0]),right:Number(b[b.length-1].split("-")[1])};
}
function canPlay(tile,board){
  const b=normalizeTiles(board); if(!b.length)return true;
  const [a,bv]=tile.split("-").map(Number), e=boardEnds(b); return a===e.left||bv===e.left||a===e.right||bv===e.right;
}
function canPlaySide(tile,board,side){
  const b=normalizeTiles(board); if(!b.length)return true;
  const [a,bv]=tile.split("-").map(Number), e=boardEnds(b), end=side==="left"?e.left:e.right;
  return a===end||bv===end;
}
function orientTile(tile,board,side){
  const [a,b]=tile.split("-").map(Number), arr=normalizeTiles(board);
  if(!arr.length) return `${a}-${b}`;
  const end=side==="left"?boardEnds(arr).left:boardEnds(arr).right;
  if(side==="left"){
    if(b===end)return `${a}-${b}`;
    if(a===end)return `${b}-${a}`;
  }else{
    if(a===end)return `${a}-${b}`;
    if(b===end)return `${b}-${a}`;
  }
  return tile;
}

async function createRoom(){
  els.homeMessage.textContent="";
  const p=getProfile(); if(!p.name){els.homeMessage.textContent="اكتب اسمك الأول.";return;}
  saveProfile();
  localStorage.setItem("domino_match_mode",els.matchMode?.value||"points");
  localStorage.setItem("domino_target_score",els.targetScore?.value||"151");
  localStorage.setItem("domino_starter_rule",els.starterRule?.value||"winner");
  localStorage.setItem("domino_blocked_scoring",els.blockedScoring?.value||"difference");
  await ensureAuth();
  for(let tries=0;tries<6;tries++){
    const code=String(Math.floor(100000+Math.random()*900000));
    if((await get(roomRef(code))).exists())continue;
    const data={
      hostUid:state.uid,status:"waiting",createdAt:Date.now(),
      players:{[state.uid]:{name:p.name,avatar:p.avatar,score:0,connected:true,lastSeen:Date.now()}},
      settings:{
        matchMode:els.matchMode?.value||"points",
        targetScore:Number(els.targetScore?.value||151),
        starterRule:els.starterRule?.value||"winner",
        blockedScoring:els.blockedScoring?.value||"difference"
      },
      stats:{rounds:0,blockedRounds:0,roundWins:{},biggestRoundPoints:0,biggestRoundUid:""},
      expiresAt:Date.now()+7*24*60*60*1000
    };
    await set(roomRef(code),data); await enterRoom(code); return;
  }
  els.homeMessage.textContent="تعذر إنشاء كود غرفة، جرّب مرة أخرى.";
}

async function joinRoom(code){
  code=(code||"").trim();
  if(!/^\d{6}$/.test(code)){els.homeMessage.textContent="كود الغرفة لازم يكون 6 أرقام.";return;}
  saveProfile(); await ensureAuth();
  const p=getProfile(), rr=roomRef(code);
  const result=await runTransaction(rr,room=>{
    if(!room)return room;
    if(room.hostUid===state.uid || room.guestUid===state.uid)return room;
    if(room.guestUid)return;
    room.guestUid=state.uid;
    room.players=room.players||{};
    room.players[state.uid]={name:p.name,avatar:p.avatar,score:0,connected:true,lastSeen:Date.now()};
    return room;
  });
  if(!result.committed){els.homeMessage.textContent="الغرفة غير موجودة أو مكتملة.";return;}
  const room=result.snapshot.val();
  if(!room){els.homeMessage.textContent="الغرفة غير موجودة.";return;}
  if(room.guestUid!==state.uid && room.hostUid!==state.uid){els.homeMessage.textContent="الغرفة مكتملة بالفعل.";return;}
  await enterRoom(code);
}

async function enterRoom(code){
  state.roomCode=code; localStorage.setItem("domino_room",code);
  const presence=ref(db,`rooms/${code}/players/${state.uid}/connected`);
  await set(presence,true); onDisconnect(presence).set(false);
  if(state.roomUnsub)state.roomUnsub();
  state.roomUnsub=onValue(roomRef(code),snap=>{
    const room=snap.val();
    if(!room){ leaveLocal(); return; }
    state.room=room; renderRoom(room);
    handleVoiceSignal(room.voiceCall).catch(console.warn);
    if(room.hostUid===state.uid && room.guestUid && room.status==="waiting" && !room.game && !state.starting){
      startRound();
    }
  });
}

async function startRound(){
  if(!state.room || state.room.hostUid!==state.uid || !state.room.guestUid || state.starting)return;
  state.starting=true;
  try{
    const deck=shuffle(newDeck()), host=state.room.hostUid, guest=state.room.guestUid;
    const hands={[host]:deck.slice(0,7),[guest]:deck.slice(7,14)};
    const scores={};
    for(const uid of [host,guest]) scores[uid]=state.room.players?.[uid]?.score||0;
    const round=(state.room.game?.round||0)+1;
    const randomUid=Math.random()<.5?host:guest;
    const starter=chooseStarterByRules(hands,state.room,randomUid);
    await update(roomRef(),{
      status:"playing",
      game:{round,turn:starter,board:[],stock:deck.slice(14),hands,passes:0,startedAt:Date.now(),lastMove:null},
      ["stats/rounds"]:round,
      expiresAt:Date.now()+7*24*60*60*1000,
      [`players/${host}/score`]:scores[host],
      [`players/${guest}/score`]:scores[guest]
    });
  }finally{state.starting=false;}
}

function renderRoom(room){
  const inGame=room.status==="playing"||room.status==="roundOver"||room.status==="matchOver";
  if(!room.guestUid){ setView("lobby"); renderLobby(room); }
  else if(inGame){ setView("game"); renderGame(room); }
  else { setView("lobby"); renderLobby(room); }
}

function renderLobby(room){
  els.lobbyRoomCode.textContent=state.roomCode;
  els.lobbyPlayers.innerHTML="";
  for(const uid of playerIds(room)){
    const p=room.players?.[uid]||{};
    const row=document.createElement("div"); row.className="lobby-player";
    row.innerHTML=`<span class="ava">${p.avatar||"😎"}</span><div class="info"><b>${escapeHtml(p.name||"لاعب")}</b><small>${uid===room.hostUid?"منشئ الغرفة":"اللاعب الثاني"}</small></div><span>${p.connected!==false?"🟢":"⚪"}</span>`;
    els.lobbyPlayers.appendChild(row);
  }
  const mode=room.settings?.matchMode||"points", target=room.settings?.targetScore||151;
  const starterLabel={winner:"الفائز بالجولة السابقة",highest:"أعلى دبل",host:"منشئ الغرفة",random:"عشوائي"}[room.settings?.starterRule||"winner"];
  const blockLabel=(room.settings?.blockedScoring||"difference")==="loserTotal"?"مجموع الخاسر":"فرق الأحجار";
  els.lobbyRules.textContent=(mode==="single"?"جولة واحدة":`حتى ${target} نقطة`)+` • البداية: ${starterLabel} • القفل: ${blockLabel}`;
  els.lobbyStatus.textContent=room.guestUid?"اللاعبان جاهزان — جاري بدء الجولة…":"في انتظار اللاعب الثاني…";
}

function renderGame(room){
  const g=room.game||{}, ids=playerIds(room), opp=otherUid(room), me=room.players?.[state.uid]||{}, op=room.players?.[opp]||{};
  els.roundNo.textContent=g.round||1;
  const mode=room.settings?.matchMode||"points",target=room.settings?.targetScore||151;
  els.targetScoreLabel.textContent=mode==="single"?"جولة واحدة":`${target} نقطة`;
  els.scoreRows.innerHTML=ids.map(uid=>`<div class="score-row"><span>${escapeHtml(room.players?.[uid]?.name||"لاعب")}${uid===state.uid?" (أنت)":""}</span><b>${room.players?.[uid]?.score||0}</b></div>`).join("");
  const myHand=normalizeTiles(g.hands?.[state.uid]), oppHand=normalizeTiles(g.hands?.[opp]);
  if(els.mobileGameHud){
    els.mobileOpponentAvatar.textContent=op.avatar||"😎";
    els.mobileOpponentName.textContent=op.name||"صاحبك";
    els.mobileOpponentCount.textContent=`${oppHand.length} قطع`;
    els.mobileOpponentScore.textContent=String(op.score||0);
    els.mobileMeAvatar.textContent=me.avatar||"😎";
    els.mobileMeName.textContent=me.name||"أنت";
    els.mobileMeCount.textContent=`${myHand.length} قطع`;
    els.mobileMeScore.textContent=String(me.score||0);
    els.mobileRoundLabel.textContent=`الجولة ${g.round||1}`;
    els.mobileTargetLabel.textContent=mode==="single"?"جولة واحدة":`إلى ${target}`;
  }
  els.meBar.innerHTML=playerBarHtml(me,myHand.length,"أنت");
  els.opponentBar.innerHTML=playerBarHtml(op,oppHand.length,"صاحبك");
  const myTurn=g.turn===state.uid && room.status==="playing";
  els.turnBanner.textContent=room.status==="matchOver"?"انتهت المباراة":room.status==="roundOver"?"انتهت الجولة":myTurn?"دورك الآن":"دور صاحبك";
  els.turnBanner.style.color=myTurn?"#6dffad":"#fff";

  const boardCount=normalizeTiles(g.board).length;
  if(state.lastBoardRound===g.round && state.lastBoardCount!==null && boardCount>state.lastBoardCount){
    const moved=g.lastMove?.tile||normalizeTiles(g.board)[g.lastMove?.side==="left"?0:boardCount-1];const [ma,mb]=String(moved||"").split("-");
    dominoSound(ma===mb?"double":"play");vibrateMove(moved);
  }
  state.lastBoardRound=g.round; state.lastBoardCount=boardCount;
  renderBoard(g.board,{myTurn,lastMove:g.lastMove});
  renderHand(myHand,g.board,myTurn);
  if(myTurn&&state.pendingTile&&myHand.includes(state.pendingTile.tile)&&canPlay(state.pendingTile.tile,g.board))refreshDropTargets(state.pendingTile.tile,g.board,{tapChoice:true});
  else if(!myTurn||!state.pendingTile||!myHand.includes(state.pendingTile.tile)){state.pendingTile=null;clearDropTargets();}
  if(myTurn&&myHand.some(t=>canPlay(t,g.board))&&localStorage.getItem("domino_drag_coach_v64")!=="1"){
    localStorage.setItem("domino_drag_coach_v64","1");setTimeout(()=>toast("✋ اسحب القطعة للطرف المضيء — من غير اختيار يمين أو شمال."),500);
  }
  els.stockCount.textContent=normalizeTiles(g.stock).length;
  const hasMove=myHand.some(t=>canPlay(t,g.board));
  els.drawBtn.disabled=!myTurn || hasMove || normalizeTiles(g.stock).length===0;
  els.passBtn.disabled=!myTurn || hasMove || normalizeTiles(g.stock).length>0;
  if(room.reaction && room.reaction.at>state.lastReactionAt){
    state.lastReactionAt=room.reaction.at; showReaction(room.reaction.emoji);
  }
  renderChat(room);
  els.socialDock.classList.remove("hidden");
  updateVoiceUi();
  maybeShowFaithReminder(room);
  if(room.status==="roundOver"||room.status==="matchOver") showRoundResult(room);
  else { els.roundModal.classList.add("hidden"); state.roundModalShownFor=null; }
}

function playerBarHtml(p,count,label){
  return `<span class="ava">${p.avatar||"😎"}</span><div class="pinfo"><b>${escapeHtml(p.name||"لاعب")} <small>${label}</small></b><small>${count} قطع</small></div><span class="status-dot" style="${p.connected===false?"background:#7d8da0;box-shadow:none":""}"></span>`;
}

function planBoardLayout(board,width,long){
  const short=Math.round(long*.55),gap=Math.max(1,Math.round(long*.025));
  const margin=Math.max(5,Math.round(short*.24));
  const minX=margin,maxX=width-margin;
  const isDouble=t=>{const [a,b]=t.split("-");return a===b;};
  const extent=t=>isDouble(t)?short:long;
  const total=board.reduce((sum,t)=>sum+extent(t),0)+gap*Math.max(0,board.length-1);
  const segments=[];

  if(total<=maxX-minX){
    const start=(width-total)/2;
    segments.push({row:[...board],turn:null,dir:1,start,used:total,endpoint:start+total,turnCx:null});
  }else{
    let i=0,dir=1,start=minX;
    while(i<board.length){
      const available=dir>0?(maxX-start):(start-minX);
      const row=[];let used=0;
      while(i<board.length){
        const e=extent(board[i]),need=e+(row.length?gap:0),reserve=i<board.length-1?short:0;
        if(row.length && used+need+reserve>available)break;
        if(used+need>available)break;
        row.push(board[i]);used+=need;i++;
      }
      if(!row.length){row.push(board[i]);used=extent(board[i]);i++;}
      const endpoint=start+dir*used;
      let turn=null,turnCx=null;
      if(i<board.length){turn=board[i++];turnCx=endpoint-dir*short/2;}
      segments.push({row,turn,dir,start,used,endpoint,turnCx});
      if(turn){start=turnCx;dir*=-1;}
    }
  }

  const placements=[];let y=null,maxBottom=0,sequenceIndex=0;
  segments.forEach((segment,segmentIndex)=>{
    const rowHalf=segment.row.some(isDouble)?long/2:short/2;
    if(segmentIndex===0)y=margin+rowHalf;
    let x=segment.start;
    for(const tile of segment.row){
      const dbl=isDouble(tile),pathExtent=extent(tile),orientation=dbl?"vertical":"horizontal";
      const cx=x+segment.dir*pathExtent/2,cy=y;
      const w=orientation==="horizontal"?long:short,h=orientation==="horizontal"?short:long;
      placements.push({
        tile,orientation,left:cx-w/2,top:cy-h/2,z:10+sequenceIndex++,
        dir:segment.dir,
        reverseVisual:segment.dir<0 && !dbl,
        entrySide:segment.dir>0?"left":"right",
        exitSide:segment.dir>0?"right":"left"
      });
      maxBottom=Math.max(maxBottom,cy+h/2);x+=segment.dir*(pathExtent+gap);
    }
    if(segment.turn){
      const top=y+rowHalf+gap,cx=segment.turnCx,cy=top+long/2;
      placements.push({
        tile:segment.turn,orientation:"vertical",left:cx-short/2,top,z:10+sequenceIndex++,turn:true,
        dir:0,reverseVisual:false,entrySide:"top",exitSide:"bottom"
      });
      maxBottom=Math.max(maxBottom,top+long);
      if(segmentIndex+1<segments.length){
        const nextHalf=segments[segmentIndex+1].row.some(isDouble)?long/2:short/2;
        y=top+long+gap+nextHalf;
      }
    }
  });
  return {placements,long,short,height:Math.ceil(maxBottom+margin)};
}

function renderBoard(boardRaw,opts={}){
  const board=normalizeTiles(boardRaw);els.board.innerHTML="";els.board.style.removeProperty("height");
  const table=els.board.parentElement;
  const width=Math.max(240,els.board.clientWidth||Math.max(240,(table?.clientWidth||720)-24));
  const mobile=window.matchMedia("(max-width: 620px)").matches;

  if(!board.length){
    const emptyHeight=mobile?Math.max(220,(table?.clientHeight||360)-102):(width<470?250:300);
    els.board.style.height=`${emptyHeight}px`;
    const e=document.createElement("div");e.className="board-empty";e.textContent="اسحب أول قطعة إلى الطاولة";els.board.appendChild(e);
    if(opts.myTurn){const z=document.createElement("div");z.className="board-drop-zone empty-drop-zone";z.dataset.logicalSide="right";z.dataset.visualSide="center";z.setAttribute("aria-label","ضع القطعة هنا");els.board.appendChild(z);}
    return;
  }

  let layout;
  if(mobile){
    const targetHeight=Math.max(220,(table?.clientHeight||360)-102);
    const maxLong=Math.max(46,Math.min(60,Math.round(width/5.7)));
    for(let candidate=maxLong;candidate>=34;candidate-=2){
      const test=planBoardLayout(board,width,candidate);
      layout=test;
      if(test.height<=targetHeight-8)break;
    }
    const offsetY=Math.max(0,Math.round((targetHeight-layout.height)/2));
    layout.placements.forEach(p=>p.top+=offsetY);
    els.board.style.height=`${targetHeight}px`;
  }else{
    const compact=width<470,medium=width<760;
    const long=Math.round(compact?Math.max(50,Math.min(58,width/6)):
                          medium?Math.max(58,Math.min(72,width/7.5)):
                          Math.max(68,Math.min(86,width/9.5)));
    layout=planBoardLayout(board,width,long);
    const minHeight=compact?250:medium?285:320;
    els.board.style.height=`${Math.max(minHeight,layout.height)}px`;
  }

  els.board.style.setProperty("--board-long",`${layout.long}px`);
  els.board.style.setProperty("--board-short",`${layout.short}px`);
  layout.placements.forEach((p,idx)=>{
    // The board array is stored in logical chain order. When a snake row runs
    // right-to-left, the visual halves must be reversed as well or adjacent
    // values look disconnected even though the Firebase state is correct.
    const displayTile=p.reverseVisual?reverseTileForDisplay(p.tile):p.tile;
    const el=tileEl(displayTile,p.orientation,false);el.classList.add("board-piece");if(p.turn)el.classList.add("board-turn");
    el.dataset.chainTile=p.tile;el.dataset.chainDir=String(p.dir||0);
    if(opts.myTurn&&(idx===0||idx===layout.placements.length-1)){
      el.classList.add("open-end");
      const side=idx===0?p.entrySide:p.exitSide;
      el.classList.add(`open-${side}`);
    }
    const lastIdx=opts.lastMove?.side==="left"?0:layout.placements.length-1;if(opts.lastMove&&idx===lastIdx)el.classList.add("last-played");
    el.style.left=`${p.left}px`;el.style.top=`${p.top}px`;el.style.zIndex=String(p.z);els.board.appendChild(el);
  });
  if(opts.myTurn&&layout.placements.length){
    const addZone=(p,logicalSide,visualSide)=>{
      const zone=document.createElement("div");zone.className="board-drop-zone";zone.dataset.logicalSide=logicalSide;zone.dataset.visualSide=visualSide;zone.setAttribute("role","button");zone.setAttribute("aria-label",logicalSide==="left"?"طرف السلسلة الأول":"طرف السلسلة الثاني");
      const w=p.orientation==="horizontal"?layout.long:layout.short,h=p.orientation==="horizontal"?layout.short:layout.long,cx=p.left+w/2,cy=p.top+h/2;
      let x=cx,y=cy;const reach=Math.max(20,Math.round(layout.short*.58));
      if(visualSide==="left")x=p.left-reach*.15;else if(visualSide==="right")x=p.left+w+reach*.15;else if(visualSide==="top")y=p.top-reach*.15;else if(visualSide==="bottom")y=p.top+h+reach*.15;
      zone.style.left=`${x}px`;zone.style.top=`${y}px`;zone.style.setProperty("--drop-zone-size",`${Math.max(54,Math.round(layout.short*1.65))}px`);els.board.appendChild(zone);
    };
    const first=layout.placements[0],last=layout.placements[layout.placements.length-1];
    addZone(first,"left",first.entrySide||"left");addZone(last,"right",last.exitSide||"right");
  }
  requestAnimationFrame(()=>{const el=els.board.querySelector(".last-played");if(!el)return;const r=el.getBoundingClientRect(),tr=table?.getBoundingClientRect();if(tr&&(r.top<tr.top||r.bottom>tr.bottom||r.left<tr.left||r.right>tr.right))el.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});});
}
function renderHand(hand,board,myTurn){
  els.hand.innerHTML="";const visible=sortHandTiles(hand);
  els.hand.style.setProperty("--hand-count",String(Math.max(1,visible.length)));
  els.hand.classList.toggle("many-tiles",visible.length>8);
  visible.forEach((t,i)=>{
    const playable=myTurn&&canPlay(t,board), el=tileEl(t,false,playable);el.classList.add("in-hand");
    if(els.handSortSelect?.value==="manual")el.classList.add("manual-order-mode");
    if(state.pendingTile?.tile===t)el.classList.add("selected-for-play");
    enableManualTileDrag(el,t);enableGameTileDrag(el,t,i,board,playable);
    el.addEventListener("click",()=>{if(Date.now()<state.suppressTileClickUntil)return;selectTile(i,t);});els.hand.appendChild(el);
  });
}
function reverseTileForDisplay(tile){
  const [a,b]=String(tile).split("-");
  return `${b}-${a}`;
}

function tileEl(tile,orientation=false,playable=false){
  const [a,b]=tile.split("-").map(Number); const isDouble=a===b;
  const horizontal=orientation===true||orientation==="horizontal";
  const el=document.createElement("div");
  el.className=`tile${horizontal?" horizontal":""}${playable?" playable":""}${isDouble?" double":""}`;
  el.dataset.orientation=horizontal?"horizontal":"vertical";
  el.setAttribute("aria-label",`${a} - ${b}`);
  el.appendChild(halfEl(a)); el.appendChild(halfEl(b)); return el;
}
const PIP_POS={0:[],1:[5],2:[1,9],3:[1,5,9],4:[1,3,7,9],5:[1,3,5,7,9],6:[1,3,4,6,7,9]};
function halfEl(n){
  const h=document.createElement("div"); h.className="half"; const g=document.createElement("div"); g.className="pip-grid";
  for(let i=1;i<=9;i++){const s=document.createElement("span"); if(PIP_POS[n].includes(i))s.className="pip"; g.appendChild(s);} h.appendChild(g); return h;
}
function selectTile(index,tile){
  const room=state.room,g=room?.game;if(!g||room.status!=="playing"||g.turn!==state.uid)return;
  if(!canPlay(tile,g.board)){toast("القطعة دي مش راكبة حاليًا.");dominoSound("error");return;}
  const board=normalizeTiles(g.board);
  if(!board.length){playTile(index,tile,"right");return;}
  const left=canPlaySide(tile,board,"left"),right=canPlaySide(tile,board,"right");
  if(left&&right){
    state.pendingTile={index,tile};refreshDropTargets(tile,board,{tapChoice:true});
    els.hand.querySelectorAll(".tile").forEach(x=>x.classList.toggle("selected-for-play",x.dataset.tile===tile));
    toast("اسحب القطعة، أو اضغط على الطرف المضيء.");
  }else playTile(index,tile,left?"left":"right");
}

function applyRoundOutcome(room,winnerUid,points,reason){
  room.game.winnerUid=winnerUid; room.game.roundPoints=points; room.game.endReason=reason; room.game.endedAt=Date.now();
  room.stats=room.stats||{rounds:room.game.round||1,blockedRounds:0,roundWins:{},biggestRoundPoints:0,biggestRoundUid:""};
  room.stats.rounds=Math.max(room.stats.rounds||0,room.game.round||1);if(reason==="blocked")room.stats.blockedRounds=(room.stats.blockedRounds||0)+1;
  if(winnerUid!=="draw"){
    room.stats.roundWins=room.stats.roundWins||{};room.stats.roundWins[winnerUid]=(room.stats.roundWins[winnerUid]||0)+1;
    if(points>(room.stats.biggestRoundPoints||0)){room.stats.biggestRoundPoints=points;room.stats.biggestRoundUid=winnerUid;}
    room.players[winnerUid].score=(room.players[winnerUid].score||0)+points;
    const mode=room.settings?.matchMode||"points",target=Number(room.settings?.targetScore||151);
    room.status=(mode==="single" || room.players[winnerUid].score>=target)?"matchOver":"roundOver";
    if(room.status==="matchOver") room.game.matchWinnerUid=winnerUid;
  }else room.status="roundOver";
}

async function playTile(index,tile,side){
  els.sideModal.classList.add("hidden");clearDropTargets();
  const rr=roomRef();
  const result=await runTransaction(rr,room=>{
    if(!room||room.status!=="playing"||room.game?.turn!==state.uid)return;
    const hand=normalizeTiles(room.game.hands?.[state.uid]);
    if(hand[index]!==tile){
      index=hand.indexOf(tile); if(index<0)return;
    }
    if(!canPlaySide(tile,room.game.board,side))return;
    const oriented=orientTile(tile,room.game.board,side), board=normalizeTiles(room.game.board);
    room.game.board=side==="left"?[oriented,...board]:[...board,oriented];
    room.game.lastMove={tile:oriented,side,by:state.uid,at:Date.now()};
    hand.splice(index,1); room.game.hands[state.uid]=hand; room.game.passes=0;
    const opp=otherUid(room);
    if(hand.length===0){
      const oppHand=normalizeTiles(room.game.hands?.[opp]),pts=oppHand.reduce((s,t)=>s+pips(t),0);
      applyRoundOutcome(room,state.uid,pts,"empty");
    }else room.game.turn=opp;
    return room;
  });
  if(result.committed){state.pendingTile=null;}
}

async function drawTile(){
  const rr=roomRef();
  const result=await runTransaction(rr,room=>{
    if(!room||room.status!=="playing"||room.game?.turn!==state.uid)return;
    const hand=normalizeTiles(room.game.hands?.[state.uid]);
    if(hand.some(t=>canPlay(t,room.game.board)))return;
    const stock=normalizeTiles(room.game.stock); if(!stock.length)return;
    hand.push(stock.shift()); room.game.hands[state.uid]=hand; room.game.stock=stock; room.game.passes=0; return room;
  });
  if(result.committed)dominoSound("draw"); else toast("السحب غير متاح حاليًا.");
}

async function passTurn(){
  const rr=roomRef();
  await runTransaction(rr,room=>{
    if(!room||room.status!=="playing"||room.game?.turn!==state.uid)return;
    const hand=normalizeTiles(room.game.hands?.[state.uid]),stock=normalizeTiles(room.game.stock);
    if(stock.length||hand.some(t=>canPlay(t,room.game.board)))return;
    room.game.passes=(room.game.passes||0)+1;
    const opp=otherUid(room);
    if(room.game.passes>=2){
      const mySum=hand.reduce((s,t)=>s+pips(t),0),oppHand=normalizeTiles(room.game.hands?.[opp]),oppSum=oppHand.reduce((s,t)=>s+pips(t),0);
      if(mySum===oppSum) applyRoundOutcome(room,"draw",0,"blocked");
      else{
        const w=mySum<oppSum?state.uid:opp,losingSum=Math.max(mySum,oppSum);
        const pts=(room.settings?.blockedScoring||"difference")==="loserTotal"?losingSum:Math.abs(mySum-oppSum);
        applyRoundOutcome(room,w,pts,"blocked");
      }
    }else room.game.turn=opp;
    return room;
  });
}

function showRoundResult(room){
  const g=room.game||{}, key=`${g.round}-${g.endedAt}-${room.status}`;
  if(state.roundModalShownFor===key)return; state.roundModalShownFor=key;
  const winner=g.winnerUid, draw=winner==="draw", meWin=winner===state.uid,matchOver=room.status==="matchOver";
  const mode=room.settings?.matchMode||"points",target=Number(room.settings?.targetScore||151),ids=playerIds(room);
  els.roundEmoji.textContent=draw?"🤝":meWin?"🏆":"🎯";
  els.roundTitle.textContent=matchOver?(meWin?"أنت كسبت المباراة! 🎉":`${room.players?.[winner]?.name||"صاحبك"} كسب المباراة`):(draw?"تعادل في الجولة":meWin?"أنت كسبت الجولة!":`${room.players?.[winner]?.name||"صاحبك"} كسب الجولة`);
  els.roundText.textContent=draw?"النقاط متساوية بعد قفل اللعب.":`+${g.roundPoints||0} نقطة — ${g.endReason==="blocked"?"الجولة اتقفلت":"أول لاعب خلّص قطعه"}.`;
  els.roundScoreline.innerHTML=ids.map(uid=>`<div><span>${escapeHtml(room.players?.[uid]?.name||"لاعب")}${uid===state.uid?" • أنت":""}</span><b>${room.players?.[uid]?.score||0}</b></div>`).join("");
  els.roundProgress.innerHTML=mode==="single"?"":ids.map(uid=>{const score=room.players?.[uid]?.score||0,pct=Math.max(0,Math.min(100,Math.round(score/target*100)));return `<div class="progress-row"><span>${escapeHtml(room.players?.[uid]?.name||"لاعب")}</span><i><em style="width:${pct}%"></em></i><small>${score}/${target}</small></div>`}).join("");
  const stats=room.stats||{};
  if(matchOver){
    saveMatchHistory(room);const bigName=room.players?.[stats.biggestRoundUid]?.name||"—";
    els.matchStats.innerHTML=`<div><b>${stats.rounds||g.round||1}</b><span>جولات</span></div><div><b>${stats.blockedRounds||0}</b><span>مرات قفل</span></div><div><b>${stats.biggestRoundPoints||0}</b><span>أكبر جولة • ${escapeHtml(bigName)}</span></div>`;els.matchStats.classList.remove("hidden");
  }else els.matchStats.classList.add("hidden");
  if(!matchOver&&mode==="points")els.roundText.textContent+=` اللعب مستمر لحد ${target}.`;
  els.newRoundBtn.textContent=matchOver?"مباراة جديدة":"الجولة التالية";els.resultHomeBtn.classList.toggle("hidden",!matchOver);
  clearTimeout(state.roundRevealTimer);els.newRoundBtn.classList.add("round-next-waiting");els.newRoundBtn.disabled=true;
  state.roundRevealTimer=setTimeout(()=>{els.newRoundBtn.classList.remove("round-next-waiting");els.newRoundBtn.disabled=false;},matchOver?900:1500);
  els.roundModal.classList.remove("hidden");dominoSound(matchOver&&meWin?"win":"play");
}

async function sendReaction(emoji){
  if(!state.roomCode)return; await update(roomRef(),{reaction:{emoji,by:state.uid,at:Date.now()}});
}
function showReaction(emoji){
  els.reactionBubble.textContent=emoji; els.reactionBubble.classList.remove("hidden");
  clearTimeout(showReaction.t); showReaction.t=setTimeout(()=>els.reactionBubble.classList.add("hidden"),1600);
}

function chatItems(room){
  return Object.values(room.chat||{}).filter(Boolean).sort((a,b)=>(a.at||0)-(b.at||0)).slice(-60);
}
function renderChat(room){
  const items=chatItems(room);
  const latest=items[items.length-1];
  if(latest && state.lastChatAt && (latest.at||0)>state.lastChatAt && latest.uid!==state.uid && !state.chatOpen){
    const sender=escapeHtml(latest.name||"صاحبك");
    els.chatPreview.innerHTML=`<b>${sender}</b><span>${escapeHtml(latest.text||"")}</span>`;
    els.chatPreview.classList.remove("hidden");
    clearTimeout(renderChat.previewTimer);
    renderChat.previewTimer=setTimeout(()=>els.chatPreview.classList.add("hidden"),3200);
  }
  if(!state.chatOpen && items.length>state.lastChatCount){
    const diff=items.length-state.lastChatCount;
    els.chatUnread.textContent=String(Math.min(9,diff));
    els.chatUnread.classList.remove("hidden");
  }
  state.lastChatCount=items.length;
  if(latest) state.lastChatAt=Math.max(state.lastChatAt,latest.at||0);
  els.chatMessages.innerHTML=items.map(m=>{
    const mine=m.uid===state.uid;
    return `<div class="chat-msg ${mine?"mine":"theirs"}"><small>${mine?"أنت":escapeHtml(m.name||"صاحبك")}</small><div>${escapeHtml(m.text||"")}</div></div>`;
  }).join("") || '<div class="chat-empty">ابدأوا الكلام 👋</div>';
  if(state.chatOpen) requestAnimationFrame(()=>{els.chatMessages.scrollTop=els.chatMessages.scrollHeight;});
}
async function sendChat(text){
  text=(text||"").trim().slice(0,180); if(!text||!state.roomCode)return;
  const key=`${Date.now()}_${state.uid.slice(0,6)}_${Math.random().toString(36).slice(2,6)}`;
  const p=state.room?.players?.[state.uid]||getProfile();
  await set(ref(db,`rooms/${state.roomCode}/chat/${key}`),{uid:state.uid,name:p.name||"لاعب",text,at:Date.now()});
  els.chatInput.value=""; dominoSound("draw");
}
function setChatOpen(open){
  state.chatOpen=open;
  els.chatPanel.classList.toggle("hidden",!open);
  els.gameLayout?.classList.toggle("chat-open",open);
  if(open){
    els.chatUnread.classList.add("hidden");
    els.chatPreview.classList.add("hidden");
    requestAnimationFrame(()=>{els.chatMessages.scrollTop=els.chatMessages.scrollHeight;els.chatInput.focus();});
  }
}

const DEFAULT_ICE_SERVERS=[{urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302","stun:stun2.l.google.com:19302"]}];
let cachedRtcConfig=null;
async function getRtcConfig(){
  if(cachedRtcConfig)return cachedRtcConfig;
  const extra=Array.isArray(turnConfig?.iceServers)?turnConfig.iceServers.filter(s=>s&&s.urls):[];
  const hasTurn=extra.some(s=>{
    const urls=Array.isArray(s.urls)?s.urls:[s.urls];
    return urls.some(u=>typeof u==="string" && (u.startsWith("turn:")||u.startsWith("turns:")));
  });
  state.turnAvailable=hasTurn;
  cachedRtcConfig={
    iceServers:[...DEFAULT_ICE_SERVERS,...extra],
    iceCandidatePoolSize:1,
    iceTransportPolicy:"all"
  };
  return cachedRtcConfig;
}
function voiceCallRef(){return ref(db,`rooms/${state.roomCode}/voiceCall`);}
function voiceCandidateRef(uid,key){return ref(db,`rooms/${state.roomCode}/voiceCall/candidates/${uid}/${key}`);}
function updateVoiceUi(){
  const hasOpponent=!!otherUid(state.room||{});
  els.voiceCallBtn.disabled=!hasOpponent || !!state.currentCallId;
  els.voiceCallLabel.textContent=state.currentCallId?"مشغول":"اتصال";
  els.voiceActiveBar.classList.toggle("hidden",!state.currentCallId);
  if(!state.currentCallId) els.voiceStatusText.textContent="غير متصل صوتيًا";
  els.voiceMuteBtn.textContent=state.voiceMuted?"🔇":"🎙️";
  els.voiceMuteBtn.title=state.voiceMuted?"إلغاء الكتم":"كتم الميكروفون";
}
async function ensureMicrophone(){
  if(state.localStream && state.localStream.active) return state.localStream;
  if(!navigator.mediaDevices?.getUserMedia) throw new Error("المتصفح لا يدعم استخدام الميكروفون.");
  state.localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});
  return state.localStream;
}
function serializeDescription(desc){return {type:desc.type,sdp:desc.sdp};}
function serializeCandidate(c){return c.toJSON?c.toJSON():{candidate:c.candidate,sdpMid:c.sdpMid,sdpMLineIndex:c.sdpMLineIndex,usernameFragment:c.usernameFragment||null};}
async function writeIceCandidate(cand){
  if(!state.roomCode||!state.currentCallId)return;
  const key=`${Date.now()}_${Math.random().toString(36).slice(2,8)}`;
  await set(voiceCandidateRef(state.uid,key),serializeCandidate(cand));
}
async function flushPendingIce(){
  if(!state.voiceSignalReady)return;
  const q=[...state.pendingIce];state.pendingIce=[];
  for(const c of q){try{await writeIceCandidate(c);}catch(e){console.warn("ICE write",e);}}
}
async function createVoicePeer(){
  if(state.peer) try{state.peer.close();}catch{}
  state.seenIce=new Set();state.remoteDescriptionSet=false;state.pendingIce=[];state.voiceSignalReady=false;
  const pc=new RTCPeerConnection(await getRtcConfig());state.peer=pc;
  const stream=await ensureMicrophone();stream.getTracks().forEach(t=>pc.addTrack(t,stream));
  state.remoteStream=new MediaStream();els.remoteAudio.srcObject=state.remoteStream;
  pc.ontrack=e=>{for(const track of (e.streams?.[0]?.getTracks?.()||[e.track])) if(!state.remoteStream.getTracks().some(t=>t.id===track.id)) state.remoteStream.addTrack(track); els.remoteAudio.play().catch(()=>{});};
  pc.onicecandidate=e=>{if(!e.candidate)return;if(state.voiceSignalReady)writeIceCandidate(e.candidate).catch(console.warn);else state.pendingIce.push(e.candidate);};
  pc.onconnectionstatechange=()=>{
    const s=pc.connectionState;
    if(s==="connected") els.voiceStatusText.textContent="متصل صوتيًا ✅";
    else if(s==="connecting") els.voiceStatusText.textContent="جاري توصيل الصوت…";
    else if(s==="failed"){els.voiceStatusText.textContent="تعذر الاتصال الصوتي";toast(state.turnAvailable?"تعذر الاتصال الصوتي. جرّب إنهاء المكالمة ثم الاتصال من جديد.":"تعذر العثور على خادم TURN للاتصال عبر بيانات الهاتف.");}
    else if(s==="disconnected") els.voiceStatusText.textContent="انقطع الصوت مؤقتًا…";
  };
  return pc;
}
async function addRemoteCandidates(call){
  if(!state.peer||!call?.candidates)return;
  const remoteUid=state.uid===call.callerUid?call.calleeUid:call.callerUid;
  const candidates=call.candidates?.[remoteUid]||{};
  for(const [key,c] of Object.entries(candidates)){
    if(state.seenIce.has(key))continue;
    try{await state.peer.addIceCandidate(new RTCIceCandidate(c));state.seenIce.add(key);}catch(e){console.warn("ICE add",e);}
  }
}
async function startVoiceCall(){
  if(state.currentCallId||!state.roomCode)return;
  const callee=otherUid(state.room||{});if(!callee){toast("استنى صاحبك يدخل الغرفة الأول.");return;}
  try{
    els.voiceCallLabel.textContent="جاري…";await ensureMicrophone();
    const id=`${Date.now()}_${state.uid.slice(0,6)}`;state.currentCallId=id;
    const pc=await createVoicePeer();
    const offer=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription(offer);
    await set(voiceCallRef(),{id,callerUid:state.uid,calleeUid:callee,status:"ringing",offer:serializeDescription(pc.localDescription),createdAt:Date.now()});
    state.voiceSignalReady=true;await flushPendingIce();
    els.voiceStatusText.textContent="بيرن عند صاحبك…";updateVoiceUi();
  }catch(e){console.error(e);cleanupVoice(false);toast(e.name==="NotAllowedError"?"اسمح باستخدام الميكروفون علشان الشات الصوتي يشتغل.":"تعذر بدء المكالمة الصوتية.");}
}
async function acceptVoiceCall(){
  const call=state.incomingCall;if(!call||state.processingVoice)return;state.processingVoice=true;
  try{
    els.voiceIncomingModal.classList.add("hidden");await ensureMicrophone();state.currentCallId=call.id;
    const pc=await createVoicePeer();state.currentCallId=call.id;
    await pc.setRemoteDescription(new RTCSessionDescription(call.offer));state.remoteDescriptionSet=true;
    await addRemoteCandidates(call);
    const answer=await pc.createAnswer();await pc.setLocalDescription(answer);
    await update(voiceCallRef(),{answer:serializeDescription(pc.localDescription),status:"answered",answeredAt:Date.now()});
    state.voiceSignalReady=true;await flushPendingIce();state.incomingCall=null;els.voiceStatusText.textContent="جاري توصيل الصوت…";updateVoiceUi();
  }catch(e){console.error(e);cleanupVoice(false);toast(e.name==="NotAllowedError"?"لازم تسمح باستخدام الميكروفون.":"تعذر قبول المكالمة.");}
  finally{state.processingVoice=false;}
}
async function declineVoiceCall(){
  const call=state.incomingCall;els.voiceIncomingModal.classList.add("hidden");state.incomingCall=null;
  if(call?.id)try{await update(voiceCallRef(),{status:"declined",endedAt:Date.now()});}catch{}
}
async function handleVoiceSignal(call){
  if(state.processingVoice)return;
  if(!call){if(state.currentCallId||state.incomingCall)cleanupVoice(true);return;}
  if(call.status==="ringing" && call.calleeUid===state.uid && !state.currentCallId){
    state.incomingCall=call;els.voiceCallerName.textContent=state.room?.players?.[call.callerUid]?.name||"صاحبك";els.voiceIncomingModal.classList.remove("hidden");return;
  }
  if(call.status==="declined" && call.callerUid===state.uid){toast("صاحبك رفض المكالمة.");cleanupVoice(false);return;}
  if(call.status==="ended"){if(state.currentCallId)toast("تم إنهاء المكالمة.");cleanupVoice(true);return;}
  if(state.currentCallId!==call.id||!state.peer)return;
  if(call.callerUid===state.uid && call.answer && !state.remoteDescriptionSet){
    try{await state.peer.setRemoteDescription(new RTCSessionDescription(call.answer));state.remoteDescriptionSet=true;els.voiceStatusText.textContent="جاري توصيل الصوت…";}catch(e){console.warn("answer",e);}
  }
  await addRemoteCandidates(call);
}
function toggleVoiceMute(){
  if(!state.localStream)return;state.voiceMuted=!state.voiceMuted;
  state.localStream.getAudioTracks().forEach(t=>t.enabled=!state.voiceMuted);updateVoiceUi();toast(state.voiceMuted?"تم كتم الميكروفون":"تم تشغيل الميكروفون");
}
async function hangupVoice(writeSignal=true){
  if(writeSignal&&state.roomCode&&state.currentCallId){try{await update(voiceCallRef(),{status:"ended",endedBy:state.uid,endedAt:Date.now()});}catch{}}
  cleanupVoice(false);
}
function cleanupVoice(hideIncoming=true){
  try{state.peer?.close();}catch{} state.peer=null;
  state.localStream?.getTracks().forEach(t=>t.stop());state.localStream=null;
  state.remoteStream?.getTracks().forEach(t=>t.stop());state.remoteStream=null;els.remoteAudio.srcObject=null;
  state.currentCallId=null;state.voiceSignalReady=false;state.pendingIce=[];state.seenIce=new Set();state.remoteDescriptionSet=false;state.voiceMuted=false;
  if(hideIncoming){state.incomingCall=null;els.voiceIncomingModal.classList.add("hidden");}
  updateVoiceUi();
}

async function nextRoundOrMatch(){
  if(!state.roomCode||!state.room)return;
  els.newRoundBtn.disabled=true;
  const deck=shuffle(newDeck()),fixedRandomUid=Math.random()<.5?state.room.hostUid:state.room.guestUid;
  try{
    const result=await runTransaction(roomRef(),room=>{
      if(!room || (room.hostUid!==state.uid && room.guestUid!==state.uid))return;
      const previousStatus=room.status;
      if(previousStatus!=="roundOver" && previousStatus!=="matchOver")return;
      const host=room.hostUid,guest=room.guestUid;
      if(!host||!guest)return;
      if(previousStatus==="matchOver"){
        room.players[host].score=0;room.players[guest].score=0;
        room.stats={rounds:0,blockedRounds:0,roundWins:{},biggestRoundPoints:0,biggestRoundUid:""};
      }
      const previousWinnerUid=previousStatus==="roundOver"?room.game?.winnerUid:null;
      const hands={[host]:deck.slice(0,7),[guest]:deck.slice(7,14)};
      const round=previousStatus==="matchOver"?1:(room.game?.round||0)+1;
      const nextStarter=chooseStarterByRules(hands,room,fixedRandomUid,previousWinnerUid);
      room.status="playing";room.stats=room.stats||{};room.stats.rounds=round;room.expiresAt=Date.now()+7*24*60*60*1000;
      room.game={round,turn:nextStarter,board:[],stock:deck.slice(14),hands,passes:0,startedAt:Date.now(),lastMove:null};
      return room;
    });
    if(result.committed){
      els.roundModal.classList.add("hidden");state.roundModalShownFor=null;dominoSound("draw");
    }else toast("الجولة التالية بدأت بالفعل على الجهاز الآخر.");
  }catch(e){console.error(e);toast("تعذر بدء الجولة التالية. جرّب مرة أخرى.");}
  finally{els.newRoundBtn.disabled=false;}
}

async function shareRoom(){
  const url=new URL(location.href); url.searchParams.set("room",state.roomCode);
  const text=`العب معايا دومنو الصحبة — كود الغرفة ${state.roomCode}`;
  if(navigator.share){try{await navigator.share({title:"دومنو الصحبة",text,url:url.href});return;}catch{}}
  await navigator.clipboard.writeText(url.href); toast("تم نسخ رابط الغرفة.");
}
async function copyCode(){await navigator.clipboard.writeText(state.roomCode);toast("تم نسخ الكود.");}
function leaveLocal(){
  if(state.roomUnsub){state.roomUnsub();state.roomUnsub=null;}
  cleanupVoice();
  state.roomCode=null;state.room=null;state.chatOpen=false;state.pendingTile=null;clearDropTargets();state.lastChatCount=0;state.lastChatAt=0;state.lastBoardCount=null;state.lastBoardRound=null;
  els.chatPanel.classList.add("hidden");els.gameLayout?.classList.remove("chat-open");els.chatPreview.classList.add("hidden");els.socialDock.classList.add("hidden");els.chatUnread.classList.add("hidden");
  localStorage.removeItem("domino_room");setView("home");
}
async function leaveRoom(){
  if(state.currentCallId) await hangupVoice(true);
  if(state.roomCode&&state.uid){
    try{
      await update(ref(db,`rooms/${state.roomCode}/players/${state.uid}`),{connected:false,lastSeen:Date.now()});
    }catch{}
  }
  leaveLocal();
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}

els.avatarPicker.addEventListener("click",e=>{
  const b=e.target.closest("button[data-avatar]");if(!b)return;state.selectedAvatar=b.dataset.avatar;
  [...els.avatarPicker.querySelectorAll("button")].forEach(x=>x.classList.toggle("selected",x===b));
});
els.createRoomBtn.addEventListener("click",createRoom);
els.showJoinBtn.addEventListener("click",()=>els.joinBox.classList.toggle("hidden"));
els.joinRoomBtn.addEventListener("click",()=>joinRoom(els.roomCodeInput.value));
els.roomCodeInput.addEventListener("keydown",e=>{if(e.key==="Enter")joinRoom(els.roomCodeInput.value);});
els.copyCodeBtn.addEventListener("click",copyCode);els.shareRoomBtn.addEventListener("click",shareRoom);els.shareInGameBtn.addEventListener("click",shareRoom);
if(els.mobileShareBtn)els.mobileShareBtn.addEventListener("click",shareRoom);
els.leaveLobbyBtn.addEventListener("click",leaveRoom);els.leaveGameBtn.addEventListener("click",leaveRoom);
if(els.mobileLeaveBtn)els.mobileLeaveBtn.addEventListener("click",leaveRoom);
els.drawBtn.addEventListener("click",drawTile);els.passBtn.addEventListener("click",passTurn);
els.board.addEventListener("click",e=>{const z=e.target.closest?.(".board-drop-zone.is-valid");if(!z||!state.pendingTile)return;const p=state.pendingTile,side=z.dataset.logicalSide||"right";if(canPlaySide(p.tile,state.room?.game?.board,side)){state.pendingTile=null;playTile(p.index,p.tile,side);}});
els.playLeftBtn.addEventListener("click",()=>state.pendingTile&&playTile(state.pendingTile.index,state.pendingTile.tile,"left"));
els.playRightBtn.addEventListener("click",()=>state.pendingTile&&playTile(state.pendingTile.index,state.pendingTile.tile,"right"));
els.cancelSideBtn.addEventListener("click",()=>{state.pendingTile=null;els.sideModal.classList.add("hidden");});
els.newRoundBtn.addEventListener("click",nextRoundOrMatch);
els.resultHomeBtn.addEventListener("click",leaveRoom);
els.reactions.addEventListener("click",e=>{const b=e.target.closest("button");if(b)sendReaction(b.textContent.trim());});
els.soundBtn.addEventListener("click",()=>{state.sound=!state.sound;els.soundBtn.textContent=state.sound?"🔊":"🔇";localStorage.setItem("domino_sound",state.sound?"1":"0");});
els.matchMode.addEventListener("change",()=>{els.targetWrap.classList.toggle("hidden",els.matchMode.value==="single");});
els.chatToggleBtn.addEventListener("click",()=>setChatOpen(!state.chatOpen));
els.chatCloseBtn.addEventListener("click",()=>setChatOpen(false));
els.chatForm.addEventListener("submit",e=>{e.preventDefault();sendChat(els.chatInput.value);});
els.voiceCallBtn.addEventListener("click",startVoiceCall);
els.voiceAcceptBtn.addEventListener("click",acceptVoiceCall);
els.voiceDeclineBtn.addEventListener("click",declineVoiceCall);
els.voiceMuteBtn.addEventListener("click",toggleVoiceMute);
els.voiceHangupBtn.addEventListener("click",()=>hangupVoice(true));
els.handSortSelect?.addEventListener("change",()=>{localStorage.setItem("domino_hand_sort",els.handSortSelect.value);if(els.handSortSelect.value==="manual")state.manualHandOrder=normalizeTiles(state.room?.game?.hands?.[state.uid]);if(state.room?.game)renderHand(normalizeTiles(state.room.game.hands?.[state.uid]),state.room.game.board,state.room.status==="playing"&&state.room.game.turn===state.uid);});
els.tableThemeBtn?.addEventListener("click",cycleTableTheme);
els.faithReminderCloseBtn?.addEventListener("click",hideFaithReminder);
els.clearHistoryBtn?.addEventListener("click",()=>{localStorage.removeItem("domino_match_history");renderHistory();toast("تم مسح سجل المباريات.");});
els.installAppBtn?.addEventListener("click",async()=>{if(!state.installPrompt)return;state.installPrompt.prompt();try{await state.installPrompt.userChoice;}catch{}state.installPrompt=null;els.installAppBtn.classList.add("hidden");});
window.addEventListener("beforeinstallprompt",e=>{e.preventDefault();state.installPrompt=e;if(!window.matchMedia("(display-mode: standalone)").matches)els.installAppBtn?.classList.remove("hidden");});
window.addEventListener("appinstalled",()=>{state.installPrompt=null;els.installAppBtn?.classList.add("hidden");toast("تم تثبيت دومنو الصحبة ✅");});
window.addEventListener("resize",()=>{if(state.room?.game)renderBoard(state.room.game.board,{myTurn:state.room.status==="playing"&&state.room.game.turn===state.uid,lastMove:state.room.game.lastMove});});

(async function boot(){
  state.sound=localStorage.getItem("domino_sound")!=="0";els.soundBtn.textContent=state.sound?"🔊":"🔇";
  els.matchMode.value=localStorage.getItem("domino_match_mode")||"points";
  els.targetScore.value=localStorage.getItem("domino_target_score")||"151";
  if(els.starterRule){
    if(localStorage.getItem("domino_starter_rule_version")!=="6.3"){localStorage.setItem("domino_starter_rule","winner");localStorage.setItem("domino_starter_rule_version","6.3");}
    els.starterRule.value=localStorage.getItem("domino_starter_rule")||"winner";
  }
  if(els.blockedScoring)els.blockedScoring.value=localStorage.getItem("domino_blocked_scoring")||"difference";
  if(els.handSortSelect)els.handSortSelect.value=localStorage.getItem("domino_hand_sort")||"smart";
  setTableTheme(localStorage.getItem("domino_table_theme")||"green");renderHistory();
  els.targetWrap.classList.toggle("hidden",els.matchMode.value==="single");
  if("serviceWorker" in navigator)navigator.serviceWorker.register("./service-worker.js?v=6.4.0").catch(console.warn);
  const n=localStorage.getItem("domino_name");if(n)els.playerName.value=n;
  const a=localStorage.getItem("domino_avatar")||"😎";state.selectedAvatar=a;
  [...els.avatarPicker.querySelectorAll("button")].forEach(x=>x.classList.toggle("selected",x.dataset.avatar===a));
  try{
    await ensureAuth();
    const urlRoom=new URL(location.href).searchParams.get("room"),saved=localStorage.getItem("domino_room");
    const candidate=urlRoom||saved;
    if(candidate&&/^\d{6}$/.test(candidate)){
      const snap=await get(roomRef(candidate));
      if(snap.exists()){
        const r=snap.val(),mine=r.hostUid===state.uid||r.guestUid===state.uid;
        if(mine && r.expiresAt && Date.now()>Number(r.expiresAt)){try{await remove(roomRef(candidate));}catch{}localStorage.removeItem("domino_room");toast("تم تنظيف غرفة قديمة من الجهاز.");}
        else if(mine)await enterRoom(candidate);
        else if(urlRoom){els.roomCodeInput.value=candidate;els.joinBox.classList.remove("hidden");}
      }
    }
  }catch(err){
    console.error(err);els.homeMessage.textContent="تعذر الاتصال بـ Firebase. تأكد من تفعيل Anonymous Authentication وقواعد Realtime Database.";
  }
})();
