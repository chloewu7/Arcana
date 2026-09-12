import assert from 'node:assert/strict';
import fs from 'node:fs';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,v)};
const store=await import('../js/store.js');const {parseJSON,consumeSSE,call}=await import('../js/ai/client.js');const {validateTasks,validateGrade,gradeRecord,validateScope,generateFromStudy}=await import('../js/views/homework.js');
let checks=0;function test(name,fn){fn();checks++;console.log('✓',name);}
const cards=JSON.parse(fs.readFileSync(new URL('../data/cards.json',import.meta.url))).cards;
test('凌晨四点边界与跨年',()=>{assert.equal(store.today(new Date(2026,0,1,3,59)),'2025-12-31');assert.equal(store.today(new Date(2026,0,1,4,0)),'2026-01-01');assert.equal(store.addDays('2026-03-08',1),'2026-03-09');});
test('78张牌与图片映射',()=>{assert.equal(cards.length,78);assert.equal(new Set(cards.map(c=>c.id)).size,78);for(const c of cards)assert.ok(fs.existsSync(c.image));});
test('六个牌阵坐标及牌位数量',()=>{const spreads=JSON.parse(fs.readFileSync('data/spreads.json'));assert.equal(spreads.length,6);for(const s of spreads){assert.equal(s.cardCount,s.positions.length);for(const p of s.positions)assert.ok(p.x>=0&&p.x<=100&&p.y>=0&&p.y<=100);}});
const task={id:1,type:'recall',cards:['major-00'],prompt:'描述愚者',hint:'观察',rubric:'开始与潜能'};
test('AI题目拒绝无效牌、重复ID及缺失rubric',()=>{validateTasks({tasks:[task],focus:'开始'},cards,1);assert.throws(()=>validateTasks({tasks:[{...task,cards:['major-99']}],focus:''},cards,1));assert.throws(()=>validateTasks({tasks:[task,task],focus:''},cards,2));assert.throws(()=>validateTasks({tasks:[{...task,rubric:''}],focus:''},cards,1));});
const grade={perTask:[{id:1,score:8,max:10,correct:['理解正确'],missing:[],comment:'继续'}],weakPoints:[],nextFocus:'象征'};
test('批改校验与分数重算',()=>{validateGrade(grade,[task]);assert.equal(grade.total,8);assert.throws(()=>validateGrade({...grade,perTask:[{...grade.perTask[0],score:11}]},[task]));});
test('复习按每张牌聚合、间隔升级及重置',()=>{store.applyGrade([task,{...task,id:2}],{perTask:[{id:1,score:10,max:10},{id:2,score:8,max:10}]});let c=store.cardState('major-00');assert.equal(c.reviewCount,1);assert.equal(c.interval,2);assert.equal(c.status,'new');store.applyGrade([task],{perTask:[{id:1,score:4,max:10}]});assert.equal(c.interval,1);assert.equal(c.status,'new');});
test('损坏备份拒绝且保留当前状态',()=>{assert.throws(()=>store.replace({version:9}));assert.equal(store.cardState('major-00').status,'new');});
test('JSON围栏容错',()=>assert.deepEqual(parseJSON('```json\n{"ok":true}\n```'),{ok:true}));
const bytes=new TextEncoder().encode('data: {"choices":[{"delta":{"content":"星"}}]}\r\n\r\ndata: {"choices":[{"delta":{"content":"语"}}]}\n\ndata: [DONE]\n');
const stream=new ReadableStream({start(c){for(let i=0;i<bytes.length;i+=3)c.enqueue(bytes.slice(i,i+3));c.close();}});assert.equal(await consumeSSE(stream),'星语');console.log('✓ SSE跨字节中文与换行解析');checks++;
Object.defineProperty(globalThis,'navigator',{value:{onLine:true},configurable:true});store.state.settings.apiKey='test-only';let requests=0;globalThis.fetch=async()=>{requests++;return new Response(JSON.stringify({choices:[{message:{content:requests===1?'bad json':'{"ok":true}'}}]}),{status:200});};assert.deepEqual(await call({system:'json',user:'test',json:true}),{ok:true});assert.equal(requests,2);console.log('✓ JSON错误仅重试一次');checks++;
globalThis.fetch=async()=>new Response(JSON.stringify({choices:[{message:{content:JSON.stringify(grade)}}]}));const record={tasks:[task],answers:['新的开始'],status:'pending',spreadId:'test'};store.state.spreads.test={practiced:0,status:'learning'};await gradeRecord(record);const reviewed=store.cardState('major-00').reviewCount;await gradeRecord(record);assert.equal(store.cardState('major-00').reviewCount,reviewed);assert.equal(store.state.spreads.test.practiced,1);console.log('✓ 批改幂等与牌阵练习计数');checks++;
const spreads=JSON.parse(fs.readFileSync('data/spreads.json'));
const scope={cardIds:['major-00'],spreadIds:[],topics:['愚者正位关键词'],reverse:false,symbols:false};
const scopedTask={...task,learningPoint:scope.topics[0]};
test('手动学习范围拒绝未学牌、逆位、象征、额外评分知识点',()=>{
 const check=t=>validateTasks({tasks:[t],focus:'今日'},cards.filter(c=>c.id==='major-00'),1,scope,cards,spreads);
 check(scopedTask);
 assert.throws(()=>check({...scopedTask,cards:['major-01']}));
 assert.throws(()=>check({...scopedTask,prompt:'比较愚者和魔术师'}));
 assert.throws(()=>check({...scopedTask,type:'reverse'}));
 assert.throws(()=>check({...scopedTask,type:'symbol'}));
 assert.throws(()=>check({...scopedTask,rubric:'需要提到逆位'}));
 assert.throws(()=>check({...scopedTask,learningPoint:'占星对应'}));
});
test('基础知识不强制引入具体牌',()=>{
 const basic={cardIds:[],spreadIds:[],topics:['四种花色与元素'],reverse:false,symbols:false};
 validateScope(basic,cards,spreads);
 validateTasks({tasks:[{...task,type:'concept',cards:[],prompt:'描述四种花色',rubric:'花色与元素对应',learningPoint:basic.topics[0]}],focus:'基础'},[],1,basic,cards,spreads);
 assert.throws(()=>validateScope({...basic,cardIds:['not-a-card']},cards,spreads));
});
let payload;store.state.settings.dailyTaskCount=1;
store.state.cards['major-01']={status:'mastered',interval:20,nextReview:'2020-01-01'};
globalThis.fetch=async(_,options)=>{payload=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({tasks:[scopedTask],focus:'愚者正位'})}}]}));};
const generated=await generateFromStudy({date:store.today(),notes:'今天只学愚者正位关键词',scope},cards,spreads);
const sent=JSON.parse(payload.messages[1].content);
assert.deepEqual(sent.cards,[{id:'major-00',name:'愚者'}]);assert.equal(sent.weakPoints,undefined);assert.equal(generated.studyNotes,'今天只学愚者正位关键词');assert.deepEqual(generated.studyScope,scope);assert.equal(generated.status,'pending');
console.log('✓ 生成请求只发送确认范围，忽略已掌握/到期牌，并保存学习笔记');checks++;
test('跨日草稿保存为长期学习记录，重复读取不重复追加',()=>{
 store.state.studyDraft={date:'2026-01-01',notes:'学习愚者正位',scope:null};
 store.learningHistory();store.learningHistory();store.prune();
 assert.equal(store.state.learningJournal.filter(r=>r.date==='2026-01-01').length,1);
 assert.equal(store.state.learningJournal.find(r=>r.date==='2026-01-01').notes,'学习愚者正位');
 assert.ok(store.validate(JSON.parse(JSON.stringify(store.state))).learningJournal.some(r=>r.date==='2026-01-01'));
});
test('旧备份兼容；作业清理前归档笔记；同日补充保留',()=>{
 const old=store.defaults();delete old.learningJournal;assert.deepEqual(store.validate(old).learningJournal,[]);
 store.state.homework.push({date:'2020-01-01',studyNotes:'四元素',tasks:[],answers:[],status:'pending'});
 store.prune();assert.ok(!store.state.homework.some(h=>h.date==='2020-01-01'));assert.equal(store.state.learningJournal.find(r=>r.date==='2020-01-01').notes,'四元素');
 store.rememberLearning('2020-01-01','四种花色');assert.match(store.state.learningJournal.find(r=>r.date==='2020-01-01').notes,/四元素[\s\S]*四种花色/);
});
store.state.settings.dailyTaskCount=3;
const reviewSources=[{date:'2026-01-01',notes:'愚者正位关键词'}];
let mixedRequests=0;
globalThis.fetch=async(_,options)=>{mixedRequests++;payload=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{message:{content:JSON.stringify({tasks:[1,2,3].map((id,i)=>({...scopedTask,id,learningSource:mixedRequests===1?'today':i===0?'review':'today'})),focus:'新旧结合'})}}]}));};
const mixed=await generateFromStudy({date:store.today(),notes:'今天继续学习愚者正位关键词',scope,reviewSources},cards,spreads);
assert.equal(mixedRequests,2);assert.equal(mixed.tasks.filter(t=>t.learningSource==='review').length,1);assert.deepEqual(mixed.reviewSources,reviewSources);assert.equal(JSON.parse(payload.messages[1].content).reviewCount,1);
console.log('✓ 选中旧记录传给AI，复习题数量不符时重试，作业保存复习来源');checks++;
test('牌面初始未开始，手动四状态切换，批改不升级或降级',()=>{
 const c=store.ensureCard('cups-01');assert.equal(c.status,'new');
 for(const status of store.statuses){store.setCardStatus('cups-01',status);assert.equal(store.cardState('cups-01').status,status);}
 const t={...task,cards:['cups-01']};store.applyGrade([t],{perTask:[{id:1,score:0,max:10}]});assert.equal(c.status,'mastered');
 store.setCardStatus('cups-01','learning');store.applyGrade([t],{perTask:[{id:1,score:10,max:10}]});assert.equal(c.status,'learning');
 assert.throws(()=>store.setCardStatus('cups-01','unknown'));
});
test('旧自动状态回到未开始，保留解读及作业；手动状态导入后保留',()=>{
 const old=store.defaults();old.cards['major-00']={status:'familiar',interval:4,reviewCount:3,aiText:{meaning_up:'已缓存'},nextReview:'2026-09-12'};
 const migrated=store.validate(old);assert.equal(migrated.cards['major-00'].status,'new');assert.equal(migrated.cards['major-00'].aiText.meaning_up,'已缓存');assert.equal(migrated.cards['major-00'].reviewCount,3);
 const copy=store.validate(JSON.parse(JSON.stringify(store.state)));assert.equal(copy.cards['cups-01'].status,'learning');
});
store.flush();console.log(`${checks} checks passed`);
