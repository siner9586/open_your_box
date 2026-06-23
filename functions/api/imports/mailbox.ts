import { handleUpload } from '../../_lib/api.js';
export const onRequestPost = (context) => handleUpload(context, 'mailbox');
