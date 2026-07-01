import { devLogin } from '../../../src/server/identity/api.js';
export async function onRequestPost(context){return devLogin(context);}
