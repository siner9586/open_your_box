const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const res=await fetch(`${BASE_URL}/api/scan/submit`,{method:'POST',headers:{'content-type':'application/json','idempotency-key':`demo-${Date.now()}`},body:JSON.stringify({targets:[{type:'email',value:'demo@example.com'},{type:'username',value:'demo_user'}],consent:true})});
const data=await res.json().catch(()=>({ok:false}));
console.log(JSON.stringify(data,null,2));
if(!res.ok)process.exit(1);
