const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const res=await fetch(`${BASE_URL}/api/health`);
const data=await res.json().catch(()=>({ok:false}));
console.log(JSON.stringify({baseUrl:BASE_URL,status:res.status,health:data},null,2));
if(!res.ok)process.exit(1);
