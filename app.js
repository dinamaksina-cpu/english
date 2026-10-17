const state={words:[],books:[],filtered:[],index:0,order:'random',direction:'en-uk',topic:'All',band:'All',revealed:false,history:[],activeView:'study',quiz:null,test:null,bookId:null,bookChapter:0,lookup:null,readerSize:'normal',wordIndex:new Map()};
let saved=JSON.parse(localStorage.getItem('vocabProgress')||'{}');
let known=new Set(saved.known||[]), review=new Set(saved.review||[]), fav=new Set(saved.fav||[]);
let bookWords=saved.bookWords&&typeof saved.bookWords==='object'?saved.bookWords:{};
let readingProgress=saved.readingProgress&&typeof saved.readingProgress==='object'?saved.readingProgress:{};
let goal=saved.goal||20;
let wordStats=saved.wordStats&&typeof saved.wordStats==='object'?saved.wordStats:{};
let analytics=Object.assign({quizSessions:0,testSessions:0,totalQuestions:0,totalCorrect:0,bestQuiz:0,bestTest:0,activityDays:{}},saved.analytics||{});
if(!analytics.activityDays)analytics.activityDays={};
const $=id=>document.getElementById(id);
const todayKey=()=>new Date().toISOString().slice(0,10);
function save(){
  saved={known:[...known],review:[...review],fav:[...fav],goal,wordStats,analytics,bookWords,readingProgress,version:4};
  localStorage.setItem('vocabProgress',JSON.stringify(saved));
}
function shuffle(a){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a}
function sample(arr,n){return shuffle(arr.slice()).slice(0,Math.min(n,arr.length))}
function topics(){const s=new Set(['General']);state.words.forEach(w=>(w.topics||['General']).forEach(t=>s.add(t)));return [...s].sort()}
function bands(){return [...new Set(state.words.map(w=>w.band).filter(Boolean))]}
function addActivity(kind,correct=null){
  const k=todayKey();const d=analytics.activityDays[k]||(analytics.activityDays[k]={cards:0,quiz:0,test:0,correct:0,total:0});
  if(kind==='study')d.cards++;
  if(kind==='reading')d.reading=(d.reading||0)+1;
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
  if(state.order==='books')arr=arr.filter(w=>bookWords[String(w.id)]);
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
  else if(scope==='extra')arr=state.words.filter(w=>w.band==='Oxford 5000 +2000');
  else if(scope==='review')arr=state.words.filter(w=>review.has(w.id));
  else if(scope==='books')arr=state.words.filter(w=>bookWords[String(w.id)]);
  else if(scope==='current')arr=state.filtered.slice();
  else arr=state.words.slice();
  return arr;
}
function distractors(w,field,pool){
  const used=new Set([w[field]]),out=[];let candidates=shuffle(pool.concat(state.words).slice());
  for(const x of candidates){if(x.id===w.id||!x[field]||used.has(x[field]))continue;used.add(x[field]);out.push(x[field]);if(out.length===3)break}
  return out;
}
function switchView(view){
  state.activeView=view;document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===`${view}View`));document.querySelectorAll('#modeTabs button').forEach(b=>b.classList.toggle('active',b.dataset.view===view));
  if(view==='progress')renderProgress();
  if(view==='books')renderBooksLibrary();
  window.scrollTo({top:0,behavior:'smooth'});
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

// BOOKS / GRADED READERS
const properGlossary={ben:'Бен (ім’я)',colin:'Колін (ім’я)',dickon:'Дікон (ім’я)',dr:'доктор',england:'Англія',henry:'Генрі (ім’я)',holmes:'Холмс (прізвище)',india:'Індія',lennox:'Леннокс (прізвище)',london:'Лондон',martha:'Марта (ім’я)',mary:'Мері (ім’я)',max:'Макс (ім’я)',misselthwaite:'Місселтвейт (назва маєтку)',ryder:'Райдер (прізвище)',sherlock:'Шерлок (ім’я)',tom:'Том (ім’я)',watson:'Ватсон (прізвище)',weatherstaff:'Везерстафф (прізвище)',yorkshire:'Йоркшир'};
const irregularLemmas={
  am:'be',is:'be',are:'be',was:'be',were:'be',been:'be',being:'be',has:'have',had:'have',having:'have',does:'do',did:'do',done:'do',doing:'do',
  went:'go',gone:'go',came:'come',saw:'see',seen:'see',found:'find',took:'take',taken:'take',gave:'give',given:'give',made:'make',said:'say',
  thought:'think',knew:'know',known:'know',got:'get',gotten:'get',felt:'feel',left:'leave',brought:'bring',began:'begin',begun:'begin',told:'tell',ran:'run',
  ate:'eat',eaten:'eat',drank:'drink',drunk:'drink',sat:'sit',stood:'stand',wrote:'write',written:'write',spoke:'speak',spoken:'speak',heard:'hear',kept:'keep',
  lost:'lose',won:'win',chose:'choose',chosen:'choose',grew:'grow',grown:'grow',built:'build',slept:'sleep',met:'meet',paid:'pay',held:'hold',became:'become',
  bought:'buy',caught:'catch',taught:'teach',understood:'understand',forgot:'forget',forgotten:'forget',wore:'wear',worn:'wear',drove:'drive',driven:'drive',
  flew:'fly',flown:'fly',fell:'fall',fallen:'fall',sent:'send',spent:'spend',read:'read',put:'put',cut:'cut'
};
function normalizeBookToken(s){return String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/^[^a-z]+|[^a-z']+$/g,'')}
function normalizePhrase(s){return String(s||'').toLowerCase().replace(/[’‘]/g,"'").replace(/[^a-z'\s]/g,' ').replace(/\s+/g,' ').trim()}
function buildWordIndex(){
  state.wordIndex=new Map();
  state.words.forEach(w=>{const k=normalizeBookToken(w.word);if(k&&!state.wordIndex.has(k))state.wordIndex.set(k,w)});
}
function candidateLemmas(token){
  const t=normalizeBookToken(token),out=[];if(!t)return out;out.push(t);if(irregularLemmas[t])out.push(irregularLemmas[t]);
  if(t.endsWith("'s"))out.push(t.slice(0,-2));
  if(t.endsWith('ies')&&t.length>4)out.push(t.slice(0,-3)+'y');
  if(t.endsWith('ves')&&t.length>4){out.push(t.slice(0,-3)+'f');out.push(t.slice(0,-3)+'fe')}
  if(t.endsWith('es')&&t.length>4){out.push(t.slice(0,-2));out.push(t.slice(0,-1))}
  if(t.endsWith('s')&&t.length>3)out.push(t.slice(0,-1));
  if(t.endsWith('ied')&&t.length>4)out.push(t.slice(0,-3)+'y');
  if(t.endsWith('ed')&&t.length>4){out.push(t.slice(0,-2));out.push(t.slice(0,-1));if(t.length>5&&t.at(-3)===t.at(-4))out.push(t.slice(0,-3))}
  if(t.endsWith('ing')&&t.length>5){out.push(t.slice(0,-3));out.push(t.slice(0,-3)+'e');if(t.length>6&&t.at(-4)===t.at(-5))out.push(t.slice(0,-4))}
  return [...new Set(out)];
}
function findWordRecord(token){for(const c of candidateLemmas(token)){const w=state.wordIndex.get(c);if(w)return w}return null}
function bookProgressFor(id){
  const p=readingProgress[id]||(readingProgress[id]={lastChapter:0,read:[],lastOpened:null});
  if(!Array.isArray(p.read))p.read=[];if(typeof p.lastChapter!=='number')p.lastChapter=0;return p;
}
function totalReadChapters(){return Object.values(readingProgress).reduce((n,p)=>n+(Array.isArray(p.read)?new Set(p.read).size:0),0)}
function renderBooksLibrary(){
  if(!state.books.length)return;
  $('bookLibrary').classList.remove('hidden');$('bookReader').classList.add('hidden');closeLookup();
  const grid=$('booksGrid');grid.innerHTML='';
  state.books.forEach(book=>{
    const p=bookProgressFor(book.id),read=new Set(p.read),pct=Math.round(read.size/book.chapters.length*100);
    const card=document.createElement('article');card.className='book-card';
    card.innerHTML=`<div class="book-cover"><span class="book-icon">${book.icon||'📘'}</span><span class="badge">${escapeHtml(book.level)}</span></div><h3>${escapeHtml(book.title)}</h3><div class="book-author">${escapeHtml(book.author||'')}</div><p>${escapeHtml(book.description||'')}</p><div class="book-progress-row"><span>${read.size} / ${book.chapters.length} розділів</span><strong>${pct}%</strong></div><div class="mini-track"><div style="width:${pct}%"></div></div><button class="book-open">${read.size||p.lastOpened?'Продовжити':'Почати читати'}</button>`;
    card.querySelector('.book-open').onclick=()=>openBook(book.id);grid.appendChild(card);
  });
  $('booksReadCount').textContent=totalReadChapters();
}
function currentBook(){return state.books.find(b=>b.id===state.bookId)||null}
function openBook(bookId,chapterIndex=null){
  const book=state.books.find(b=>b.id===bookId);if(!book)return;state.bookId=bookId;const p=bookProgressFor(bookId);
  state.bookChapter=chapterIndex===null?Math.min(p.lastChapter||0,book.chapters.length-1):Math.max(0,Math.min(chapterIndex,book.chapters.length-1));
  $('bookLibrary').classList.add('hidden');$('bookReader').classList.remove('hidden');renderBookChapter();window.scrollTo({top:0,behavior:'smooth'});
}
function makeWordButton(token,sentenceEn,sentenceUk){
  const b=document.createElement('span');b.className='reader-word';b.textContent=token;b.dataset.token=token;b.tabIndex=0;b.setAttribute('role','button');
  b.onclick=e=>{e.stopPropagation();if(window.getSelection()?.toString().trim())return;showWordLookup(token,sentenceEn,sentenceUk)};b.onkeydown=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();showWordLookup(token,sentenceEn,sentenceUk)}};return b;
}
function renderSentence(sentenceEn,sentenceUk){
  const span=document.createElement('span');span.className='reader-sentence';span.dataset.en=sentenceEn;span.dataset.translation=sentenceUk;
  const parts=sentenceEn.split(/([A-Za-z]+(?:['’][A-Za-z]+)?)/g);
  parts.forEach(part=>{if(/^[A-Za-z]+(?:['’][A-Za-z]+)?$/.test(part))span.appendChild(makeWordButton(part,sentenceEn,sentenceUk));else span.appendChild(document.createTextNode(part))});
  return span;
}
function renderBookChapter(){
  const book=currentBook();if(!book)return;const chapter=book.chapters[state.bookChapter],p=bookProgressFor(book.id);p.lastChapter=state.bookChapter;p.lastOpened=Date.now();save();
  $('readerLevel').textContent=book.level;$('readerAuthor').textContent=book.author||'';$('readerBookTitle').textContent=book.title;$('readerChapterLabel').textContent=`РОЗДІЛ ${state.bookChapter+1} З ${book.chapters.length}`;$('readerChapterTitle').textContent=chapter.title;
  $('readerProgressBar').style.width=`${((state.bookChapter+1)/book.chapters.length)*100}%`;$('prevChapterBtn').disabled=state.bookChapter===0;$('nextChapterBtn').disabled=state.bookChapter===book.chapters.length-1;
  const text=$('readerText');text.innerHTML='';text.classList.remove('reader-large','reader-small');if(state.readerSize==='large')text.classList.add('reader-large');if(state.readerSize==='small')text.classList.add('reader-small');
  for(let i=0;i<chapter.sentences.length;i+=2){const para=document.createElement('p');para.className='reader-paragraph';for(let j=i;j<Math.min(i+2,chapter.sentences.length);j++){const [en,uk]=chapter.sentences[j];para.appendChild(renderSentence(en,uk));if(j<Math.min(i+2,chapter.sentences.length)-1)para.appendChild(document.createTextNode(' '))}text.appendChild(para)}
  const read=new Set(p.read),isRead=read.has(state.bookChapter),btn=$('markChapterReadBtn');btn.classList.toggle('read',isRead);btn.textContent=isRead?'✓ Розділ прочитано':'✓ Позначити розділ прочитаним';
  closeLookup();
}
function changeChapter(delta){const b=currentBook();if(!b)return;const n=state.bookChapter+delta;if(n<0||n>=b.chapters.length)return;state.bookChapter=n;renderBookChapter();window.scrollTo({top:0,behavior:'smooth'})}
function markChapterRead(){
  const b=currentBook();if(!b)return;const p=bookProgressFor(b.id),read=new Set(p.read);if(!read.has(state.bookChapter)){read.add(state.bookChapter);p.read=[...read].sort((a,b)=>a-b);addActivity('reading');save();updateStats();renderProgress()}
  renderBookChapter();
}
function speakChapter(){
  const b=currentBook();if(!b||!('speechSynthesis'in window))return;const ch=b.chapters[state.bookChapter];speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(ch.sentences.map(x=>x[0]).join(' '));u.lang='en-GB';u.rate=.82;const voices=speechSynthesis.getVoices();const gb=voices.find(v=>/en-GB/i.test(v.lang));if(gb)u.voice=gb;speechSynthesis.speak(u)
}
function cycleReaderSize(){state.readerSize=state.readerSize==='normal'?'large':state.readerSize==='large'?'small':'normal';renderBookChapter()}
function closeLookup(){if($('wordPopup'))$('wordPopup').classList.add('hidden');state.lookup=null;const sel=window.getSelection&&window.getSelection();if(sel&&!sel.isCollapsed)sel.removeAllRanges()}
function showWordLookup(token,sentenceEn='',sentenceUk=''){
  const w=findWordRecord(token),gloss=properGlossary[normalizeBookToken(token)]||null;state.lookup={type:'word',records:w?[w]:[],sentenceEn,sentenceUk,raw:token};$('lookupLabel').textContent=w?'СЛОВО':'ІМ’Я / НАЗВА';$('lookupWord').textContent=w?w.word:token;
  $('lookupTranslation').textContent=w?w.translation:(gloss||'Цього слова немає в локальному словнику.');$('lookupPron').textContent=w&&w.pron?`Вимова: ${w.pron}`:'';$('lookupIpa').textContent=w?.ipa||'';
  $('lookupContext').textContent=sentenceEn?`${sentenceEn}\n${sentenceUk}`:'';$('lookupSpeakBtn').disabled=false;$('addBookWordBtn').disabled=!w;$('addBookWordBtn').textContent=w&&bookWords[String(w.id)]?'✓ Уже додано':w?'+ Додати до вивчення':'Не додається до словника';$('wordPopup').classList.remove('hidden')
}
function phraseExactTranslation(text){const b=currentBook();if(!b)return null;const n=normalizePhrase(text);for(const [k,v] of Object.entries(b.phrases||{})){if(normalizePhrase(k)===n)return v}return null}
function showPhraseLookup(text,sentenceEl){
  const exact=phraseExactTranslation(text),sentenceEn=sentenceEl?.dataset.en||'',sentenceUk=sentenceEl?.dataset.translation||'';const toks=text.match(/[A-Za-z]+(?:['’][A-Za-z]+)?/g)||[];const recs=[];const seen=new Set();
  toks.forEach(t=>{const w=findWordRecord(t);if(w&&!seen.has(w.id)){seen.add(w.id);recs.push(w)}});state.lookup={type:'phrase',records:recs,sentenceEn,sentenceUk,raw:text};$('lookupLabel').textContent='ФРАЗА';$('lookupWord').textContent=text;
  $('lookupTranslation').textContent=exact||sentenceUk||'Переклад контексту недоступний.';$('lookupPron').textContent='';$('lookupIpa').textContent='';const meanings=recs.slice(0,8).map(w=>`${w.word} — ${w.translation}`).join(' · ');$('lookupContext').textContent=exact?(sentenceUk?`У реченні: ${sentenceUk}`:''):(meanings?`Словникові значення: ${meanings}`:'');$('lookupSpeakBtn').disabled=false;$('addBookWordBtn').disabled=!recs.length;$('addBookWordBtn').textContent=recs.length?'+ Додати слова фрази':'Немає слів для додавання';$('wordPopup').classList.remove('hidden')
}
function addLookupToLearning(){
  const l=state.lookup;if(!l||!l.records?.length)return;const b=currentBook(),chapter=b?.chapters[state.bookChapter];l.records.forEach(w=>{const key=String(w.id),entry=bookWords[key]||(bookWords[key]={wordId:w.id,contexts:[],addedAt:Date.now()});const ctx={bookId:b?.id||null,bookTitle:b?.title||'',chapter:state.bookChapter,chapterTitle:chapter?.title||'',sentence:l.sentenceEn||''};if(ctx.sentence&&!entry.contexts.some(x=>x.sentence===ctx.sentence))entry.contexts.push(ctx);review.add(w.id);known.delete(w.id)});save();updateStats();$('addBookWordBtn').textContent='✓ Додано до вивчення';
}
function handleReaderSelection(){
  if(state.activeView!=='books'||$('bookReader').classList.contains('hidden'))return;const sel=window.getSelection();if(!sel||sel.isCollapsed)return;const txt=sel.toString().trim();if(!txt||txt.split(/\s+/).length<2||txt.length>180)return;let node=sel.anchorNode;let el=node?.nodeType===1?node:node?.parentElement;if(!el)return;const sentence=el.closest?.('.reader-sentence');if(!sentence||!$('readerText').contains(sentence))return;showPhraseLookup(txt,sentence)
}

// PROGRESS
function renderProgress(){
  const a=accuracy();$('dashStreak').textContent=calcStreak();$('dashAccuracy').textContent=a===null?'—':`${a}%`;$('dashAnswers').textContent=(analytics.totalQuestions||0).toLocaleString('uk-UA');$('dashQuizzes').textContent=analytics.quizSessions||0;$('dashTests').textContent=analytics.testSessions||0;$('dashBestQuiz').textContent=analytics.bestQuiz?`${analytics.bestQuiz}%`:'—';$('dashBestTest').textContent=analytics.bestTest?`${analytics.bestTest}%`:'—';$('dashBookWords').textContent=Object.keys(bookWords).length;$('dashReadChapters').textContent=totalReadChapters();
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
  const [res,booksRes]=await Promise.all([fetch('words.json'),fetch('books.json')]);state.words=await res.json();state.books=await booksRes.json();buildWordIndex();
  const topicSel=$('topicSelect');topics().forEach(t=>{const o=document.createElement('option');o.value=t;o.textContent=t;topicSel.appendChild(o)});
  const bandSel=$('bandSelect');bands().forEach(b=>{const o=document.createElement('option');o.value=b;o.textContent=b==='Oxford 3000'?'Oxford 3000 · A1–B2':b==='Oxford 5000 +2000'?'Oxford 5000 extra · B2–C1':'Reader vocabulary · A1–A2';bandSel.appendChild(o)});
  $('goalRange').value=goal;$('goalLabel').textContent=`${goal} слів`;applyFilter();renderProgress();renderBooksLibrary();
}

// EVENTS
$('flashcard').addEventListener('click',e=>{if(e.target.closest('button'))return;reveal()});$('flashcard').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();reveal()}});$('speakBtn').onclick=e=>{e.stopPropagation();speakWord(current())};$('favBtn').onclick=e=>{e.stopPropagation();const w=current();if(!w)return;fav.has(w.id)?fav.delete(w.id):fav.add(w.id);save();renderCard()};$('knowBtn').onclick=()=>mark('known');$('dontKnowBtn').onclick=()=>mark('review');$('nextBtn').onclick=()=>next();$('prevBtn').onclick=prev;$('shuffleBtn').onclick=()=>{shuffle(state.filtered);state.index=0;renderCard()};$('topicSelect').onchange=e=>{state.topic=e.target.value;applyFilter()};$('bandSelect').onchange=e=>{state.band=e.target.value;applyFilter()};$('directionSelect').onchange=e=>{state.direction=e.target.value;renderCard()};$('searchInput').oninput=()=>applyFilter();
document.querySelectorAll('#orderControl button').forEach(b=>b.onclick=()=>{document.querySelectorAll('#orderControl button').forEach(x=>x.classList.remove('active'));b.classList.add('active');state.order=b.dataset.order;applyFilter()});document.querySelectorAll('#modeTabs button').forEach(b=>b.onclick=()=>switchView(b.dataset.view));
$('goalRange').oninput=e=>{$('goalLabel').textContent=`${e.target.value} слів`};$('goalRange').onchange=e=>{goal=+e.target.value;save()};$('themeBtn').onclick=()=>{document.body.classList.toggle('dark');localStorage.setItem('vocabTheme',document.body.classList.contains('dark')?'dark':'light')};
$('startQuizBtn').onclick=startQuiz;$('quizNextBtn').onclick=nextQuiz;$('quizAgainBtn').onclick=resetQuiz;$('quizMistakesBtn').onclick=studyMistakes;$('quizSpeakBtn').onclick=()=>state.quiz&&speakWord(state.quiz.words[state.quiz.i]);
$('startTestBtn').onclick=startTest;$('testSubmitBtn').onclick=submitTest;$('testNextBtn').onclick=nextTest;$('testAgainBtn').onclick=resetTest;$('testMistakesBtn').onclick=studyMistakes;$('testSpeakBtn').onclick=()=>state.test&&speakWord(state.test.words[state.test.i]);$('testInput').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();state.test&&state.test.answered?nextTest():submitTest()}});
$('studyWeakBtn').onclick=studyMistakes;$('exportProgressBtn').onclick=exportProgress;$('importProgressInput').onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)importProgress(f)};
$('backToBooksBtn').onclick=renderBooksLibrary;$('prevChapterBtn').onclick=()=>changeChapter(-1);$('nextChapterBtn').onclick=()=>changeChapter(1);$('markChapterReadBtn').onclick=markChapterRead;$('readerSpeakBtn').onclick=speakChapter;$('readerTextSizeBtn').onclick=cycleReaderSize;$('closeLookupBtn').onclick=closeLookup;$('addBookWordBtn').onclick=addLookupToLearning;$('lookupSpeakBtn').onclick=()=>{const l=state.lookup;if(!l)return;if(l.type==='word'&&l.records[0])speakWord(l.records[0]);else if(l.raw&&'speechSynthesis'in window){speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(l.raw);u.lang='en-GB';u.rate=.85;speechSynthesis.speak(u)}};
let selectionTimer;document.addEventListener('selectionchange',()=>{clearTimeout(selectionTimer);selectionTimer=setTimeout(handleReaderSelection,320)});
if(localStorage.getItem('vocabTheme')==='dark')document.body.classList.add('dark');if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('sw.js').catch(()=>{}));boot();
