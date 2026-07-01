const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
async function get(path){const r=await fetch(`${BASE_URL}${path}`);const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${path} ${r.status}`);return d;}
async function post(path,body,headers={}){const r=await fetch(`${BASE_URL}${path}`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':`smoke-${Date.now()}`,...headers},body:JSON.stringify(body)});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(`${path} ${r.status} ${JSON.stringify(d).slice(0,200)}`);return d;}
const health=await get('/api/health');
const submit=await post('/api/scan/submit',{targets:[{type:'email',value:'demo@example.com'},{type:'username',value:'demo_user'}],consent:true});
console.log(JSON.stringify({baseUrl:BASE_URL,healthOk:health.ok,submitOk:submit.ok,jobId:submit.job_id||submit.id},null,2));
