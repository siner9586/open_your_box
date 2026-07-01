import { listReports } from '../../_lib/api.js';

export const onRequestGet = context => listReports(context);
