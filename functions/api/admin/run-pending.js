import { runPending } from '../../../src/server/scan/async.js';
export async function onRequestPost(context){return runPending(context);}
