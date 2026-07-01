import { scanResults } from '../../../src/server/scan/async.js';
export async function onRequestGet(context){return scanResults(context);}
