import { json, jsonError, readJson } from '../scan/async.js';
import { getIdentityProvider } from './providers.js';
import { maskEmail, maskGeneric } from './security.js';
import { id } from './repository.js';

export async function devLogin(context){const env=context.env||{};if(env.ALLOW_DEV_LOGIN!=='true'||env.IDENTITY_PROVIDER_MODE!=='mock')return jsonError('DEV_LOGIN_DISABLED',403,'Development login is disabled.');const input=await readJson(context.request);return json({ok:true,user_id:id('usr'),session_token:id('session'),display_name_masked:maskGeneric(input.display_name||'demo','name'),email_masked:maskEmail(input.email||'demo@example.com')});}
export async function startRealName(context){const env=context.env||{};const provider=getIdentityProvider(env);return json({ok:true,status:provider.allowed?'verified':'pending',provider:provider.id,verification_id:id('iv'),note:provider.allowed?'mock dev only':'manual review required'});}
export async function identityStatus(){return json({ok:true,real_name:'missing',phone_ownership:'missing',consents:[]});}
export async function startPhoneVerification(context){const provider=getIdentityProvider(context.env||{});return json({ok:true,status:provider.allowed?'pending':'pending',challenge_id:id('phone_ch'),provider:provider.id,note:'manual review or mock dev challenge only'});}
export async function verifyPhone(){return json({ok:false,error:{code:'PHONE_MANUAL_REVIEW_PENDING',message:'Manual review is required outside mock development.'}},202);}
export async function grantConsent(){return json({ok:true,status:'granted',consent_id:id('consent')});}
export async function revokeConsent(){return json({ok:true,status:'revoked'});}
export async function privacyRequest(){return json({ok:true,status:'pending',request_id:id('privacy')});}
export async function adminReviews(context){const token=context.request.headers.get('x-admin-token')||'';if(!token||token!==context.env.ADMIN_TOKEN)return jsonError('ADMIN_REQUIRED',401,'Admin token required.');return json({ok:true,reviews:[]});}
export async function adminReviewDecide(context){const token=context.request.headers.get('x-admin-token')||'';if(!token||token!==context.env.ADMIN_TOKEN)return jsonError('ADMIN_REQUIRED',401,'Admin token required.');return json({ok:true,status:'decided'});}
