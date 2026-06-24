const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
export async function onRequestGet(context: any) {
  const DB = context.env.DB;
  if (!DB?.prepare) return json({ error: { code: 'D1_NOT_BOUND' } }, 500);
  const jobId = new URL(context.request.url).searchParams.get('jobId');
  if (!jobId) return json({ error: { code: 'JOB_ID_REQUIRED' } }, 400);
  const job = await DB.prepare('select id, user_id, subject_type, mode, status, progress, started_at, finished_at, created_at from jobs where id = ?').bind(jobId).first();
  if (!job) return json({ error: { code: 'JOB_NOT_FOUND' } }, 404);
  const counts = await DB.prepare('select status, result_status, count(*) as n from scan_queue where job_id = ? group by status, result_status').bind(jobId).all();
  const rows = await DB.prepare('select platform_id, platform_name, region, target_url, status, http_status, result_status, updated_at from scan_queue where job_id = ? order by updated_at desc limit 200').bind(jobId).all();
  return json({ job, counts: counts.results || [], results: rows.results || [] });
}
