/*
 * Nachbildung der GitHub-API für die Ablage (method-commons/sync): Dateien mit sha, Ändern nur auf
 * dem aktuellen Stand – wie das echte Repo; dazu Commits je Datei und Tags für die Versionen.
 * Ein „anderes Gerät“ schreibt mit `gh.write` direkt in die Ablage.
 */

export const APP = 'user-story-app';
export const REPO = 'team/methoden';
const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, content-type, x-github-api-version, accept',
  'access-control-allow-methods': 'GET, PUT, POST, DELETE',
};

export async function fakeGitHub(page, { files = {} } = {}) {
  const gh = { files: new Map(), messages: [], n: 0, requests: 0, commits: [], refs: new Map(), tags: new Map() };
  /** Commit festhalten (für die Versionen). */
  const commit = (path, text, message) => gh.commits.push({ sha: `c${gh.commits.length + 1}`, path, text, message, date: new Date().toISOString() });
  /** Datei schreiben wie ein anderes Gerät (neuer sha). */
  gh.write = (path, record, message = `${record.data?.title} (${record.device})`) => {
    const text = JSON.stringify(record, null, 2);
    gh.files.set(path, { sha: `sha${++gh.n}`, text });
    commit(path, text, message);
  };
  gh.read = path => (gh.files.has(path) ? JSON.parse(gh.files.get(path).text) : null);
  for (const [path, record] of Object.entries(files)) gh.write(path, record);

  await page.route('https://api.github.com/**', async route => {
    gh.requests++;
    const req = route.request();
    const method = req.method();
    const url = new URL(req.url());
    const json = (status, body) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json' }, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    if (req.headers().authorization !== 'Bearer github_pat_test') return json(401, { message: 'Bad credentials' });
    if (url.pathname === `/repos/${REPO}`) return json(200, { full_name: REPO, private: true });
    // Versionen: Commits einer Datei, Tags
    if (url.pathname === `/repos/${REPO}/commits`) {
      const page = Number(url.searchParams.get('page') || 1);
      const list = gh.commits.filter(c => c.path === url.searchParams.get('path')).reverse().slice((page - 1) * 30, page * 30);
      return json(200, list.map(c => ({ sha: c.sha, commit: { message: c.message, committer: { date: c.date } } })));
    }
    const git = url.pathname.slice(`/repos/${REPO}/git/`.length);
    if (url.pathname.startsWith(`/repos/${REPO}/git/`)) {
      const body = JSON.parse(req.postData() || '{}');
      if (method === 'POST' && git === 'tags') {
        const sha = `t${gh.tags.size + 1}`;
        gh.tags.set(sha, { sha, tag: body.tag, message: `${body.message}\n`, object: { sha: body.object, type: 'commit' }, tagger: { date: new Date().toISOString() } });
        return json(201, { sha });
      }
      if (method === 'POST' && git === 'refs') {
        if (gh.refs.has(body.ref)) return json(422, { message: 'Reference already exists' });
        gh.refs.set(body.ref, body.sha);
        return json(201, { ref: body.ref });
      }
      if (git.startsWith('matching-refs/')) {
        const prefix = `refs/${decodeURIComponent(git.slice('matching-refs/'.length))}`;
        return json(200, [...gh.refs].filter(([r]) => r.startsWith(prefix)).map(([ref, sha]) => ({ ref, object: { sha, type: 'tag' } })));
      }
      if (git.startsWith('tags/') && gh.tags.has(git.slice(5))) return json(200, gh.tags.get(git.slice(5)));
      return json(404, { message: 'Not Found' });
    }
    const m = url.pathname.match(new RegExp(`^/repos/${REPO}/contents/(.+)$`));
    if (!m) return json(404, { message: 'Not Found' });
    const path = decodeURIComponent(m[1]);
    const cur = gh.files.get(path);
    if (method === 'GET') {
      const ref = url.searchParams.get('ref');
      const old = ref && gh.commits.find(c => c.sha === ref && c.path === path);
      if (ref && ref.startsWith('c')) return old ? json(200, { type: 'file', sha: 'x', content: Buffer.from(old.text).toString('base64') }) : json(404, { message: 'Not Found' });
      if (cur) return json(200, { type: 'file', sha: cur.sha, content: Buffer.from(cur.text).toString('base64') });
      const dir = [...gh.files].filter(([p]) => p.startsWith(`${path}/`)).map(([p, f]) => ({ type: 'file', name: p.slice(path.length + 1), sha: f.sha }));
      return dir.length ? json(200, dir) : json(404, { message: 'Not Found' });
    }
    const body = JSON.parse(req.postData() || '{}');
    if (method === 'PUT') {
      if (cur && body.sha !== cur.sha) return json(cur && !body.sha ? 422 : 409, { message: 'sha does not match' });
      const sha = `sha${++gh.n}`;
      const text = Buffer.from(body.content, 'base64').toString('utf8');
      gh.files.set(path, { sha, text });
      gh.messages.push(body.message);
      commit(path, text, body.message);
      return json(cur ? 200 : 201, { content: { sha } });
    }
    if (method === 'DELETE') {
      if (!cur) return json(404, { message: 'Not Found' });
      if (body.sha !== cur.sha) return json(409, { message: 'sha does not match' });
      gh.files.delete(path);
      gh.messages.push(body.message);
      return json(200, {});
    }
    return json(405, {});
  });
  return gh;
}
