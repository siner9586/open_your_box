import { GateReason } from './types.js';
export async function requireVerifiedUser(){return{ok:false,code:GateReason.USER_NOT_VERIFIED};}
export async function requirePhoneOwnership(){return{ok:false,code:GateReason.PHONE_NOT_VERIFIED};}
export async function requireConsent(){return{ok:false,code:GateReason.CONSENT_REQUIRED};}
export async function canRunPhoneDeepScan(userId, phoneHash, env={}){if(env.ENABLE_PHONE_DEEP_SCAN!=='true')return{ok:false,code:GateReason.PHONE_DEEP_SCAN_DISABLED};if(!userId)return{ok:false,code:GateReason.USER_NOT_VERIFIED};return{ok:false,code:GateReason.USER_NOT_VERIFIED};}
