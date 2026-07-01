import { verifyPhone } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return verifyPhone(context);}
