import { privacyRequest } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return privacyRequest(context);}
