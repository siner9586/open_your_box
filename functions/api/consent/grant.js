import { grantConsent } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return grantConsent(context);}
