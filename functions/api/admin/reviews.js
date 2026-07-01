import { adminReviews } from '../../../src/server/identity/api.js';
export async function onRequestGet(context){return adminReviews(context);}
