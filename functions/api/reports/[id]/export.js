import { exportReport } from '../../../_lib/api.js';

export const onRequestGet = context => exportReport(context);
