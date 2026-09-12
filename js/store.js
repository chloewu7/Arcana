export const KEY='tarot.v1';
export const statuses=['new','learning','familiar','mastered'];
export const statusNames={new:'未开始',learning:'学习中',familiar:'已熟悉',mastered:'已掌握'};
export function today(now=new Date()){const d=new Date(now);d.setHours(d.getHours()-4);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function addDays(day,n){const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;}
export function defaults(){return {version:1,settings:{apiKey:'',model:'deepseek-chat',dailyTaskCount:3,tone:'温和'},cards:{},spreads:{},homework:[],chat:[],learningJournal:[]};}
export function validate(data){if(!data||data.version!==1||!data.settings||typeof data.settings!=='object'||!data.cards||Array.isArray(data.cards)||typeof data.cards!=='object'||!data.spreads||typeof data.spreads!=='object'||!Array.isArray(data.homework)||!Array.isArray(data.chat))throw new Error('不是受支持的 Arcana 备份（需要版本 1）。');for(const [id,c] of Object.entries(data.cards)){if(!/^(major|wands|cups|swords|pentacles)-\d{2}$/.test(id)||!c||!statuses.includes(c.status)||!Number.isFinite(c.interval)||c.interval<1)throw new Error('备份中的牌面进度格式不正确。');}for(const h of data.homework){if(!h||!/^\d{4}-\d{2}-\d{2}$/.test(h.date)||!Array.isArray(h.tasks)||!Array.isArray(h.answers)||!['pending','submitted','graded'].includes(h.status))throw new Error('备份中的作业格式不正确。');for(const t of h.tasks)if(!t||typeof t.prompt!=='string'||!Array.isArray(t.cards))throw new Error('备份中的题目格式不正确。');}if(data.chat.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.content!=='string'))throw new Error('备份中的对话格式不正确。');if(data.learningJournal!==undefined&&(!Array.isArray(data.learningJournal)||data.learningJournal.some(r=>!r||typeof r.notes!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(r.date))))throw new Error('学习记录格式不正确。');for(const c of Object.values(data.cards)){if(c.statusSource!=='manual'){if(c.status!=='new')c.previousAutoStatus=c.status;c.status='new';delete c.nextReview;c.statusSource='manual';}}return {...data,learningJournal:data.learningJournal||[],settings:{...defaults().settings,...data.settings,apiKey:String(data.settings.apiKey||''),model:String(data.settings.model||'deepseek-chat'),dailyTaskCount:Math.max(1,Math.min(6,Number(data.settings.dailyTaskCount)||3)),tone:data.settings.tone==='严格'?'严格':'温和'}};}
let initial=defaults();export let loadError='';try{const raw=localStorage.getItem(KEY);if(raw)initial=validate(JSON.parse(raw));}catch(e){loadError='本地记录暂时无法读取，原始数据已保留。请先在设置中导出原始数据。';}
for(const h of initial.homework)if(h.status==='submitted')h.status='pending';
export let state=initial;let timer;let blocked=!!loadError;
export function prune(){archiveLearning();state.chat=state.chat.slice(-50);state.homework=state.homework.filter(h=>h.date>=addDays(today(),-89));}
export function flush(){clearTimeout(timer);if(blocked)return false;try{prune();localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{window.dispatchEvent(new CustomEvent('storage-error'));return false;}}
export function save(){clearTimeout(timer);timer=setTimeout(flush,300);}
export function replace(data){const next=validate(data);localStorage.setItem(KEY,JSON.stringify(next));state=next;blocked=false;loadError='';save();}
export function rememberLearning(date,notes){
 if(typeof notes!=='string'||!notes.trim())return;
 state.learningJournal??=[];
 const existing=state.learningJournal.find(r=>r.date===date);
 if(existing){if(!existing.entries)existing.entries=[existing.notes];if(!existing.entries.includes(notes.trim()))existing.entries.push(notes.trim());existing.notes=existing.entries.join('\n\n');}
 else state.learningJournal.push({date,notes:notes.trim(),entries:[notes.trim()]});
}
export function archiveLearning(){
 for(const h of state.homework)if(h.studyNotes)rememberLearning(h.date,h.studyNotes);
 if(state.studyDraft?.notes&&state.studyDraft.date!==today())rememberLearning(state.studyDraft.date,state.studyDraft.notes);
}
export function learningHistory(){archiveLearning();return [...(state.learningJournal||[])].sort((a,b)=>b.date.localeCompare(a.date));}
export function cardState(id){return state.cards[id]||{status:'new',reviewCount:0,interval:1};}
export function ensureCard(id){if(!state.cards[id]){state.cards[id]={status:'new',statusSource:'manual',reviewCount:0,interval:1};save();}return state.cards[id];}
export function setCardStatus(id,status){if(!statuses.includes(status))throw new Error('无效的学习状态。');const c=ensureCard(id);c.status=status;c.statusSource='manual';save();return c;}
export function applyGrade(tasks,grade){const scores=new Map();for(const t of tasks){const g=grade.perTask.find(x=>x.id===t.id);for(const id of t.cards){if(!scores.has(id))scores.set(id,[]);scores.get(id).push(g.score/g.max);}}for(const [id,ratios] of scores){const c=ensureCard(id),ratio=ratios.reduce((a,b)=>a+b,0)/ratios.length;c.reviewCount++;c.lastReview=today();if(ratio>=.8){c.interval=Math.min(365,c.interval*2);}else if(ratio<.6){c.interval=1;}c.nextReview=addDays(today(),c.interval);}save();}
export function streak(){const days=new Set(state.homework.filter(h=>h.status==='graded').map(h=>h.date));let day=today();if(!days.has(day))day=addDays(day,-1);let n=0;while(days.has(day)){n++;day=addDays(day,-1);}return n;}
if(typeof window!=='undefined'){window.addEventListener('pagehide',flush);document.addEventListener('visibilitychange',()=>{if(document.hidden)flush();});}
