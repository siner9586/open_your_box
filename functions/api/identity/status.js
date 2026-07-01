import { identityStatus } from '../../../src/server/identity/api.js';
export async function onRequestGet(context){return identityStatus(context);}
