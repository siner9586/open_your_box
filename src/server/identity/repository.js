export const now=()=>new Date().toISOString();
export const id=(p='id')=>`${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,8)}`;
export const getDb=env=>env?.DB||env?.OYB_DB||env?.OYB_DATABASE||null;
export async function createOrGetUser(db,input={}){return{id:input.id||id('usr'),status:'active'};}
export async function createSession(){return{ok:true};}
export async function createIdentityVerification(db,input={}){return{id:id('iv'),status:input.status||'pending',...input};}
export async function getIdentityVerificationStatus(){return{status:'missing'};}
export async function createConsentRecord(db,input={}){return{id:id('consent'),status:'granted',...input};}
export async function revokeConsent(){return{revoked:true};}
export async function hasConsent(){return false;}
export async function createPhoneChallenge(db,input={}){return{id:id('phone_ch'),status:'pending',...input};}
export async function verifyPhoneChallenge(){return{ok:false,code:'PHONE_MANUAL_REVIEW_PENDING'};}
