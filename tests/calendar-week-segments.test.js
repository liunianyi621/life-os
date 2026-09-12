const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../js/ui.js'),'utf8');
const fn=source.slice(source.indexOf('function buildWeeklyEventSegments('),source.indexOf('function renderCalendarWeek('));
const context=vm.createContext({});vm.runInContext(fn,context);
const build=(days,events)=>JSON.parse(JSON.stringify(context.buildWeeklyEventSegments(days,events)));
const days=['2026-09-14','2026-09-15','2026-09-16','2026-09-17','2026-09-18','2026-09-19','2026-09-20'];
for(const [name,start,end,col,width] of [
  ['single','2026-09-15','2026-09-15',1,1],['two','2026-09-15','2026-09-16',1,2],
  ['MonFri','2026-09-14','2026-09-18',0,5],['FriTue','2026-09-18','2026-09-22',4,3],
  ['full','2026-09-14','2026-09-20',0,7],['continuation','2026-09-10','2026-09-16',0,3]]){
  test(`Weekly segment: ${name}`,()=>{const event={id:name,startDate:start,endDate:end};const [s]=build(days,[event]);assert.equal(s.start,col);assert.equal(s.end-s.start+1,width);assert.deepEqual(s.event,event);assert.equal(s.startsHere,start>=days[0]);});
}
test('Overlapping events use separate lanes without changing event data',()=>{
  const events=[{id:'a',startDate:days[0],endDate:days[4]},{id:'b',startDate:days[1],endDate:days[2]},{id:'c',startDate:days[3],endDate:days[3]}];
  const before=JSON.stringify(events),s=build(days,events);assert.equal(s[0].lane,0);assert.equal(s[1].lane,1);assert.equal(s[2].lane,1);assert.equal(JSON.stringify(events),before);
});
test('Month and year boundaries retain inclusive dates and continuation identity',()=>{
  const week=['2026-12-28','2026-12-29','2026-12-30','2026-12-31','2027-01-01','2027-01-02','2027-01-03'];
  const [s]=build(week,[{id:'year',startDate:'2026-12-30',endDate:'2027-01-02'}]);assert.equal(s.start,2);assert.equal(s.end,5);
});
test('Out-of-week events do not render',()=>assert.deepEqual(build(days,[{id:'old',startDate:'2025-01-01',endDate:'2025-01-02'}]),[]));
