import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import {
  getDatabase, ref, set, get, update, onValue, runTransaction, remove, onDisconnect
} from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

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
  leaveGameBtn:$("leaveGameBtn"), soundBtn:$("soundBtn"), toast:$("toast"),
  chatToggleBtn:$("chatToggleBtn"), chatUnread:$("chatUnread"), chatPanel:$("chatPanel"),
  chatCloseBtn:$("chatCloseBtn"), chatMessages:$("chatMessages"), chatForm:$("chatForm"), chatInput:$("chatInput")
};

const state = {
  uid:null, roomCode:null, room:null, roomUnsub:null, selectedAvatar:"😎",
  pendingTile:null, sound:true, lastReactionAt:0, roundModalShownFor:null, starting:false,
  chatOpen:false, lastChatCount:0
};

function setView(name){
  ["home","lobby","game"].forEach(v => els[v+"View"].classList.toggle("active", v===name));
}
function toast(msg){
  els.toast.textContent=msg; els.toast.classList.remove("hidden");
  clearTimeout(toast.t); toast.t=setTimeout(()=>els.toast.classList.add("hidden"),2200);
}
function audioContext(){
  return audioContext.ctx || (audioContext.ctx = new (window.AudioContext||window.webkitAudioContext)());
}
function dominoSound(kind="play"){
  if(!state.sound) return;
  try{
    const ac=audioContext(); if(ac.state==="suspended") ac.resume();
    const now=ac.currentTime;
    const makeNoise=(at,dur,gain,low=500,high=4200)=>{
      const len=Math.max(1,Math.floor(ac.sampleRate*dur));
      const buffer=ac.createBuffer(1,len,ac.sampleRate),data=buffer.getChannelData(0);
      for(let i=0;i<len;i++) data[i]=(Math.random()*2-1)*Math.exp(-i/(len*.22));
      const src=ac.createBufferSource(),bp=ac.createBiquadFilter(),g=ac.createGain();
      src.buffer=buffer; bp.type="bandpass"; bp.frequency.value=(low+high)/2; bp.Q.value=.75;
      g.gain.setValueAtTime(gain,at); g.gain.exponentialRampToValueAtTime(.0001,at+dur);
      src.connect(bp);bp.connect(g);g.connect(ac.destination);src.start(at);src.stop(at+dur);
    };
    const thud=(at,freq,gain,dur)=>{
      const o=ac.createOscillator(),g=ac.createGain();o.type="sine";o.frequency.setValueAtTime(freq,at);
      o.frequency.exponentialRampToValueAtTime(Math.max(45,freq*.55),at+dur);
      g.gain.setValueAtTime(gain,at);g.gain.exponentialRampToValueAtTime(.0001,at+dur);
      o.connect(g);g.connect(ac.destination);o.start(at);o.stop(at+dur);
    };
    if(kind==="draw"){
      makeNoise(now,.11,.018,250,1800); makeNoise(now+.045,.06,.012,900,3200); thud(now+.015,95,.018,.08);
    }else if(kind==="error"){
      thud(now,155,.02,.09);
    }else if(kind==="win"){
      thud(now,115,.025,.12); makeNoise(now,.08,.027,700,3600); makeNoise(now+.055,.07,.018,900,4200);
    }else{
      thud(now,105,.035,.11); makeNoise(now,.075,.038,650,4200); makeNoise(now+.018,.055,.024,1200,5200);
    }
  }catch{}
}
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

onAuthStateChanged(auth,u=>{
  if(u){ state.uid=u.uid; els.connectionBadge.textContent="متصل"; els.connectionBadge.className="badge online"; }
  else { els.connectionBadge.textContent="غير متصل"; els.connectionBadge.className="badge offline"; }
});

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
  await ensureAuth();
  for(let tries=0;tries<6;tries++){
    const code=String(Math.floor(100000+Math.random()*900000));
    if((await get(roomRef(code))).exists())continue;
    const data={
      hostUid:state.uid,status:"waiting",createdAt:Date.now(),
      players:{[state.uid]:{name:p.name,avatar:p.avatar,score:0,connected:true,lastSeen:Date.now()}},
      settings:{
        matchMode:els.matchMode?.value||"points",
        targetScore:Number(els.targetScore?.value||151)
      }
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
    const starter=chooseStarter(hands);
    await update(roomRef(),{
      status:"playing",
      game:{round,turn:starter,board:[],stock:deck.slice(14),hands,passes:0,startedAt:Date.now()},
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
  els.lobbyRules.textContent=mode==="single"?"نظام المباراة: جولة واحدة":`نظام المباراة: أول لاعب يصل إلى ${target} نقطة`;
  els.lobbyStatus.textContent=room.guestUid?"اللاعبان جاهزان — جاري بدء الجولة…":"في انتظار اللاعب الثاني…";
}

function renderGame(room){
  const g=room.game||{}, ids=playerIds(room), opp=otherUid(room), me=room.players?.[state.uid]||{}, op=room.players?.[opp]||{};
  els.roundNo.textContent=g.round||1;
  const mode=room.settings?.matchMode||"points",target=room.settings?.targetScore||151;
  els.targetScoreLabel.textContent=mode==="single"?"جولة واحدة":`${target} نقطة`;
  els.scoreRows.innerHTML=ids.map(uid=>`<div class="score-row"><span>${escapeHtml(room.players?.[uid]?.name||"لاعب")}${uid===state.uid?" (أنت)":""}</span><b>${room.players?.[uid]?.score||0}</b></div>`).join("");
  const myHand=normalizeTiles(g.hands?.[state.uid]), oppHand=normalizeTiles(g.hands?.[opp]);
  els.meBar.innerHTML=playerBarHtml(me,myHand.length,"أنت");
  els.opponentBar.innerHTML=playerBarHtml(op,oppHand.length,"صاحبك");
  const myTurn=g.turn===state.uid && room.status==="playing";
  els.turnBanner.textContent=room.status==="roundOver"?"انتهت الجولة":myTurn?"دورك الآن":"دور صاحبك";
  els.turnBanner.style.color=myTurn?"#6dffad":"#fff";

  renderBoard(g.board);
  renderHand(myHand,g.board,myTurn);
  els.stockCount.textContent=normalizeTiles(g.stock).length;
  const hasMove=myHand.some(t=>canPlay(t,g.board));
  els.drawBtn.disabled=!myTurn || hasMove || normalizeTiles(g.stock).length===0;
  els.passBtn.disabled=!myTurn || hasMove || normalizeTiles(g.stock).length>0;
  if(room.reaction && room.reaction.at>state.lastReactionAt){
    state.lastReactionAt=room.reaction.at; showReaction(room.reaction.emoji);
  }
  renderChat(room);
  els.chatToggleBtn.classList.remove("hidden");
  if(room.status==="roundOver"||room.status==="matchOver") showRoundResult(room);
  else { els.roundModal.classList.add("hidden"); state.roundModalShownFor=null; }
}

function playerBarHtml(p,count,label){
  return `<span class="ava">${p.avatar||"😎"}</span><div class="pinfo"><b>${escapeHtml(p.name||"لاعب")} <small>${label}</small></b><small>${count} قطع</small></div><span class="status-dot" style="${p.connected===false?"background:#7d8da0;box-shadow:none":""}"></span>`;
}

function renderBoard(boardRaw){
  const board=normalizeTiles(boardRaw); els.board.innerHTML="";
  if(!board.length){
    const e=document.createElement("div"); e.className="board-empty"; e.textContent="ابدأ أول قطعة"; els.board.appendChild(e); return;
  }
  const mobile=window.innerWidth<=620;
  const perRow=mobile?Math.max(3,Math.floor((window.innerWidth-54)/68)):Math.max(6,Math.floor((els.board.clientWidth||720)/98));
  for(let i=0,rowIndex=0;i<board.length;i+=perRow,rowIndex++){
    const row=document.createElement("div"); row.className=`board-row ${rowIndex%2?"reverse-flow":""}`;
    board.slice(i,i+perRow).forEach(t=>row.appendChild(tileEl(t,true,false)));
    els.board.appendChild(row);
  }
}
function renderHand(hand,board,myTurn){
  els.hand.innerHTML="";
  hand.forEach((t,i)=>{
    const playable=myTurn&&canPlay(t,board), el=tileEl(t,false,playable); el.classList.add("in-hand");
    el.addEventListener("click",()=>selectTile(i,t)); els.hand.appendChild(el);
  });
}
function tileEl(tile,horizontal=false,playable=false){
  const [a,b]=tile.split("-").map(Number); const isDouble=a===b;
  const el=document.createElement("div");
  el.className=`tile${horizontal?" horizontal":""}${playable?" playable":""}${isDouble?" double":""}`;
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
  if(left&&right){state.pendingTile={index,tile};els.sideModal.classList.remove("hidden");}
  else playTile(index,tile,left?"left":"right");
}

function applyRoundOutcome(room,winnerUid,points,reason){
  room.game.winnerUid=winnerUid; room.game.roundPoints=points; room.game.endReason=reason; room.game.endedAt=Date.now();
  if(winnerUid!=="draw"){
    room.players[winnerUid].score=(room.players[winnerUid].score||0)+points;
    const mode=room.settings?.matchMode||"points",target=Number(room.settings?.targetScore||151);
    room.status=(mode==="single" || room.players[winnerUid].score>=target)?"matchOver":"roundOver";
    if(room.status==="matchOver") room.game.matchWinnerUid=winnerUid;
  }else room.status="roundOver";
}

async function playTile(index,tile,side){
  els.sideModal.classList.add("hidden");
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
    hand.splice(index,1); room.game.hands[state.uid]=hand; room.game.passes=0;
    const opp=otherUid(room);
    if(hand.length===0){
      const oppHand=normalizeTiles(room.game.hands?.[opp]),pts=oppHand.reduce((s,t)=>s+pips(t),0);
      applyRoundOutcome(room,state.uid,pts,"empty");
    }else room.game.turn=opp;
    return room;
  });
  if(result.committed){dominoSound("play");state.pendingTile=null;}
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
        const w=mySum<oppSum?state.uid:opp,pts=Math.abs(mySum-oppSum);
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
  els.roundEmoji.textContent=draw?"🤝":meWin?"🏆":"🎯";
  if(matchOver){
    els.roundTitle.textContent=meWin?"أنت كسبت المباراة! 🎉":`${room.players?.[winner]?.name||"صاحبك"} كسب المباراة`;
  }else{
    els.roundTitle.textContent=draw?"تعادل في الجولة":meWin?"أنت كسبت الجولة!":`${room.players?.[winner]?.name||"صاحبك"} كسب الجولة`;
  }
  els.roundText.textContent=draw?"النقاط متساوية بعد قفل اللعب.":`+${g.roundPoints||0} نقطة — ${g.endReason==="blocked"?"الجولة اتقفلت":"أول لاعب خلّص قطعه"}.`;
  if(matchOver && winner!=="draw") els.roundText.textContent+=` النتيجة النهائية: ${room.players?.[winner]?.score||0} نقطة.`;
  els.newRoundBtn.textContent=matchOver?"مباراة جديدة":"جولة جديدة";
  els.newRoundBtn.style.display=room.hostUid===state.uid?"block":"none";
  if(room.hostUid!==state.uid) els.roundText.textContent+=matchOver?" في انتظار منشئ الغرفة يبدأ مباراة جديدة.":" في انتظار منشئ الغرفة يبدأ الجولة التالية.";
  els.roundModal.classList.remove("hidden"); dominoSound(matchOver&&meWin?"win":"play");
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
  if(!state.chatOpen && items.length>state.lastChatCount){
    const diff=items.length-state.lastChatCount;
    els.chatUnread.textContent=String(Math.min(9,diff));
    els.chatUnread.classList.remove("hidden");
  }
  state.lastChatCount=items.length;
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
  state.chatOpen=open; els.chatPanel.classList.toggle("hidden",!open);
  if(open){els.chatUnread.classList.add("hidden");requestAnimationFrame(()=>{els.chatMessages.scrollTop=els.chatMessages.scrollHeight;els.chatInput.focus();});}
}
async function nextRoundOrMatch(){
  els.roundModal.classList.add("hidden");
  if(state.room?.hostUid!==state.uid)return;
  if(state.room?.status==="matchOver"){
    const host=state.room.hostUid,guest=state.room.guestUid;
    await update(roomRef(),{
      status:"waiting",game:null,
      [`players/${host}/score`]:0,[`players/${guest}/score`]:0
    });
  }else await startRound();
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
  state.roomCode=null;state.room=null;state.chatOpen=false;state.lastChatCount=0;
  els.chatPanel.classList.add("hidden");els.chatToggleBtn.classList.add("hidden");els.chatUnread.classList.add("hidden");
  localStorage.removeItem("domino_room");setView("home");
}
async function leaveRoom(){
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
els.leaveLobbyBtn.addEventListener("click",leaveRoom);els.leaveGameBtn.addEventListener("click",leaveRoom);
els.drawBtn.addEventListener("click",drawTile);els.passBtn.addEventListener("click",passTurn);
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
window.addEventListener("resize",()=>{if(state.room?.game)renderBoard(state.room.game.board);});

(async function boot(){
  state.sound=localStorage.getItem("domino_sound")!=="0";els.soundBtn.textContent=state.sound?"🔊":"🔇";
  els.matchMode.value=localStorage.getItem("domino_match_mode")||"points";
  els.targetScore.value=localStorage.getItem("domino_target_score")||"151";
  els.targetWrap.classList.toggle("hidden",els.matchMode.value==="single");
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
        const r=snap.val();
        if(r.hostUid===state.uid||r.guestUid===state.uid)await enterRoom(candidate);
        else if(urlRoom){els.roomCodeInput.value=candidate;els.joinBox.classList.remove("hidden");}
      }
    }
  }catch(err){
    console.error(err);els.homeMessage.textContent="تعذر الاتصال بـ Firebase. تأكد من تفعيل Anonymous Authentication وقواعد Realtime Database.";
  }
})();
