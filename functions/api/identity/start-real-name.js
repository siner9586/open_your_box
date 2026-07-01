import { startRealName } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return startRealName(context);}
