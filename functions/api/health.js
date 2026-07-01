import { health } from '../../src/server/scan/async.js';
export async function onRequest(context){return health(context);}
