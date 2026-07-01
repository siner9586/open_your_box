import { scanAdapters } from '../../../src/server/scan/async.js';
export async function onRequestGet(){return scanAdapters();}
