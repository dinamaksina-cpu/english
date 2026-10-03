const state={words:[],filtered:[],index:0,order:'random',direction:'en-uk',topic:'All',band:'All',revealed:false,history:[],activeView:'study',quiz:null,test:null};
let saved=JSON.parse(localStorage.getItem('vocabProgress')||'{}');
let known=new Set(saved.known||[]), review=new Set(saved.review||[]), fav=new Set(saved.fav||[]);
let goal=saved.goal||20;
let wordStats=saved.wordStats&&typeof saved.wordStats==='object'?saved.wordStats:{};
let analytics=Object.assign({quizSessions:0,testSessions:0,totalQuestions:0,totalCorrect:0,bestQuiz:0,bestTest:0,activityDays:{}},saved.analytics||{});
if(!analytics.activityDays)analytics.activityDays={};
const $=id=>document.getElementById(id);
const todayKey=()=>new Date().toISOString().slice(0,10);
function save(){
  saved={known:[...known],review:[...review],fav:[...fav],goal,wordStats,analytics,version:3};
  localStorage.setItem('vocabProgress',JSON.stringify(saved));
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(arr,n){return shuffle(arr.slice()).slice(0,Math.min(n,arr.length))}
function topics(){const s=new Set(['General']);state.words.forEach(w=>(w.topics||['General']).forEach(t=>s.add(t)));return [...s].sort()}
function bands(){return [...new Set(state.words.map(w=>w.band).filter(Boolean))]}
function addActivity(kind,correct=null){
  const k=todayKey();const d=analytics.activityDays[k]||(analytics.activityDays[k]={cards:0,quiz:0,test:0,correct:0,total:0});
  if(kind==='study')d.cards++;
  if(kind==='quiz'||kind==='test'){d[kind]++;d.total++;if(correct)d.correct++}
}
function calcStreak(){
  const keys=new Set(Object.keys(analytics.activityDays||{}));if(!keys.size)return 0;
  const d=new Date();const tk=todayKey();if(!keys.has(tk))d.setDate(d.getDate()-1);
  let s=0;for(;;){const k=d.toISOString().slice(0,10);if(!keys.has(k))break;s++;d.setDate(d.getDate()-1)}return s;
}
function recordResult(w,correct,source){
  const key=String(w.id);const st=wordStats[key]||(wordStats[key]={attempts:0,correct:0,wrong:0,streak:0,lastResult:null,lastSeen:null});
  st.attempts++;if(correct){st.correct++;st.streak=(st.streak||0)+1;if(st.streak>=3)review.delete(w.id)}else{st.wrong++;st.streak=0;review.add(w.id);known.delete(w.id)}
  st.lastResult=correct?'correct':'wrong';st.lastSeen=Date.now();
  analytics.totalQuestions++;if(correct)analytics.totalCorrect++;
  addActivity(source,correct);save();updateStats();
}
function baseFiltered(){
  let arr=state.words.slice();
  if(state.band!=='All')arr=arr.filter(w=>w.band===state.band);
  if(state.topic!=='All')arr=arr.filter(w=>(w.topics||[]).includes(state.topic));
  const q=$('searchInput').value.trim().toLowerCase();
  if(q)arr=arr.filter(w=>w.word.toLowerCase().includes(q)||w.translation.toLowerCase().includes(q));
  return arr;
}
function applyFilter(reset=true){
  let arr=baseFiltered();
  if(state.order==='review')arr=arr.filter(w=>review.has(w.id));
  if(state.order==='fav')arr=arr.filter(w=>fav.has(w.id));
  if(state.order==='az')arr.sort((a,b)=>a.word.localeCompare(b.word,'en'));else if(state.order==='random')shuffle(arr);
  state.filtered=arr;if(reset)state.index=0;renderCard();
}
function current(){return state.filtered[state.index]}
function renderCard(){
  updateStats();const w=current();
  if(!w){$('frontLabel').textContent='';$('frontText').textContent='Немає слів';$('backText').textContent='Спробуй змінити фільтр.';$('pronText').textContent='';$('ipaText').textContent='';$('topicBadge').textContent='';$('levelBadge').textContent='';$('answerBox').classList.remove('hidden');$('tapHint').classList.add('hidden');$('speakBtn').style.display='none';return}
  state.revealed=false;$('answerBox').classList.add('hidden');$('tapHint').classList.remove('hidden');$('topicBadge').textContent=(w.topics&&w.topics[0])||'General';$('levelBadge').textContent=w.level||'';$('favBtn').textContent=fav.has(w.id)?'★':'☆';
  if(state.direction==='en-uk'){$('frontLabel').textContent='ENGLISH';$('frontText').textContent=w.word;$('backText').textContent=w.translation}else{$('frontLabel').textContent='УКРАЇНСЬКА';$('frontText').textContent=w.translation;$('backText').textContent=w.word}
  $('pronText').textContent=w.pron?`Вимова: ${w.pron}`:'';$('ipaText').textContent=w.ipa||'';$('speakBtn').style.display='inline-block';
}
function reveal(){if(!current())return;state.revealed=true;$('answerBox').classList.remove('hidden');$('tapHint').classList.add('hidden')}
function next(push=true){if(!state.filtered.length)return;if(push)state.history.push(state.index);state.index=(state.index+1)%state.filtered.length;renderCard()}
function prev(){if(state.history.length){state.index=state.history.pop();renderCard()}else if(state.filtered.length){state.index=(state.index-1+state.filtered.length)%state.filtered.length;renderCard()}}
function mark(type){const w=current();if(!w)return;if(type==='known'){known.add(w.id);review.delete(w.id)}else{review.add(w.id);known.delete(w.id)}addActivity('study');save();next()}
function accuracy(){return analytics.totalQuestions?Math.round(analytics.totalCorrect/analytics.totalQuestions*100):null}
function updateStats(){
  const total=state.words.length||0,validIds=new Set(state.words.map(w=>w.id));
  const knownTotal=[...known].filter(id=>validIds.has(id)).length,reviewTotal=[...review].filter(id=>validIds.has(id)).length;
  $('knownCount').textContent=knownTotal;$('reviewCount').textContent=reviewTotal;$('accuracyTop').textContent=accuracy()===null?'—':`${accuracy()}%`;$('streakTop').textContent=calcStreak();
  $('progressText').textContent=`${knownTotal} / ${total}`;$('progressBar').style.width=total?`${Math.min(100,knownTotal/total*100)}%`:'0%';
  $('visibleCount').textContent=state.filtered.length?`${state.filtered.length.toLocaleString('uk-UA')} карток`:'0 карток';
}
function speakWord(w){if(!w||!('speechSynthesis'in window))return;speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(w.word);u.lang='en-GB';u.rate=.85;const voices=speechSynthesis.getVoices();const gb=voices.find(v=>/en-GB/i.test(v.lang));if(gb)u.voice=gb;speechSynthesis.speak(u)}
function getPool(scope){
  let arr=[];
  if(scope==='core')arr=state.words.filter(w=>w.band==='Oxford 3000');
  else if(scope==='extra')arr=state.words.filter(w=>w.band!=='Oxford 3000');
  else if(scope==='review')arr=state.words.filter(w=>review.has(w.id));
  else if(scope==='current')arr=state.filtered.slice();
  else arr=state.words.slice();
  return arr.length?arr:state.words.slice();
}
function distractors(w,field,pool){
  const used=new Set([w[field]]),out=[];let candidates=shuffle(pool.concat(state.words).slice());
  for(const x of candidates){if(x.id===w.id||!x[field]||used.has(x[field]))continue;used.add(x[field]);out.push(x[field]);if(out.length===3)break}
  return out;
}
function switchView(view){
  state.activeView=view;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`${view}View`));document.querySelectorAll('#modeTabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='progress')renderProgress();window.scrollTo({top:0,behavior:'smooth'});
}

// QUIZ
function startQuiz(){
  const pool=getPool($('quizPool').value),count=+$('quizCount').value;if(pool.length<4){alert('Для вікторини потрібно щонайменше 4 слова в цьому наборі.');return}
  const words=sample(pool,count);state.quiz={words,i:0,score:0,answered:false,direction:$('quizDirection').value,wrongIds:[]};
  $('quizSetup').classList.add('hidden');$('quizResult').classList.add('hidden');$('quizSession').classList.remove('hidden');renderQuizQuestion();
}
function renderQuizQuestion(){
  const q=state.quiz;if(!q)return;if(q.i>=q.words.length){finishQuiz();return}
  q.answered=false;const w=q.words[q.i],dir=q.direction==='mixed'?(Math.random()<.5?'en-uk':'uk-en'):q.direction; q.currentDirection=dir;
  $('quizStep').textContent=`${q.i+1} / ${q.words.length}`;$('quizScore').textContent=`${q.score} правильних`;$('quizBar').style.width=`${q.i/q.words.length*100}%`;
  $('quizFeedback').className='feedback hidden';$('quizNextBtn').classList.add('hidden');$('quizSpeakBtn').classList.add('hidden');
  const field=dir==='en-uk'?'translation':'word',prompt=dir==='en-uk'?w.word:w.translation;$('quizLabel').textContent=dir==='en-uk'?'ОБЕРИ ПЕРЕКЛАД':'ОБЕРИ АНГЛІЙСЬКЕ СЛОВО';$('quizPrompt').textContent=prompt;
  const opts=shuffle([w[field],...distractors(w,field,getPool($('quizPool').value))]);const box=$('quizOptions');box.innerHTML='';opts.forEach(label=>{const b=document.createElement('button');b.className='quiz-option';b.textContent=label;b.onclick=()=>answerQuiz(b,label,w[field],w);box.appendChild(b)});
}
function answerQuiz(btn,label,correctLabel,w){
  const q=state.quiz;if(!q||q.answered)return;q.answered=true;const ok=label===correctLabel;if(ok)q.score++;else q.wrongIds.push(w.id);recordResult(w,ok,'quiz');
  [...$('quizOptions').children].forEach(b=>{b.disabled=true;if(b.textContent===correctLabel)b.classList.add('correct')});if(!ok)btn.classList.add('wrong');
  $('quizFeedback').textContent=ok?'Правильно!':`Правильна відповідь: ${correctLabel}`;$('quizFeedback').className=`feedback ${ok?'good':'bad'}`;$('quizNextBtn').classList.remove('hidden');$('quizScore').textContent=`${q.score} правильних`;
}
function nextQuiz(){const q=state.quiz;if(!q||!q.answered)return;q.i++;renderQuizQuestion()}
function finishQuiz(){
  const q=state.quiz,pct=Math.round(q.score/q.words.length*100);analytics.quizSessions++;analytics.bestQuiz=Math.max(analytics.bestQuiz||0,pct);save();updateStats();
  $('quizSession').classList.add('hidden');$('quizResult').classList.remove('hidden');$('quizPercent').textContent=`${pct}%`;$('quizResultTitle').textContent=pct>=90?'Чудовий результат!':pct>=70?'Дуже добре!':pct>=50?'Непогано!':'Продовжуємо тренування';$('quizResultText').textContent=`${q.score} правильних із ${q.words.length}. Помилок: ${q.words.length-q.score}.`;$('quizMistakesBtn').disabled=!q.wrongIds.length;
}
function resetQuiz(){state.quiz=null;$('quizSession').classList.add('hidden');$('quizResult').classList.add('hidden');$('quizSetup').classList.remove('hidden')}

// TYPED TEST
function startTest(){
  const pool=getPool($('testPool').value),count=+$('testCount').value;if(!pool.length){alert('У цьому наборі немає слів.');return}
  state.test={words:sample(pool,count),i:0,score:0,answered:false,mode:$('testMode').value,wrongIds:[]};$('testSetup').classList.add('hidden');$('testResult').classList.add('hidden');$('testSession').classList.remove('hidden');renderTestQuestion();
}
function renderTestQuestion(){
  const t=state.test;if(!t)return;if(t.i>=t.words.length){finishTest();return}t.answered=false;const w=t.words[t.i];$('testStep').textContent=`${t.i+1} / ${t.words.length}`;$('testScore').textContent=`${t.score} правильних`;$('testBar').style.width=`${t.i/t.words.length*100}%`;$('testFeedback').className='feedback hidden';$('testInput').className='answer-input';$('testInput').value='';$('testInput').disabled=false;$('testSubmitBtn').classList.remove('hidden');$('testNextBtn').classList.add('hidden');
  if(t.mode==='listen-en'){$('testLabel').textContent='ПРОСЛУХАЙ І НАПИШИ СЛОВО';$('testPrompt').textContent='🔊';$('testSpeakBtn').classList.remove('hidden');setTimeout(()=>speakWord(w),250)}else{$('testLabel').textContent='НАПИШИ АНГЛІЙСЬКОЮ';$('testPrompt').textContent=w.translation;$('testSpeakBtn').classList.add('hidden')}
  setTimeout(()=>$('testInput').focus(),150);
}
function norm(s){return String(s||'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ')}
function submitTest(){
  const t=state.test;if(!t||t.answered)return;const w=t.words[t.i],val=norm($('testInput').value);if(!val)return;const ok=val===norm(w.word);t.answered=true;if(ok)t.score++;else t.wrongIds.push(w.id);recordResult(w,ok,'test');$('testInput').disabled=true;$('testInput').classList.add(ok?'correct':'wrong');$('testFeedback').textContent=ok?`Правильно — ${w.word}`:`Правильна відповідь: ${w.word} · ${w.translation}`;$('testFeedback').className=`feedback ${ok?'good':'bad'}`;$('testSubmitBtn').classList.add('hidden');$('testNextBtn').classList.remove('hidden');$('testScore').textContent=`${t.score} правильних`;
}
function nextTest(){const t=state.test;if(!t||!t.answered)return;t.i++;renderTestQuestion()}
function finishTest(){
  const t=state.test,pct=Math.round(t.score/t.words.length*100);analytics.testSessions++;analytics.bestTest=Math.max(analytics.bestTest||0,pct);save();updateStats();$('testSession').classList.add('hidden');$('testResult').classList.remove('hidden');$('testPercent').textContent=`${pct}%`;$('testResultText').textContent=`${t.score} правильних із ${t.words.length}. Помилок: ${t.words.length-t.score}.`;$('testMistakesBtn').disabled=!t.wrongIds.length;
}
function resetTest(){state.test=null;$('testSession').classList.add('hidden');$('testResult').classList.add('hidden');$('testSetup').classList.remove('hidden')}
function studyMistakes(){state.order='review';document.querySelectorAll('#orderControl button').forEach(x=>x.classList.toggle('active',x.dataset.order==='review'));applyFilter();switchView('study')}

// PROGRESS
function renderProgress(){
  const a=accuracy();$('dashStreak').textContent=calcStreak();$('dashAccuracy').textContent=a===null?'—':`${a}%`;$('dashAnswers').textContent=(analytics.totalQuestions||0).toLocaleString('uk-UA');$('dashQuizzes').textContent=analytics.quizSessions||0;$('dashTests').textContent=analytics.testSessions||0;$('dashBestQuiz').textContent=analytics.bestQuiz?`${analytics.bestQuiz}%`:'—';$('dashBestTest').textContent=analytics.bestTest?`${analytics.bestTest}%`:'—';
  const rows=state.words.map(w=>{const s=wordStats[String(w.id)]||{};return{w,wrong:s.wrong||0,correct:s.correct||0,attempts:s.attempts||0,review:review.has(w.id)}}).filter(x=>x.wrong>0||x.review).sort((a,b)=>(b.wrong-a.wrong)||((b.wrong/(b.attempts||1))-(a.wrong/(a.attempts||1)))).slice(0,12);const box=$('weakWords');box.innerHTML='';
  if(!rows.length){box.innerHTML='<div class="empty-note">Поки немає статистики — пройди вікторину або тест.</div>';return}
  rows.forEach(({w,wrong,correct})=>{const r=document.createElement('div');r.className='word-row';r.innerHTML=`<div><strong>${escapeHtml(w.word)}</strong><span>${escapeHtml(w.translation)}</span></div><em>${wrong} пом. · ${correct} прав.</em>`;box.appendChild(r)});
}
function escapeHtml(s){return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]))}
function exportProgress(){const blob=new Blob([JSON.stringify({app:'English 5000',exportedAt:new Date().toISOString(),progress:JSON.parse(localStorage.getItem('vocabProgress')||'{}')},null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`english5000-progress-${todayKey()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)}
async function importProgress(file){
  try{const text=await file.text(),data=JSON.parse(text),p=data.progress||data;if(!p||typeof p!=='object')throw new Error('bad');localStorage.setItem('vocabProgress',JSON.stringify(p));alert('Прогрес імпортовано. Сторінка перезавантажиться.');location.reload()}catch(e){alert('Не вдалося імпортувати файл прогресу.')}
}

async function boot(){
  const res=await fetch('words.json');state.words=await res.json();
  const topicSel=$('topicSelect');topics().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;topicSel.appendChild(o)});
  const bandSel=$('bandSelect');bands().forEach(b=>{const o=document.createElement('option');o.value=b;o.textContent=b==='Oxford 3000'?'Oxford 3000 · A1–B2':'Oxford 5000 extra · B2–C1';bandSel.appendChild(o)});
  $('goalRange').value=goal;$('goalLabel').textContent=`${goal} слів`;applyFilter();renderProgress();
}

// EVENTS
$('flashcard').addEventListener('click',e=>{if(e.target.closest('button'))return;reveal()});$('flashcard').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal()}});$('speakBtn').onclick=e=>{e.stopPropagation();speakWord(current())};$('favBtn').onclick=e=>{e.stopPropagation();const w=current();if(!w)return;fav.has(w.id)?fav.delete(w.id):fav.add(w.id);save();renderCard()};$('knowBtn').onclick=()=>mark('known');$('dontKnowBtn').onclick=()=>mark('review');$('nextBtn').onclick=()=>next();$('prevBtn').onclick=prev;$('shuffleBtn').onclick=()=>{shuffle(state.filtered);state.index=0;renderCard()};$('topicSelect').onchange=e=>{state.topic=e.target.value;applyFilter()};$('bandSelect').onchange=e=>{state.band=e.target.value;applyFilter()};$('directionSelect').onchange=e=>{state.direction=e.target.value;renderCard()};$('searchInput').oninput=()=>applyFilter();
document.querySelectorAll('#orderControl button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#orderControl button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.order=b.dataset.order;applyFilter()});document.querySelectorAll('#modeTabs button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('goalRange').oninput=e=>{$('goalLabel').textContent=`${e.target.value} слів`};$('goalRange').onchange=e=>{goal=+e.target.value;save()};$('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('vocabTheme',document.body.classList.contains('dark')?'dark':'light')};
$('startQuizBtn').onclick=startQuiz;$('quizNextBtn').onclick=nextQuiz;$('quizAgainBtn').onclick=resetQuiz;$('quizMistakesBtn').onclick=studyMistakes;$('quizSpeakBtn').onclick=()=>state.quiz&&speakWord(state.quiz.words[state.quiz.i]);
$('startTestBtn').onclick=startTest;$('testSubmitBtn').onclick=submitTest;$('testNextBtn').onclick=nextTest;$('testAgainBtn').onclick=resetTest;$('testMistakesBtn').onclick=studyMistakes;$('testSpeakBtn').onclick=()=>state.test&&speakWord(state.test.words[state.test.i]);$('testInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();state.test&&state.test.answered?nextTest():submitTest()}});
$('studyWeakBtn').onclick=studyMistakes;$('exportProgressBtn').onclick=exportProgress;$('importProgressInput').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)importProgress(f)};
if(localStorage.getItem('vocabTheme')==='dark')document.body.classList.add('dark');if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));boot();
