import { startPhoneVerification } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return startPhoneVerification(context);}
