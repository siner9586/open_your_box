import { handleScan } from '../../_lib/api.js';

export const onRequestPost = context => handleScan(context, 'company');
