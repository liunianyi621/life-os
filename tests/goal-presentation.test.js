const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),path=require('node:path');
function runtime(){
 const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const context=vm.createContext({Date,Intl,console,document:{addEventListener(){}},window:{addEventListener(){}},
  setTimeout(){return 1;},clearTimeout(){},dateKey:()=> '2026-11-16',parseCoinAmount:n=>Math.round(n*100)/100,
  state:{dailyTasks:[]},escapeHtml:escape,escapeAttr:escape,actionIconHtml:()=>'<svg></svg>'});
 for(const file of ['goals','ui/goals'])vm.runInContext(fs.readFileSync(path.join(__dirname,'../js',file+'.js'),'utf8'),context);
 return code=>vm.runInContext(code,context);
}
test('Goal day labels use local calendar dates across DST, month, leap year and year boundaries',()=>{
 const run=runtime();
 for(const [deadline,today,expected] of [['2026-11-22','2026-11-16',6],['2026-10-26','2026-10-24',2],['2027-01-01','2026-12-31',1],['2024-03-01','2024-02-28',2],['2026-11-15','2026-11-16',0]])
  assert.equal(run(`goalDaysRemaining('${deadline}','${today}')`),expected);
});
test('Numeric card shows real downward progress, values and agreements without dark-card styling',()=>{
 const run=runtime(),html=run(`goalCardHtml({id:'n',name:'体重达到 55 kg',kind:'numeric',start:60,current:57.2,target:55,unit:'kg',deadline:'2026-11-22',status:'active',reward:500,penalty:'一周不刷短视频'})`);
 for(const text of ['57.2','/ 55 kg','起始 60 kg','已完成约 56%','剩余 6 天','达成奖励','失败约定','更新进度'])assert.ok(html.includes(text),text);
 assert.match(html,/<article class="goal-card"/);assert.match(html,/goal-progress/);assert.doesNotMatch(html,/background|分类|dark/);
});
test('Non-numeric and legacy milestone cards never invent a progress bar or 0%',()=>{
 const run=runtime();for(const kind of ['completion','milestones']){
  const html=run(`goalCardHtml({id:'c',kind:'${kind}',name:'交付一个作品',deadline:'2026-11-22',status:'active',reward:500,penalty:'休息',milestones:[]})`);
  assert.doesNotMatch(html,/<progress|0%/);assert.match(html,/标记完成/);
 }
});
test('New minimal payload defaults to completion; optional numeric payload validates complete numbers',()=>{
 const run=runtime();run(`var fields={name:'目标',deadline:'2026-11-22',reward:'500.79',penalty:'约定'}`);
 const data=JSON.parse(run('JSON.stringify(goalEditorPayload(fields,null,false))'));
 assert.deepEqual(data,{name:'目标',deadline:'2026-11-22',reward:500.79,penalty:'约定',kind:'completion',milestones:[]});
 assert.equal(run(`goalEditorPayload({...fields,start:'60',target:'55',current:'57.2',unit:'kg'},null,true).current`),57.2);
 assert.throws(()=>run(`goalEditorPayload({...fields,start:'60',target:'55',current:''},null,true)`),/完整/);
 assert.throws(()=>run(`goalEditorPayload({...fields,start:'60',target:'55',current:'NaN'},null,true)`),/完整/);
 assert.equal(run('goalEditorPayload(fields,null,true).kind'),'completion');
});
test('Editing legacy milestones omits hidden fields rather than clearing milestone IDs, category, description or history',()=>{
 const run=runtime();run(`var legacy={id:'old',kind:'milestones',category:'原分类',description:'原描述',milestones:[{id:'stable',name:'原行动',done:false}],log:[{id:'original'}]};
 var payload=goalEditorPayload({name:'更新名字',deadline:'2026-11-22',reward:'500',penalty:'原约定'},legacy,false)`);
 for(const key of ['kind','milestones','category','description','log'])assert.equal(run(`Object.hasOwn(payload,'${key}')`),false);
 assert.equal(run('({...legacy,...payload}).milestones[0].id'),'stable');
 assert.equal(run('({...legacy,...payload}).description'),'原描述');
 assert.equal(run('({...legacy,...payload}).log[0].id'),'original');
});
test('Card content is escaped, overdue reversals are not mislabelled today, progress stays 0–100%',()=>{
 const run=runtime();const html=run(`goalCardHtml({id:'safe',kind:'numeric',name:'<img src=x>',start:0,target:10,current:100,unit:'<kg>',deadline:'2026-11-15',status:'active',reward:500,penalty:'<script>bad</script>'})`);
 assert.doesNotMatch(html,/<img|<script>/);assert.match(html,/&lt;img/);assert.match(html,/已完成约 100%/);assert.match(html,/截止已过/);
 assert.equal(run(`goalProgress({kind:'numeric',start:60,target:55,current:70})`),0);
});
