export function json(data,status=200){return new Response(JSON.stringify(data,null,2),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store'}});}
export function jsonError(code,status=400,message=code){return json({ok:false,error:{code,message}},status);}
export async function readJson(request){try{return await request.json();}catch{return{};}}
export async function submitScan(){return json({ok:true,status:'queued',job_id:`scan_${Date.now()}`});}
export async function scanStatus(){return json({ok:true,job:{status:'queued'}});}
export async function scanResults(){return json({ok:true,items:[],evidence:[],adapter_runs:[]});}
export async function scanAdapters(){return json({ok:true,adapters:[{id:'email-demo-self-check'},{id:'username-demo-self-check'},{id:'domain-demo-self-check'},{id:'restricted-mobile-gate',enabled:false}]});}
export async function runPending(){return json({ok:true,processed:0,fallback:'d1_pending'});}
export async function health(context={}){const env=context.env||{};return json({ok:true,db:{present:Boolean(env.DB)},secrets:{SCAN_SALT:env.SCAN_SALT?'present':'missing',CRON_SECRET:env.CRON_SECRET?'present':'missing',ADMIN_TOKEN:env.ADMIN_TOKEN?'present':'missing'},variables:{ENABLE_PHONE_DEEP_SCAN:env.ENABLE_PHONE_DEEP_SCAN||'false',IDENTITY_PROVIDER_MODE:env.IDENTITY_PROVIDER_MODE||'manual',ALLOW_DEV_LOGIN:env.ALLOW_DEV_LOGIN||'false'},queue:{present:Boolean(env.SCAN_QUEUE)},fallback:{d1_pending:Boolean(env.DB)}});}
