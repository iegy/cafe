import { ref, set, update, remove, get } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { turnConfig } from "./turn-config.js?v=8.0.0";

const $=id=>document.getElementById(id);
export function createSocial({db,state,getProfile,toast}){
  const el={
    chatToggle:$('chatToggleBtn'),chatUnread:$('chatUnread'),chatPanel:$('chatPanel'),chatClose:$('chatCloseBtn'),chatMessages:$('chatMessages'),chatForm:$('chatForm'),chatInput:$('chatInput'),
    voiceBtn:$('voiceCallBtn'),voiceLabel:$('voiceCallLabel'),voiceBar:$('voiceActiveBar'),voiceStatus:$('voiceStatusText'),voiceMute:$('voiceMuteBtn'),voiceHang:$('voiceHangupBtn'),remoteAudio:$('remoteAudio'),
    reactions:$('reactions'),incoming:$('voiceIncomingModal'),caller:$('voiceCallerName'),accept:$('voiceAcceptBtn'),decline:$('voiceDeclineBtn')
  };
  const s={lastChat:0,lastReactionAt:0,peer:null,local:null,remote:null,callId:null,incoming:null,pendingIce:[],seen:new Set(),remoteSet:false,signalReady:false,muted:false,processing:false};
  const roomRef=()=>ref(db,`rooms/${state.roomCode}`);
  const voiceRef=()=>ref(db,`rooms/${state.roomCode}/voiceCall`);
  const otherUid=()=>state.room?(state.room.hostUid===state.uid?state.room.guestUid:state.room.hostUid):null;
  const clean=x=>String(x??'').replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':'&quot;',"'":'&#039;'}[m]));
  const chatItems=room=>Object.values(room?.chat||{}).sort((a,b)=>(a.at||0)-(b.at||0)).slice(-80);
  function renderChat(room){if(!el.chatMessages)return;const items=chatItems(room);if(items.length>s.lastChat&&el.chatPanel?.classList.contains('hidden')){el.chatUnread.textContent=Math.min(9,items.length-s.lastChat);el.chatUnread.classList.remove('hidden')}s.lastChat=items.length;el.chatMessages.innerHTML=items.map(m=>`<div class="chat-msg ${m.uid===state.uid?'mine':'theirs'}"><small>${m.uid===state.uid?'أنت':clean(m.name||'صاحبك')}</small>${clean(m.text||'')}</div>`).join('')||'<div class="chat-msg theirs">ابدأوا الكلام 👋</div>';if(!el.chatPanel.classList.contains('hidden'))requestAnimationFrame(()=>el.chatMessages.scrollTop=el.chatMessages.scrollHeight)}
  async function sendChat(text){text=String(text||'').trim().slice(0,180);if(!text||!state.roomCode)return;const p=getProfile(),key=`${Date.now()}_${state.uid.slice(0,6)}`;await set(ref(db,`rooms/${state.roomCode}/chat/${key}`),{uid:state.uid,name:p.name||'لاعب',text,at:Date.now()});el.chatInput.value=''}
  async function reaction(emoji){if(!state.roomCode)return;await update(roomRef(),{reaction:{by:state.uid,emoji,at:Date.now()}})}

  function serDesc(d){return d?{type:d.type,sdp:d.sdp}:null}
  function serCand(c){return c?.toJSON?c.toJSON():{candidate:c.candidate,sdpMid:c.sdpMid,sdpMLineIndex:c.sdpMLineIndex,usernameFragment:c.usernameFragment}}
  async function rtcConfig(){return{iceServers:turnConfig?.iceServers||turnConfig||[{urls:'stun:stun.l.google.com:19302'}],iceCandidatePoolSize:4}}
  async function mic(){if(s.local)return s.local;s.local=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true},video:false});return s.local}
  async function writeCand(c){if(!s.callId)return;const key=`${Date.now()}_${Math.random().toString(36).slice(2,7)}`;await set(ref(db,`rooms/${state.roomCode}/voiceCall/candidates/${state.uid}/${key}`),serCand(c))}
  async function flushIce(){for(const c of s.pendingIce.splice(0))await writeCand(c).catch(()=>{})}
  async function addRemote(call){if(!s.peer||!call?.candidates)return;const uid=otherUid(),list=call.candidates?.[uid]||{};for(const [k,v] of Object.entries(list)){if(s.seen.has(k))continue;s.seen.add(k);try{await s.peer.addIceCandidate(new RTCIceCandidate(v))}catch{}}}
  async function peer(){try{s.peer?.close()}catch{}s.seen=new Set();s.remoteSet=false;s.pendingIce=[];s.signalReady=false;const pc=new RTCPeerConnection(await rtcConfig());s.peer=pc;const stream=await mic();stream.getTracks().forEach(t=>pc.addTrack(t,stream));s.remote=new MediaStream();el.remoteAudio.srcObject=s.remote;pc.ontrack=e=>{for(const t of(e.streams?.[0]?.getTracks()||[e.track]))if(!s.remote.getTracks().some(x=>x.id===t.id))s.remote.addTrack(t);el.remoteAudio.play().catch(()=>{})};pc.onicecandidate=e=>{if(!e.candidate)return;s.signalReady?writeCand(e.candidate).catch(()=>{}):s.pendingIce.push(e.candidate)};pc.onconnectionstatechange=()=>{const st=pc.connectionState;if(el.voiceStatus)el.voiceStatus.textContent=st==='connected'?'متصل صوتيًا ✅':st==='connecting'?'جاري توصيل الصوت…':st==='disconnected'?'انقطع الصوت مؤقتًا…':st==='failed'?'تعذر الاتصال الصوتي':'اتصال صوتي';if(st==='failed')toast('تعذر الاتصال الصوتي. جرّب مرة أخرى.')};return pc}
  async function startVoice(){if(s.callId||!otherUid())return toast('استنى صاحبك يدخل الأول.');try{const id=`${Date.now()}_${state.uid.slice(0,5)}`;s.callId=id;const pc=await peer(),offer=await pc.createOffer({offerToReceiveAudio:true});await pc.setLocalDescription(offer);await set(voiceRef(),{id,callerUid:state.uid,calleeUid:otherUid(),status:'ringing',offer:serDesc(pc.localDescription),createdAt:Date.now()});s.signalReady=true;await flushIce();voiceUi()}catch(e){console.error(e);cleanup();toast(e.name==='NotAllowedError'?'اسمح باستخدام الميكروفون.':'تعذر بدء المكالمة.')}}
  async function accept(){const call=s.incoming;if(!call||s.processing)return;s.processing=true;try{el.incoming.classList.add('hidden');s.callId=call.id;const pc=await peer();s.callId=call.id;await pc.setRemoteDescription(new RTCSessionDescription(call.offer));s.remoteSet=true;await addRemote(call);const ans=await pc.createAnswer();await pc.setLocalDescription(ans);await update(voiceRef(),{answer:serDesc(pc.localDescription),status:'answered',answeredAt:Date.now()});s.signalReady=true;await flushIce();s.incoming=null;voiceUi()}catch(e){console.error(e);cleanup();toast('تعذر قبول المكالمة.')}finally{s.processing=false}}
  async function decline(){const c=s.incoming;el.incoming?.classList.add('hidden');s.incoming=null;if(c?.id)await update(voiceRef(),{status:'declined',endedAt:Date.now()}).catch(()=>{})}
  async function signal(call){if(s.processing)return;if(!call){if(s.callId||s.incoming)cleanup(true);return}if(call.status==='ringing'&&call.calleeUid===state.uid&&!s.callId){s.incoming=call;el.caller.textContent=state.room?.players?.[call.callerUid]?.name||'صاحبك';el.incoming.classList.remove('hidden');return}if(call.status==='declined'&&call.callerUid===state.uid){toast('صاحبك رفض المكالمة.');cleanup();return}if(call.status==='ended'){if(s.callId)toast('تم إنهاء المكالمة.');cleanup(true);return}if(s.callId!==call.id||!s.peer)return;if(call.callerUid===state.uid&&call.answer&&!s.remoteSet){await s.peer.setRemoteDescription(new RTCSessionDescription(call.answer)).catch(()=>{});s.remoteSet=true}await addRemote(call)}
  function voiceUi(){if(!el.voiceBtn)return;el.voiceBtn.disabled=!otherUid()||!!s.callId;el.voiceLabel.textContent=s.callId?'مشغول':'اتصال';el.voiceBar.classList.toggle('hidden',!s.callId);el.voiceMute.textContent=s.muted?'🎙️ تشغيل':'🔇 كتم'}
  function toggleMute(){if(!s.local)return;s.muted=!s.muted;s.local.getAudioTracks().forEach(t=>t.enabled=!s.muted);voiceUi()}
  async function hang(){if(state.roomCode&&s.callId)await update(voiceRef(),{status:'ended',endedBy:state.uid,endedAt:Date.now()}).catch(()=>{});cleanup()}
  function cleanup(hide=true){try{s.peer?.close()}catch{}s.peer=null;s.local?.getTracks().forEach(t=>t.stop());s.local=null;s.remote?.getTracks().forEach(t=>t.stop());s.remote=null;if(el.remoteAudio)el.remoteAudio.srcObject=null;s.callId=null;s.signalReady=false;s.pendingIce=[];s.seen=new Set();s.remoteSet=false;s.muted=false;if(hide){s.incoming=null;el.incoming?.classList.add('hidden')}voiceUi()}
  function render(room){renderChat(room);voiceUi();signal(room?.voiceCall).catch(()=>{});if(room?.reaction?.at>s.lastReactionAt){s.lastReactionAt=room.reaction.at;if(room.reaction.by!==state.uid)toast(room.reaction.emoji)}}
  el.chatToggle?.addEventListener('click',()=>{el.chatPanel.classList.toggle('hidden');el.chatUnread.classList.add('hidden');requestAnimationFrame(()=>el.chatMessages.scrollTop=el.chatMessages.scrollHeight)});
  el.chatClose?.addEventListener('click',()=>el.chatPanel.classList.add('hidden'));
  el.chatForm?.addEventListener('submit',e=>{e.preventDefault();sendChat(el.chatInput.value)});
  el.reactions?.addEventListener('click',e=>{const b=e.target.closest('button');if(b)reaction(b.textContent.trim())});
  el.voiceBtn?.addEventListener('click',startVoice);el.accept?.addEventListener('click',accept);el.decline?.addEventListener('click',decline);el.voiceMute?.addEventListener('click',toggleMute);el.voiceHang?.addEventListener('click',hang);
  return{render,cleanup,sendChat};
}
