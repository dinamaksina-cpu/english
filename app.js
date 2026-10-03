const state={words:[],filtered:[],index:0,order:'random',direction:'en-uk',topic:'All',band:'All',revealed:false,history:[]};
const saved=JSON.parse(localStorage.getItem('vocabProgress')||'{}');
const known=new Set(saved.known||[]), review=new Set(saved.review||[]), fav=new Set(saved.fav||[]);
let goal=saved.goal||20;
const $=id=>document.getElementById(id);
function save(){localStorage.setItem('vocabProgress',JSON.stringify({known:[...known],review:[...review],fav:[...fav],goal}))}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function topics(){const s=new Set(['General']);state.words.forEach(w=>(w.topics||['General']).forEach(t=>s.add(t)));return [...s].sort()}
function bands(){return [...new Set(state.words.map(w=>w.band).filter(Boolean))]}
function applyFilter(reset=true){
  let arr=state.words.slice();
  if(state.band!=='All')arr=arr.filter(w=>w.band===state.band);
  if(state.topic!=='All')arr=arr.filter(w=>(w.topics||[]).includes(state.topic));
  const q=$('searchInput').value.trim().toLowerCase();
  if(q)arr=arr.filter(w=>w.word.toLowerCase().includes(q)||w.translation.toLowerCase().includes(q));
  if(state.order==='review')arr=arr.filter(w=>review.has(w.id));
  if(state.order==='fav')arr=arr.filter(w=>fav.has(w.id));
  if(state.order==='az')arr.sort((a,b)=>a.word.localeCompare(b.word,'en'));
  else if(state.order==='random')shuffle(arr);
  state.filtered=arr;
  if(reset)state.index=0;
  render();
}
function current(){return state.filtered[state.index]}
function render(){
  updateStats();
  const w=current();
  if(!w){
    $('frontLabel').textContent='';$('frontText').textContent='Немає слів';$('backText').textContent='Спробуй змінити фільтр.';
    $('pronText').textContent='';$('ipaText').textContent='';$('topicBadge').textContent='';$('levelBadge').textContent='';
    $('answerBox').classList.remove('hidden');$('tapHint').classList.add('hidden');$('speakBtn').style.display='none';return;
  }
  state.revealed=false;$('answerBox').classList.add('hidden');$('tapHint').classList.remove('hidden');
  $('topicBadge').textContent=(w.topics&&w.topics[0])||'General';
  $('levelBadge').textContent=w.level||'';
  $('favBtn').textContent=fav.has(w.id)?'★':'☆';
  if(state.direction==='en-uk'){
    $('frontLabel').textContent='ENGLISH';$('frontText').textContent=w.word;$('backText').textContent=w.translation;
  }else{
    $('frontLabel').textContent='УКРАЇНСЬКА';$('frontText').textContent=w.translation;$('backText').textContent=w.word;
  }
  $('pronText').textContent=w.pron?`Вимова: ${w.pron}`:'';$('ipaText').textContent=w.ipa||'';$('speakBtn').style.display='inline-block';
}
function reveal(){if(!current())return;state.revealed=true;$('answerBox').classList.remove('hidden');$('tapHint').classList.add('hidden')}
function next(push=true){if(!state.filtered.length)return;if(push)state.history.push(state.index);state.index=(state.index+1)%state.filtered.length;render()}
function prev(){if(state.history.length){state.index=state.history.pop();render()}else if(state.filtered.length){state.index=(state.index-1+state.filtered.length)%state.filtered.length;render()}}
function mark(type){const w=current();if(!w)return;if(type==='known'){known.add(w.id);review.delete(w.id)}else{review.add(w.id);known.delete(w.id)}save();next()}
function updateStats(){
  const total=state.words.length||0;
  const validIds=new Set(state.words.map(w=>w.id));
  const knownTotal=[...known].filter(id=>validIds.has(id)).length;
  const reviewTotal=[...review].filter(id=>validIds.has(id)).length;
  const favTotal=[...fav].filter(id=>validIds.has(id)).length;
  $('knownCount').textContent=knownTotal;$('reviewCount').textContent=reviewTotal;$('favCount').textContent=favTotal;
  $('progressText').textContent=`${knownTotal} / ${total}`;$('progressBar').style.width=total?`${Math.min(100,knownTotal/total*100)}%`:'0%';
  $('visibleCount').textContent=state.filtered.length?`${state.filtered.length.toLocaleString('uk-UA')} карток`:'0 карток';
}
function speak(){const w=current();if(!w||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(w.word);u.lang='en-GB';u.rate=.85;const voices=speechSynthesis.getVoices();const gb=voices.find(v=>/en-GB/i.test(v.lang));if(gb)u.voice=gb;speechSynthesis.speak(u)}
async function boot(){
  const res=await fetch('words.json');state.words=await res.json();
  const topicSel=$('topicSelect');topics().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;topicSel.appendChild(o)});
  const bandSel=$('bandSelect');bands().forEach(b=>{const o=document.createElement('option');o.value=b;o.textContent=b==='Oxford 3000'?'Oxford 3000 · A1–B2':'Oxford 5000 extra · B2–C1';bandSel.appendChild(o)});
  $('goalRange').value=goal;$('goalLabel').textContent=`${goal} слів`;applyFilter();
}
$('flashcard').addEventListener('click',e=>{if(e.target.closest('button'))return;reveal()});
$('flashcard').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal()}});
$('speakBtn').onclick=e=>{e.stopPropagation();speak()};
$('favBtn').onclick=e=>{e.stopPropagation();const w=current();if(!w)return;fav.has(w.id)?fav.delete(w.id):fav.add(w.id);save();render()};
$('knowBtn').onclick=()=>mark('known');$('dontKnowBtn').onclick=()=>mark('review');$('nextBtn').onclick=()=>next();$('prevBtn').onclick=prev;
$('shuffleBtn').onclick=()=>{shuffle(state.filtered);state.index=0;render()};
$('topicSelect').onchange=e=>{state.topic=e.target.value;applyFilter()};
$('bandSelect').onchange=e=>{state.band=e.target.value;applyFilter()};
$('directionSelect').onchange=e=>{state.direction=e.target.value;render()};$('searchInput').oninput=()=>applyFilter();
document.querySelectorAll('#orderControl button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#orderControl button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.order=b.dataset.order;applyFilter()});
$('goalRange').oninput=e=>{$('goalLabel').textContent=`${e.target.value} слів`};$('goalRange').onchange=e=>{goal=+e.target.value;save()};
$('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('vocabTheme',document.body.classList.contains('dark')?'dark':'light')};
if(localStorage.getItem('vocabTheme')==='dark')document.body.classList.add('dark');
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));
boot();
