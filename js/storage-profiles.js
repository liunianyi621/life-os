// A fresh profile never reuses, deletes or migrates a legacy data key.
const LifeOSProfiles = (() => {
  const audit=typeof LifeOSStorageAudit!=='undefined'?LifeOSStorageAudit:require('./storage-audit.js');
  const selector='lifeos-active-profile-v1',prefix='lifeos-profile-v1-';
  const validKey=key=>typeof key==='string'&&/^lifeos-profile-v1-[0-9a-f-]{36}$/i.test(key);
  function selection(storage){
    let raw;
    try{
      raw=storage.getItem(selector);
      if(raw===null)return {key:audit.canonical,raw:null,isolated:false};
      const value=JSON.parse(raw);
      if(value?.version!==1||!validKey(value.key))throw Error('Invalid profile selection');
      return {key:value.key,raw,isolated:true};
    }catch{return {key:audit.canonical,raw,error:'当前数据空间暂时无法读取，原始内容未修改。'};}
  }
  function inspect(storage,selected){
    if(selected.error)return {canRead:false,status:'profile-error',message:selected.error};
    if(storage.getItem(selector)!==selected.raw)return {canRead:false,status:'profile-changed',message:'另一页面已切换数据空间，请重新打开当前数据。'};
    const raw=storage.getItem(selected.key),summary=raw===null?null:audit.summarize(raw);
    if(!summary?.validState||summary.scaleVersion!==1)return {canRead:false,status:'profile-error',message:'当前数据空间暂时无法安全打开，未使用空数据覆盖。'};
    return {canRead:true,status:'profile-readable',message:'独立数据空间已读取。',raw};
  }
  function create(storage,{expectedSelection,seed,id,createdAt,assertLock}){
    if(typeof assertLock!=='function')throw Error('创建数据空间需要独占锁');assertLock();
    if(storage.getItem(selector)!==expectedSelection)throw Error('数据空间已经切换，请重新打开后再操作');
    const key=prefix+id,previous=selector+'-before-'+id;
    if(!validKey(key)||storage.getItem(key)!==null||storage.getItem(previous)!==null)throw Error('新数据空间名称冲突，请重试');
    if(seed.coins!==0||['tasks','dailyTasks','habits','memos','history','achievements','longTermGoals'].some(k=>!Array.isArray(seed[k])||seed[k].length))throw Error('新数据必须从零和空清单开始');
    const raw=JSON.stringify({...seed,localProfile:{version:1,key,createdAt}});
    const summary=audit.summarize(raw);
    if(!summary.validState||summary.scaleVersion!==1)throw Error('新数据结构未通过检查');
    // If a write fails, keep the old selection; any orphaned new profile is retained.
    if(expectedSelection!==null)storage.setItem(previous,expectedSelection);
    storage.setItem(key,raw);
    if(storage.getItem(key)!==raw)throw Error('新数据未能可靠保存，请检查设备可用空间后重试');
    assertLock();
    if(storage.getItem(selector)!==expectedSelection)throw Error('创建过程中数据空间已变化，未覆盖当前选择');
    const pointer=JSON.stringify({version:1,key,createdAt});
    storage.setItem(selector,pointer);
    if(storage.getItem(selector)!==pointer)throw Error('未能记住新数据空间，请重试');
    return {key,raw,pointer};
  }
  return {selector,prefix,validKey,selection,inspect,create};
})();
if(typeof module!=='undefined'&&module.exports)module.exports=LifeOSProfiles;
