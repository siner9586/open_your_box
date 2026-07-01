import { adminReviewDecide } from '../../../../src/server/identity/api.js';
export async function onRequestPost(context){return adminReviewDecide(context);}
