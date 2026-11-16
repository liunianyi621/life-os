const fs=require('node:fs'),crypto=require('node:crypto'),audit=require('../js/storage-audit.js');
const file=process.argv[2];if(!file){console.error('Usage: node scripts/verify-raw-recovery.cjs <file.json>');process.exit(1);}
try{
 const bytes=fs.readFileSync(file==='-'?0:file),data=JSON.parse(bytes.toString('utf8'));
 if(data.format!=='LifeOSRawRecovery'||data.version!==1||!data.context?.ios||!data.context?.standalone||!Array.isArray(data.localStorage?.entries))throw Error('不是手机 PWA 原始导出文件');
 let localKeys=0;
 for(const area of ['localStorage','sessionStorage']){
 if(!Array.isArray(data[area]?.entries))throw Error(area+' 区域缺失');
 const seen=new Set();for(const e of data[area].entries){
  if(typeof e.key!=='string'||typeof e.raw!=='string'||seen.has(e.key))throw Error('键值不完整或重复');seen.add(e.key);
  const summary=audit.summarize(e.raw);
  if(JSON.stringify(summary)!==JSON.stringify(e.summary))throw Error('摘要与原始字符串不一致');
  console.log(JSON.stringify({area,key:e.key,bytes:summary.bytes,parse:summary.parse,counts:summary.counts,sha256:crypto.createHash('sha256').update(e.raw).digest('hex')}));
 }
 if(area==='localStorage')localKeys=seen.size;
 if(!data[area].complete||!Array.isArray(data[area].errors)||data[area].errors.length)throw Error(area+' 导出不完整，请保留文件并继续排查；不能据此恢复');
 }
 console.log(JSON.stringify({origin:data.context.origin,keys:localKeys,captureComplete:true,fileSHA256:crypto.createHash('sha256').update(bytes).digest('hex'),userDataVerified:false}));
}catch(error){console.error('验证未通过：'+error.message);process.exitCode=1;}
