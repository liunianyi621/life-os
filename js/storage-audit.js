// Pure recovery inspection: no application initialization, normalization or writes.
const LifeOSStorageAudit = (() => {
  const canonical='minimal-discipline-v3';
  const mains=[canonical,'minimal-discipline-v2','minimal-discipline-v1','life-rpg-system-v1','life-os-ios-v1','life-streak-os-v1'];
  function summarize(raw){
    const result={chars:raw.length,bytes:new TextEncoder().encode(raw).length,parse:'invalid',counts:{},validState:false,meaningful:false};
    let data;try{data=JSON.parse(raw);}catch{return result;}
    result.parse='valid';
    if(!data||typeof data!=='object'||Array.isArray(data))return result;
    for(const key of ['tasks','dailyTasks','habits','badHabits','notes','memos','history','rewards','achievements','longTermGoals','procrastinationMarkers','calendarEvents'])
      result.counts[key]=Array.isArray(data[key])?data[key].length:0;
    for(const key of ['dailyReviews','priorityTaskByDate','priorityPlans','reviewDrafts','completions','taskResults','habitCompletions','habitFailures','taskAutoFailures','reviewRewards'])result.counts[key]=data[key]&&typeof data[key]==='object'?Object.keys(data[key]).length:0;
    result.coins=Number.isFinite(data.coins)?data.coins:null;
    result.validState=Number.isFinite(data.coins)&&['tasks','habits','memos','history','rewards'].every(k=>Array.isArray(data[k]))
      && data.dailyReviews!==null&&typeof data.dailyReviews==='object'&&!Array.isArray(data.dailyReviews);
    // Even zero-balance accounts may have priceless journals or other records.
    result.meaningful=(result.coins!==null&&result.coins!==0)||Object.entries(result.counts).some(([key,n])=>key!=='rewards'&&n>0)
      || Boolean(data.currentFocus||data.lastCompletedDate||data.streak)
      || (data.totals&&Object.values(data.totals).some(n=>Number(n)!==0))
      || (Array.isArray(data.rewards)&&data.rewards.some(r=>r&&((Number(r.currentCoins??r.depositedCoins)||0)!==0||!/^reward-fund-\d+$/.test(r.id||''))));
    result.scaleVersion=data.pastCoinHistoryScaleMigrationVersion??null;
    return result;
  }
  function capture(storage){
    const entries=[],errors=[];let names=[];
    function listKeys(){
      const count=storage.length;if(!Number.isSafeInteger(count)||count<0)throw Error('Invalid storage size');
      const keys=Array.from({length:count},(_,i)=>storage.key(i));
      if(keys.some(k=>typeof k!=='string')||new Set(keys).size!==count)throw Error('Incomplete key enumeration');
      return keys.sort();
    }
    try{names=listKeys();}
    catch{errors.push({operation:'list',message:'无法枚举存储'});}
    for(const key of names){try{const raw=storage.getItem(key);if(raw===null){errors.push({key,operation:'read',message:'读取期间键消失'});continue;}entries.push({key,raw,summary:summarize(raw)});}
      catch{errors.push({key,operation:'read',message:'读取失败'});}}
    let consistent=false;
    try{const after=listKeys();consistent=JSON.stringify(names)===JSON.stringify(after)&&entries.every(e=>storage.getItem(e.key)===e.raw);}
    catch{errors.push({operation:'verify',message:'一致性检查失败'});}
    return {entries,errors,consistent,complete:consistent&&errors.length===0};
  }
  function decide(snapshot){
    if(!snapshot.complete)return {status:'unreadable',canRead:false,message:'本机旧数据暂时无法完整读取。可以开始全新使用，原始内容仍会保留。'};
    const relevant=snapshot.entries.filter(e=>mains.includes(e.key)||e.summary.validState
      ||/^(minimal-discipline|life[-_]?os|life-rpg|life-streak)|backup|before-import|legacy-source|legacy-conflict/i.test(e.key));
    if(snapshot.entries.length===0)return {status:'first-install',canRead:true,message:'确认当前容器没有任何本地键；这不证明其他 PWA 或 Safari 容器没有数据。'};
    const current=snapshot.entries.find(e=>e.key===canonical);
    if(!current)return {status:'legacy-or-unknown',canRead:false,message:'发现旧版本数据。可以开始全新使用，旧数据不会删除或覆盖。'};
    if(!current.summary.validState)return {status:'damaged-current',canRead:false,message:'v3 损坏或结构不完整。可以开始全新使用，原始内容不会覆盖。'};
    if(!current.summary.meaningful&&relevant.some(e=>e.key!==canonical&&(e.summary.meaningful||!e.summary.validState)))
      return {status:'empty-shadowed',canRead:false,message:'当前空数据与旧记录并存。可以开始全新使用，旧记录仍会保留。'};
    const original=snapshot.entries.find(e=>e.key===canonical+'-legacy-source')?.raw;
    if(relevant.some(e=>mains.includes(e.key)&&e.key!==canonical&&e.raw!==current.raw&&e.raw!==original))
      return {status:'version-conflict',canRead:false,message:'新旧版本存在不同数据，未自动合并。可以开始全新使用，原始内容仍会保留。'};
    if(current.summary.scaleVersion!==1)return {status:'migration-review',canRead:false,message:'旧版数据需要迁移核对。也可直接开始全新使用，不会转换旧金币。'};
    return {status:'current-readable',canRead:true,message:'v3 结构与版本检查通过。'};
  }
  function planMigration(storage,sourceKey){
    if(!mains.includes(sourceKey)||sourceKey===canonical)throw Error('必须明确选择原始旧版主键');
    const snapshot=capture(storage);if(!snapshot.complete)throw Error('读取失败或数据变化，不能计划迁移');
    const source=snapshot.entries.find(e=>e.key===sourceKey);
    if(!source?.summary.validState||source.summary.scaleVersion!==1)throw Error('源数据需人工审查，不能自动迁移或转换金币');
    return {sourceKey,raw:source.raw,targetKey:canonical,expectedTarget:storage.getItem(canonical)};
  }
  function commitVerifiedMigration(storage,plan,approval){
    if(approval?.backupConfirmed!==true||approval?.userApproved!==true||typeof approval.assertLock!=='function')throw Error('必须先验证原始备份、获得明确批准和独占锁');
    approval.assertLock();
    const summary=summarize(plan.raw);
    if(!mains.includes(plan.sourceKey)||plan.sourceKey===canonical||plan.targetKey!==canonical||!summary.validState||summary.scaleVersion!==1)throw Error('迁移计划无效');
    if(storage.getItem(plan.sourceKey)!==plan.raw)throw Error('源数据已变化，必须重新导出和审查');
    const target=storage.getItem(canonical);
    if(target===plan.raw)return {status:'already-installed'};
    if(target!==null||plan.expectedTarget!==null)throw Error('目标已经存在，禁止覆盖，包括空 v3');
    const backup=canonical+'-verified-source';
    if(storage.getItem(backup)!==null&&storage.getItem(backup)!==plan.raw)throw Error('已有不同恢复原件，禁止覆盖');
    storage.setItem(backup,plan.raw);approval.assertLock();
    if(storage.getItem(plan.sourceKey)!==plan.raw||storage.getItem(canonical)!==null)throw Error('迁移中数据变化，未写入目标');
    storage.setItem(canonical,plan.raw);
    return {status:'copied-without-transformation'};
  }
  return {canonical,mains,summarize,capture,decide,planMigration,commitVerifiedMigration};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LifeOSStorageAudit;
