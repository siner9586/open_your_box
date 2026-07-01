import { revokeConsent } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return revokeConsent(context);}
