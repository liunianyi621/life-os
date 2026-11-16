// Audit before ownership: a missing or unreadable current key is not a new account.
const LifeOSPersistence = (() => {
  let selected;
  try{selected=LifeOSProfiles.selection(localStorage);}catch{selected={key:'minimal-discipline-v3',raw:undefined,error:'存储模块未完整加载或本机存储不可用。'};}
  const key=selected.key,lockName=selected.isolated?'lifeos-editor-'+key:'lifeos-editor-v3';
  let writable=false,release=null,requesting=false,decision={canRead:false,message:'正在只读检查本地数据，尚未允许保存。'};
  let expected=new Map(),snapshot=null,failure='',ownerBusy=false,booted=false,lockWaiting=false;
  let confirmFresh=false,freshBusy=false,freshError='',retryTimer,waitingController;
  let suspended=document.hidden;
  const probes=new Map();
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel(lockName):null;
  function inspect(){
    try{
      if(typeof LifeOSStorageAudit==='undefined')throw Error('Storage audit unavailable');
      if(selected.error){decision={status:'profile-error',canRead:false,message:selected.error};return false;}
      if(localStorage.getItem(LifeOSProfiles.selector)!==selected.raw){decision={status:'profile-changed',canRead:false,message:'数据空间已在其他页面切换，请打开当前数据。'};return false;}
      if(selected.isolated){
        decision=LifeOSProfiles.inspect(localStorage,selected);
        expected=new Map([[key,decision.raw],[LifeOSProfiles.selector,selected.raw]]);
        return decision.canRead;
      }
      snapshot=LifeOSStorageAudit.capture(localStorage);decision=LifeOSStorageAudit.decide(snapshot);
      const captured=new Map(snapshot.entries.map(entry=>[entry.key,entry.raw]));
      expected=new Map([...LifeOSStorageAudit.mains,key+'-legacy-source',LifeOSProfiles.selector].map(name=>[name,captured.get(name)??null]));
    }catch{decision={status:'unreadable',canRead:false,message:'本机数据暂时无法安全读取。可以开始全新使用，旧数据不会删除。'};}
    return decision.canRead;
  }
  function action(notice,label,handler){const button=document.createElement('button');button.type='button';button.textContent=label;button.disabled=freshBusy||(label==='在此窗口继续'&&requesting);button.onclick=handler;notice.append(button);}
  function paint() {
    const app=document.querySelector('.app');if(app)app.hidden=!decision.canRead||Boolean(failure);
    for(const node of document.body.children)if(!['storageOwnerNotice','appRecoveryNotice'].includes(node.id)&&node.tagName!=='SCRIPT')node.toggleAttribute('inert',!writable);
    let notice=document.getElementById('storageOwnerNotice');
    if(!notice){notice=document.createElement('aside');notice.id='storageOwnerNotice';notice.setAttribute('role','status');document.body.append(notice);}
    notice.hidden=writable;
    const message=freshError||failure||(!decision.canRead?decision.message:ownerBusy?'另一窗口正在编辑，可切换到此窗口继续。':lockWaiting?'正在等待浏览器释放编辑权，可以重试或开始全新使用。':'数据已读取，正在恢复安全编辑权。');
    notice.replaceChildren(document.createTextNode(message));
    if(confirmFresh){
      const text=document.createElement('p');text.textContent='从 0 金币和空清单开始。旧数据仍会保留，不会导入新空间。';notice.append(text);
      action(notice,'取消',()=>{confirmFresh=false;freshError='';paint();});
      action(notice,freshBusy?'正在创建…':'确认开始',startFresh);
    }else{
      if(decision.status==='profile-changed')action(notice,'打开当前数据',()=>location.reload());
      else if(decision.canRead&&!failure)action(notice,'在此窗口继续',()=>acquire(true));
      if(!decision.canRead||failure||(lockWaiting&&!ownerBusy))action(notice,'开始全新使用',()=>{confirmFresh=true;paint();});
    }
  }
  async function startFresh(){
    if(freshBusy)return;freshBusy=true;freshError='';paint();
    let timeout;
    try{
      if(!navigator.locks?.request)throw Error('此浏览器暂不支持安全保存，请更新 Safari 后重试。旧数据未修改。');
      if(typeof cloneEmptyState!=='function'||typeof render!=='function'||typeof LifeOSProfiles==='undefined'||typeof LifeOSStorageAudit==='undefined')throw Error('应用文件未完整加载，请重新打开后重试。');
      const controller=new AbortController();timeout=setTimeout(()=>controller.abort(),4000);
      await navigator.locks.request('lifeos-profile-selection-v1',{signal:controller.signal},lock=>{
        clearTimeout(timeout);
        const seed={...cloneEmptyState(),rewards:defaultFundRewards(),longTermGoals:[],reviewDrafts:{},settledThroughDate:yesterdayKey()};
        LifeOSProfiles.create(localStorage,{expectedSelection:selected.raw,seed,id:crypto.randomUUID(),createdAt:new Date().toISOString(),assertLock(){if(lock?.name!=='lifeos-profile-selection-v1'||lock.mode!=='exclusive')throw Error('未取得新数据空间的独占编辑权');}});
        writable=false;release?.();location.reload();
      });
    }catch(error){
      try{const next=LifeOSProfiles.selection(localStorage);if(next.isolated&&next.raw!==selected.raw){location.reload();return;}}catch{}
      freshError=error.name==='AbortError'?'创建暂时未能取得编辑权，请重试。旧数据未修改。'
        :error.name==='QuotaExceededError'?'此网站的本地存储空间不足，新数据尚未启用，旧数据未修改。'
        :error.message||'新数据未能保存，请检查设备可用空间后重试。旧数据未修改。';
    }
    finally{clearTimeout(timeout);freshBusy=false;paint();}
  }
  function stop(message){
    writable=false;failure=message;release?.();paint();
  }
  function conflicts(){return Object.keys(localStorage).filter(k=>(selected.isolated?[key]:[key,'minimal-discipline-v2']).some(prefix=>k.startsWith(prefix+'-legacy-conflict-'))).map(k=>({key:k,raw:localStorage.getItem(k)}));}
  function assertWrite(){
    if(!writable||!decision.canRead||failure)throw Error('本地数据处于保护或只读状态，禁止保存');
    try{for(const [name,raw] of expected)if(localStorage.getItem(name)!==raw)throw Error('存储版本已变化');}
    catch(error){stop('其他页面修改了数据，已停止保存旧状态。请重新打开当前数据；不会自动合并金币。');throw error;}
  }
  function probeOwner(){
    if(!channel)return Promise.resolve(false);
    return new Promise(resolve=>{const nonce=crypto.randomUUID();const timer=setTimeout(()=>{probes.delete(nonce);resolve(false);},700);
      probes.set(nonce,(alive=true)=>{clearTimeout(timer);probes.delete(nonce);resolve(alive);});channel.postMessage({type:'probe',nonce});});
  }
  function retry(){clearTimeout(retryTimer);retryTimer=setTimeout(()=>{if(!suspended&&!document.hidden&&!writable&&!failure&&!confirmFresh)acquire();},1500);}
  function selectionChanged(){
    const next=LifeOSProfiles.selection(localStorage);
    if(next.raw===selected.raw)return false;
    writable=false;release?.();
    if(next.isolated&&!next.error){location.reload();return true;}
    stop('数据空间选择发生变化，已停止保存。可以重新打开或开始全新使用。');return true;
  }
  async function acquire(takeover=false){
    if(writable||requesting||suspended)return;
    try{if(selectionChanged())return;}catch{stop('本机存储暂时不可用，已停止保存。');return;}
    if(failure||!inspect()){paint();return;}
    if(!navigator.locks?.request){failure='浏览器不支持安全保存，已保持只读；原始数据未修改。';paint();return;}
    requesting=true;paint();
    let timeout;
    const controller=new AbortController();waitingController=takeover?controller:null;
    if(takeover)timeout=setTimeout(()=>controller.abort(),4000);
    if(takeover)channel?.postMessage('release');
    try{await navigator.locks.request(lockName,takeover?{signal:controller.signal}:{ifAvailable:true},async lock=>{
      clearTimeout(timeout);
      if(!lock){lockWaiting=true;ownerBusy=await probeOwner();paint();retry();return;}
      requesting=false;waitingController=null;
      if(suspended)return;
      if(!inspect()){paint();return;}
      if(typeof render!=='function'){failure='应用文件未完整加载，已停止写入。请保留此页面和原始存储。';paint();return;}
      try{
        // No automatic copying from v1/v2, scaling, or conflict archival on read.
        state=loadState();
        if(storageReadBlocked){decision={canRead:false,message:storageRecoveryMessage};paint();return;}
        writable=true;ownerBusy=false;lockWaiting=false;confirmFresh=false;freshError='';
        // Install the release handler before any existing business callback can throw.
        const released=new Promise(resolve=>release=resolve);
        if(typeof expireGoals==='function' && expireGoals())saveState();
        runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();paint();
        await released;
      }catch(error){failure='未能安全读取或保存数据，已停止写入。请保留此页面和原始存储。';console.error(error);}
      finally{writable=false;release=null;paint();}
    });}catch(error){
      writable=false;
      if(error.name==='AbortError'){lockWaiting=true;ownerBusy=false;if(!suspended)retry();}
      else{failure='无法取得安全编辑权，已保持只读。可以重新打开或开始全新使用。';console.error(error);}
      paint();
    }
    finally{clearTimeout(timeout);requesting=false;waitingController=null;paint();}
  }
  channel?.addEventListener('message',event=>{
    if(event.data?.type==='probe'){if(writable&&!document.hidden)channel.postMessage({type:'owner',nonce:event.data.nonce});return;}
    if(event.data?.type==='owner'){probes.get(event.data.nonce)?.();return;}
    if(event.data!=='release'||!writable)return;
    try{if(typeof flushReviewDrafts==='function')flushReviewDrafts();}
    catch{reportAppFailure('草稿保存失败，请先保存当前窗口内容后再切换。');return;}
    writable=false;ownerBusy=false;lockWaiting=true;paint();release?.();retry();
  });
  window.addEventListener('storage',event=>{
    if(typeof LifeOSStorageAudit==='undefined')return;
    if(event.key===LifeOSProfiles.selector){try{selectionChanged();}catch{stop('数据空间暂时无法读取，已停止保存。');}return;}
    const watched=selected.isolated?[key]:[...LifeOSStorageAudit.mains,key+'-legacy-source'];
    if(event.key!==null&&!watched.includes(event.key))return;
    if(writable){stop('其他页面修改了本地数据，已停止旧状态保存。请重新打开后继续。');return;}
    if(!failure&&inspect()&&typeof render==='function'){state=loadState();render();}paint();
  });
  function pause(){
    suspended=true;clearTimeout(retryTimer);waitingController?.abort();
    for(const resolve of probes.values())resolve(false);
    if(writable){try{if(typeof flushReviewDrafts==='function')flushReviewDrafts();}catch{failure='草稿保存未成功，请重新打开当前数据。';}writable=false;release?.();paint();}
  }
  function resume(){if(document.hidden)return;suspended=false;if(booted&&!writable&&!failure)acquire();}
  window.addEventListener('pageshow',resume);
  window.addEventListener('focus',resume);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pause();else resume();});
  window.addEventListener('pagehide',pause);
  inspect();
  document.addEventListener('DOMContentLoaded',()=>{booted=true;paint();acquire();});
  return {key,get isolated(){return Boolean(selected.isolated);},get writable(){return writable;},get canRender(){return decision.canRead&&!failure;},get status(){return failure?'protected':decision.status;},paint,conflicts,
    protectRead(message){if(!decision.canRead){paint();return;}decision={canRead:false,status:'unreadable',message};stop(message);},
    restoreConflicts(copies=[]){this.assertWrite();for(const copy of copies)if(!conflicts().some(c=>c.raw===copy.raw))localStorage.setItem(key+'-legacy-conflict-'+crypto.randomUUID(),copy.raw);},
    readRaw(){if(!decision.canRead)throw Error(decision.message);const raw=localStorage.getItem(key);if(raw!==expected.get(key))throw Error('读取期间数据已变化');return raw;},
    assertWrite,
    write(raw){assertWrite();localStorage.setItem(key,raw);expected.set(key,raw);}};
})();
