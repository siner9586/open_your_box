import { verifyDnsTxt } from '../../_lib/api.js';

export const onRequestPost = context => verifyDnsTxt(context);
