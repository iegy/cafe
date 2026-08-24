import { initializeApp } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-auth.js";
import { getDatabase, ref, get, onValue } from "https://www.gstatic.com/firebasejs/12.2.1/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js?v=8.2.0";
const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id),code=$('roomCode'),msg=$('joinMessage'),badge=$('netBadge'),installBtn=$('installBtn');let deferred=null;
onValue(ref(db,'.info/connected'),s=>{const ok=s.val()===true;badge.textContent=ok?'متصل':'غير متصل';badge.classList.toggle('off',!ok)});
async function authReady(){if(!auth.currentUser)await signInAnonymously(auth);}
async function join(){const c=code.value.trim();msg.textContent='';if(!/^\d{6}$/.test(c)){msg.textContent='الكود لازم يكون 6 أرقام.';return}try{await authReady();const snap=await get(ref(db,`rooms/${c}`));if(!snap.exists()){msg.textContent='الغرفة غير موجودة أو غير متاحة.';return}const r=snap.val(),type=r.gameType||'domino',routes={domino:'domino.html',chess:'chess.html',xo:'xo.html'};if(!routes[type]){msg.textContent='نوع اللعبة في الغرفة لم يعد مدعومًا في النسخة الحالية.';return}location.href=`./${routes[type]}?room=${c}`;}catch(e){console.error(e);msg.textContent='تعذر قراءة الغرفة. جرّب من رابط اللعبة مباشرة.'}}
$('joinBtn').addEventListener('click',join);code.addEventListener('keydown',e=>e.key==='Enter'&&join());
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferred=e;installBtn.classList.remove('hidden')});installBtn.addEventListener('click',async()=>{if(!deferred)return;deferred.prompt();await deferred.userChoice.catch(()=>{});deferred=null;installBtn.classList.add('hidden')});
if('serviceWorker'in navigator)navigator.serviceWorker.register('./service-worker.js?v=8.2.0').catch(console.warn);
