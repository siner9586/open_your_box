const json = (data: unknown, status = 200) => new Response(JSON.stringify(data, null, 2), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
const now = () => new Date().toISOString();
const id = (p: string) => `${p}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
const safe = (e: any) => String(e?.message || e || 'unknown_error').slice(0, 180);
async function probe(url: string) {
  try {
    const res = await fetch(url, { method: 'GET', redirect: 'follow', headers: { 'user-agent': 'OpenYourBox-AsyncSelfCheck/1.0' } });
    const text = res.status === 200 ? (await res.text().catch(() => '')).slice(0, 1000) : '';
    const noEvidence = res.status === 404 || res.status === 410 || /not found|page not found|用户不存在|页面不存在|该用户不存在|doesn't exist|不存在/i.test(text);
    const blocked = [401, 403, 429, 503].includes(res.status);
    const result = res.status === 200 && !noEvidence ? 'confirmed' : blocked || (res.status >= 300 && res.status < 400) ? 'possible' : noEvidence ? 'no_evidence' : 'failed';
    return { httpStatus: res.status, result, preview: text.replace(/\s+/g, ' ').slice(0, 180), error: '' };
  } catch (error) { return { httpStatus: 0, result: 'failed', preview: '', error: safe(error) }; }
}
export async function onRequestPost(context: any) {
  const DB = context.env.DB;
  if (!DB?.prepare) return json({ error: { code: 'D1_NOT_BOUND' } }, 500);
  const url = new URL(context.request.url);
  const body = await context.request.json().catch(() => ({}));
  const jobId = body.jobId || url.searchParams.get('jobId');
  const limit = Math.max(1, Math.min(Number(body.limit || url.searchParams.get('limit') || 20), 50));
  if (!jobId) return json({ error: { code: 'JOB_ID_REQUIRED' } }, 400);
  await DB.prepare('update jobs set status = ?, progress = ? where id = ? and status in (?, ?)').bind('running', 1, jobId, 'queued', 'running').run();
  const rows = await DB.prepare('select * from scan_queue where job_id = ? and status = ? order by created_at asc limit ?').bind(jobId, 'pending', limit).all();
  const items = rows.results || [];
  for (const item of items) {
    const r = await probe(item.target_url);
    await DB.prepare('update scan_queue set status = ?, http_status = ?, result_status = ?, evidence_preview = ?, error_message = ?, updated_at = ? where id = ?').bind('done', r.httpStatus, r.result, r.preview, r.error, now(), item.id).run();
    const label = r.result === 'confirmed' ? '公开主页可访问' : r.result === 'possible' ? '公开主页受限或重定向' : r.result === 'no_evidence' ? '未发现公开主页证据' : '公开探测失败';
    await DB.prepare('insert or replace into findings (id,job_id,user_id,source,category,severity,confidence,title,summary,evidence_type,evidence_preview,evidence_ref,remediation_json,created_at) values (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(id('finding_async'), jobId, 'local', 'async_username_public_probe', r.result, r.result === 'confirmed' ? 'low' : 'info', r.result === 'confirmed' ? 'verified' : 'medium', `${item.platform_name} 异步公开主页探测：${label}`, `HTTP ${r.httpStatus} · ${item.target_url}`, 'public_profile_url', r.preview || item.identifier_masked, item.target_url, JSON.stringify({ actionType: 'review_public_profile', steps: ['人工确认是否本人', '确认后再处理公开资料'] }), now()).run();
  }
  const counts = await DB.prepare('select status, result_status, count(*) as n from scan_queue where job_id = ? group by status, result_status').bind(jobId).all();
  const pendingRow = await DB.prepare('select count(*) as n from scan_queue where job_id = ? and status = ?').bind(jobId, 'pending').first();
  const totalRow = await DB.prepare('select count(*) as n from scan_queue where job_id = ?').bind(jobId).first();
  const pending = Number(pendingRow?.n || 0), total = Number(totalRow?.n || 0), done = total - pending;
  const progress = total ? Math.floor((done / total) * 100) : 100;
  await DB.prepare('update jobs set status = ?, progress = ?, finished_at = ? where id = ?').bind(pending ? 'running' : 'completed', progress, pending ? '' : now(), jobId).run();
  return json({ status: pending ? 'running' : 'completed', jobId, processedThisBatch: items.length, total, done, pending, progress, counts: counts.results || [] });
}
