// Isolate older builds that do not understand mode-specific settlement rules.
const LifeOSPersistence = (() => {
  const key='minimal-discipline-v3',legacy='minimal-discipline-v2',older='minimal-discipline-v1',source=key+'-legacy-source';
  let writable=false,release=null,requesting=false;
  const channel=typeof BroadcastChannel==='function'?new BroadcastChannel('lifeos-editor-v3'):null;
  function paint(message='另一窗口正在编辑。可切换到此窗口继续，数据不会被旧页面覆盖。') {
    for(const node of document.body.children)if(!['storageOwnerNotice','appRecoveryNotice'].includes(node.id)&&node.tagName!=='SCRIPT')node.toggleAttribute('inert',!writable);
    let notice=document.getElementById('storageOwnerNotice');
    if(!notice){notice=document.createElement('aside');notice.id='storageOwnerNotice';notice.setAttribute('role','status');document.body.append(notice);}
    notice.hidden=writable;notice.replaceChildren(document.createTextNode(message));
    const button=document.createElement('button');button.textContent='在此窗口继续';button.onclick=()=>acquire(true);notice.append(button);
  }
  function archiveLegacy(raw){
    if(!raw || raw===localStorage.getItem(source))return;
    if(conflicts().some(copy=>copy.raw===raw))return;
    const id=key+'-legacy-conflict-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    try{localStorage.setItem(id,raw);}catch{reportAppFailure('旧窗口有独立修改，原始数据仍保留，请勿清理浏览器存储。');}
    reportAppFailure('检测到旧版窗口的独立修改，已保留副本。请关闭旧窗口；新旧金币不会自动合并。');
  }
  function conflicts(){return Object.keys(localStorage).filter(k=>[key,legacy].some(prefix=>k.startsWith(prefix+'-legacy-conflict-'))).map(k=>({key:k,raw:localStorage.getItem(k)}));}
  async function acquire(takeover=false){
    if(writable||requesting)return;
    if(!navigator.locks?.request){paint('浏览器不支持安全保存，请使用新版 Safari 或 Chrome；原数据未修改。');return;}
    requesting=true;
    if(takeover)channel?.postMessage('release');
    navigator.locks.request('lifeos-editor-v3',takeover?{}:{ifAvailable:true},async lock=>{
      requesting=false;if(!lock){paint();return;}
      if(typeof render!=='function'){paint('应用文件未完整加载，请重新加载。');return;}
      try{
        const raw=localStorage.getItem(legacy)??localStorage.getItem(older);
        if(localStorage.getItem(key)===null && raw!==null){
          // Keep the exact pre-upgrade bytes; no balance or transaction is recomputed.
          localStorage.setItem(source,raw);localStorage.setItem(key,raw);
        }
        writable=true;
        archiveLegacy(raw);
        if(conflicts().length)reportAppFailure('保留了旧版窗口的独立修改，请先导出完整备份再核对；金币未自动合并。');
        state=loadState();
        if(!storageReadBlocked && typeof expireGoals==='function' && expireGoals())saveState();
        runAutomaticChecks({initializeDailyHabits:true,showToast:false});render();paint();
        await new Promise(resolve=>release=resolve);
      }catch(error){writable=false;paint('未能安全读取或保存数据，请保留此页面和浏览器数据。');console.error(error);}
      finally{writable=false;release=null;paint();}
    }).catch(error=>{requesting=false;writable=false;paint();console.error(error);});
  }
  channel?.addEventListener('message',event=>{
    if(event.data!=='release'||!writable)return;
    try{if(typeof flushReviewDrafts==='function')flushReviewDrafts();}
    catch{reportAppFailure('草稿保存失败，请先保存当前窗口内容后再切换。');return;}
    writable=false;paint();release?.();
  });
  window.addEventListener('storage',event=>{
    if(event.key===legacy||event.key===older)archiveLegacy(event.newValue);
    if(event.key===key&&!writable){state=loadState();render();}
  });
  window.addEventListener('pageshow',()=>{if(!writable&&typeof render==='function'){state=loadState();render();paint();}});
  window.addEventListener('pagehide',()=>{
    if(writable){if(typeof flushReviewDrafts==='function')flushReviewDrafts();writable=false;release?.();}
  });
  document.addEventListener('DOMContentLoaded',()=>{paint();acquire();});
  return {key,get writable(){return writable;},conflicts,
    restoreConflicts(copies=[]){this.assertWrite();for(const copy of copies)if(!conflicts().some(c=>c.raw===copy.raw))localStorage.setItem(key+'-legacy-conflict-'+crypto.randomUUID(),copy.raw);},
    assertWrite(){if(!writable)throw Error('此窗口没有编辑权，请切换编辑窗口后重试');},
    write(raw){this.assertWrite();localStorage.setItem(key,raw);}};
})();
