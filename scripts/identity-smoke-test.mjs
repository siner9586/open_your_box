const BASE_URL=(process.env.BASE_URL||'http://127.0.0.1:8788').replace(/\/$/,'');
const ADMIN_TOKEN=process.env.ADMIN_TOKEN||'dev-admin';
async function req(method,path,body,headers={}){const r=await fetch(`${BASE_URL}${path}`,{method,headers:{'content-type':'application/json','idempotency-key':`identity-${Date.now()}`,...headers},body:body?JSON.stringify(body):undefined});const d=await r.json().catch(()=>({}));return{status:r.status,ok:r.ok,data:d};}
const dev=await req('POST','/api/auth/dev-login',{display_name:'demo user',email:'demo@example.com'});
const real=await req('POST','/api/identity/start-real-name',{user_id:'usr_demo',name:'Demo User',id_number:'ID-EXAMPLE-0000',consent:true});
const status=await req('GET','/api/identity/status?user_id=usr_demo');
const phone=await req('POST','/api/identity/start-phone-verification',{user_id:'usr_demo',phone:'+15550101000',consent:true});
const verify=await req('POST','/api/identity/verify-phone',{challenge_id:phone.data.challenge_id||'missing',code:'000000'});
const consent=await req('POST','/api/consent/grant',{user_id:'usr_demo',consent_type:'phone_deep_scan',target_type:'phone',target_value:'+15550101000',consent_version:'2026-07-01'});
const scan=await req('POST','/api/scan/submit',{user_id:'usr_demo',mode:'deep',targets:[{type:'phone',value:'+15550101000',mode:'deep'}]});
const normal=await req('POST','/api/scan/submit',{targets:[{type:'email',value:'demo@example.com'},{type:'username',value:'demo_user'}],consent:true});
const adminNo=await req('GET','/api/admin/reviews');
const adminYes=await req('GET','/api/admin/reviews',null,{'x-admin-token':ADMIN_TOKEN});
const privacy=await req('POST','/api/privacy/request',{user_id:'usr_demo',request_type:'export',scope:'self'});
const summary={baseUrl:BASE_URL,devLoginStatus:dev.status,realNameStatus:real.data.status,identityStatus:status.status,phoneStatus:phone.data.status,verifyStatus:verify.status,consentStatus:consent.data.status,phoneDeepScanReason:JSON.stringify(scan.data).includes('PHONE_DEEP_SCAN_DISABLED')?'PHONE_DEEP_SCAN_DISABLED':'see-output',normalScanOk:normal.ok,adminWithoutToken:adminNo.status,adminWithToken:adminYes.status,privacyStatus:privacy.data.status};
console.log(JSON.stringify(summary,null,2));
if(!normal.ok||adminNo.status!==401||real.status>=500||phone.status>=500||status.status!==200||privacy.status>=500)process.exit(1);
