const fs=require('node:fs'),path=require('node:path');
// Produces a self-contained inspector expression, never reads the Mac browser.
const audit=fs.readFileSync(path.join(__dirname,'../js/storage-audit.js'),'utf8');
process.stdout.write('(function(){\n'+audit+String.raw`
const standalone=navigator.standalone===true||matchMedia('(display-mode: standalone)').matches;
const ios=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
if(!ios||!standalone)throw Error('停止：此上下文不是 iPhone/iPad 主屏幕 PWA。不要用 Mac 或 Safari 网页的空数据代替。');
function readArea(name){try{return LifeOSStorageAudit.capture(globalThis[name]);}catch{return {entries:[],errors:[{operation:'access',message:name+' 无法读取'}],consistent:false,complete:false};}}
const snapshot=readArea('localStorage'),session=readArea('sessionStorage');
const exportData={format:'LifeOSRawRecovery',version:1,capturedAt:new Date().toISOString(),
 context:{origin:location.origin,path:location.pathname,userAgent:navigator.userAgent,standalone,ios},
 userDataVerified:false,localStorage:snapshot,sessionStorage:session,
 note:'原始快照，不是正式 LifeOS Backup。未执行迁移、初始化、结算、保存或恢复。'};
const text=JSON.stringify(exportData,null,2);
// Inspector copy writes the Mac clipboard, not PWA storage; no download/navigation.
globalThis.__lifeosRawRecoveryJSON=text;
let clipboardCopied=false;if(typeof copy==='function'){copy(text);clipboardCopied=true;}
console.table(snapshot.entries.map(e=>({key:e.key,bytes:e.summary.bytes,parse:e.summary.parse,...e.summary.counts})));
console.info('原始字符串仅保存在内存及检查器剪贴板；请保存本地 JSON，不要把完整内容发到聊天。');
return {format:exportData.format,origin:location.origin,standalone,keys:snapshot.entries.length,
 complete:snapshot.complete,errors:snapshot.errors,clipboardCopied,userDataVerified:false};
})()
`);
