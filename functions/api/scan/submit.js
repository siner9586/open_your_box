import { submitScan } from '../../../src/server/scan/async.js';
export async function onRequestPost(context){return submitScan(context);}
