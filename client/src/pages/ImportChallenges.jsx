import { useState } from 'react';
import { api } from '../lib/api.js';
import { parseCsv } from '../lib/csv.js';
import { useSession } from '../lib/session.jsx';
import { Icon } from '../components/ui.jsx';

// Bulk import: parse a CSV in the browser, check every row on the server
// (dry run), then send the valid rows to the review queue.
export default function ImportChallenges({ onDone }) {
  const { user, notify } = useSession();
  const [rows, setRows] = useState(null);
  const [results, setResults] = useState(null);
  const [busy, setBusy] = useState(false);
  const [pasted, setPasted] = useState('');

  async function check(parsed) {
    setRows(parsed);
    setResults(null);
    if (!parsed.length) return notify('No rows found. Is the first line a header?', true);
    setBusy(true);
    try {
      const { results: r } = await api('/api/challenges/import', { method: 'POST', body: { rows: parsed, dry_run: true } });
      setResults(r);
    } catch (err) {
      notify(err.message, true);
    } finally {
      setBusy(false);
    }
  }

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (file) check(parseCsv(await file.text()));
    e.target.value = '';
  }

  async function submit() {
    setBusy(true);
    try {
      const { created } = await api('/api/challenges/import', { method: 'POST', body: { rows } });
      onDone(`${created} challenge${created === 1 ? '' : 's'} sent for review.`);
    } catch (err) {
      notify(err.message, true);
      setBusy(false);
    }
  }

  const valid = results?.filter((r) => !r.error).length ?? 0;

  return (
    <div className="stack">
      <div className="group">
        <h3>1 · Get the template</h3>
        <div className="fields">
          <p className="hint">
            One challenge per row. Use <code>mini</code>/<code>project</code> and <code>individual</code>/<code>team</code>,
            separate skills and topics with semicolons, and write times as <code>YYYY-MM-DDTHH:MM</code> in the row's time zone.
            {user?.role === 'company' && ` Rows are posted as ${user.name}.`}
          </p>
          <a className="btn secondary" href="/challenge-template.csv" download>Download CSV template <Icon name="arrow" /></a>
        </div>
      </div>

      <div className="group">
        <h3>2 · Upload</h3>
        <div className="fields">
          <label>CSV file<input type="file" accept=".csv,text/csv" onChange={onFile} /></label>
          <label>…or paste CSV
            <textarea rows={5} placeholder="company_name,title,summary,…" value={pasted} onChange={(e) => setPasted(e.target.value)} />
          </label>
          {pasted.trim() && (
            <button type="button" className="btn secondary" disabled={busy} onClick={() => check(parseCsv(pasted))}>Check pasted rows</button>
          )}
          <p className="hint">Up to 100 rows. Every row is checked before anything is submitted.</p>
        </div>
      </div>

      {rows && (
        <div className="group">
          <h3>3 · Check & submit</h3>
          <div className="fields">
            {busy && !results && <p className="muted">Checking {rows.length} rows…</p>}
            {results && (
              <>
                <p><b>{valid} of {results.length}</b> rows are ready. {results.length - valid > 0 && 'Rows with problems will be skipped. Fix them and re-upload to include them.'}</p>
                <div className="rows">
                  {results.map((r) => (
                    <div className="list-row" key={r.row}>
                      <div>
                        <h3 style={{ fontSize: 15 }}>{r.row}. {r.title || <span className="muted">(no title)</span>}</h3>
                        {r.error && <div className="small" style={{ color: 'var(--scarlet)' }}>{r.error}</div>}
                      </div>
                      <div className="actions">{r.error ? <span className="tag">Fix needed</span> : <span className="tag muted">Ready</span>}</div>
                    </div>
                  ))}
                </div>
                <button className="btn" disabled={busy || !valid} onClick={submit}>
                  Send {valid} for review <Icon name="arrow" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
