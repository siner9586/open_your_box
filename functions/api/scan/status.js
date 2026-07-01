import { scanStatus } from '../../../src/server/scan/async.js';
export async function onRequestGet(context){return scanStatus(context);}
