#!/usr/bin/env node
/**
 * Weekly health check across every AthlitIQ conference site.
 *
 *   node scripts/health-check.js            # full run, writes the report
 *   node scripts/health-check.js --no-live  # skip the ArbiterLive spot-check
 *   node scripts/health-check.js --force    # report even if this week already ran
 *
 * Writes health-report.md and updates data/health-history.json. The workflow
 * turns the report into a GitHub issue.
 *
 * Why this exists
 * ---------------
 * On 2026-09-26 four of Skyland's eight ArbiterLive schools, two of NJAC's ten
 * and one of SEC's forty were returning roughly half their season. Every build
 * was green: each school returned SOME games, every source counted as ok, and
 * the totals looked plausible. Nothing in the existing guards could see it.
 *
 * So this checks three separate things, because each hides the others:
 *
 *   1. Is the bot still running?      published "generated" date vs now
 *   2. Did the numbers move oddly?    totals vs last week's snapshot
 *   3. Is a source quietly short?     a live single-request vs paged
 *                                     comparison against ArbiterLive itself
 *
 * (3) is the only one that catches truncation. The month-span heuristic in
 * each site's check-schedule.js caught the severe cases and missed Bloomfield
 * (26% short), Watchung Hills (16%) and Somerville (14%) — they keep a wide
 * date span while losing games inside it.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const HISTORY = path.join(ROOT, 'data', 'health-history.json');
const REPORT = path.join(ROOT, 'health-report.md');

const OWNER = 'kandyanything';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 '
    + '(KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ARB = 'https://www.arbiterlive.com';

/**
 * Each site, and where its published schedule lives. NJIC is schedule-only and
 * has no data/schedule.json — its numbers are in the split index instead.
 */
const SITES = [
    { key: 'bignorth', label: 'Big North', repo: 'big-north-conference' },
    { key: 'njac', label: 'NJAC', repo: 'nwjerseyac-new' },
    { key: 'sec', label: 'SEC', repo: 'super-essex-conference' },
    { key: 'skyland', label: 'Skyland', repo: 'skyland-conference' },
    { key: 'ucc', label: 'UCC', repo: 'union-county-conference' },
    { key: 'njic', label: 'NJIC', repo: 'njic-schedule', summaryOnly: 'data/schedule/index.json' },
    { key: 'olympic', label: 'Olympic', repo: 'olympic-conference' },
];

const SAMPLE_SIZE = 12;          // ArbiterLive schools re-tested per week
const STALE_DAYS = 2;            // a 3-hourly bot silent this long is a problem
const SWING = 0.08;              // week-on-week move worth mentioning

const raw = (repo, file) => `https://raw.githubusercontent.com/${OWNER}/${repo}/main/${file}`;

async function getJson(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
}
async function getText(url) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.text();
}

/* ---------- 1. what each site is publishing ---------- */

async function readSite(site) {
    const out = { ...site, problems: [], notes: [] };
    try {
        // The full file carries sources and games; the index carries counts only.
        const full = site.summaryOnly ? null : await getJson(raw(site.repo, 'data/schedule.json'));
        const idx = full || await getJson(raw(site.repo, site.summaryOnly));

        out.games = (idx.counts && (idx.counts.deduped ?? idx.counts.games))
            ?? (full && full.games ? full.games.length : null);
        out.generated = idx.generated || (full && full.generated) || null;
        out.coverage = idx.coverage || null;

        if (full) {
            const sources = full.sources || [];
            out.sourcesOk = sources.filter(s => s.ok).length;
            out.sourcesTotal = sources.length;
            const failed = sources.filter(s => !s.ok);
            failed.forEach(s => out.problems.push(`source returned nothing: **${s.school}** [${s.source}]${s.error ? ` — ${s.error}` : ''}`));
            out.thin = thinSchools(full);
        } else if (out.coverage) {
            out.sourcesOk = out.coverage.schoolsFetched;
            out.sourcesTotal = out.coverage.schoolsInConference;
            if (out.coverage.complete === false) out.problems.push('coverage reports incomplete');
        }

        if (out.generated) {
            const ageH = (Date.now() - Date.parse(out.generated)) / 36e5;
            out.ageHours = Math.round(ageH);
            if (ageH > STALE_DAYS * 24) {
                out.problems.push(`**the bot has not committed for ${Math.round(ageH / 24)} days** — last build ${String(out.generated).slice(0, 16)}`);
            }
        }
    } catch (err) {
        out.problems.push(`could not read published schedule: ${err.message}`);
    }
    return out;
}

/**
 * A school is counted on EITHER side of a fixture. Counting only rows where
 * `school` matches undercounts badly, because de-duplication keeps one row per
 * fixture and attributes it to whichever side was processed first — that made
 * Weequahic look like 46 games when its own feed carries 151.
 */
function thinSchools(full) {
    const games = full.games || [];
    const sources = full.sources || [];
    const norm = s => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

    const appears = {}, span = {};
    for (const g of games) {
        const sides = new Set();
        (g.schools || [g.school, g.opponent]).forEach(x => { if (x) sides.add(norm(x)); });
        for (const s of sides) {
            appears[s] = (appears[s] || 0) + 1;
            (span[s] = span[s] || new Set()).add(String(g.date).slice(0, 7));
        }
    }
    const confMonths = new Set(games.map(g => String(g.date).slice(0, 7))).size;
    const floor = Math.max(2, Math.floor(confMonths * 0.5));

    const rows = sources.map(s => ({
        school: s.school, src: s.source,
        appears: appears[norm(s.school)] || 0,
        months: (span[norm(s.school)] || new Set()).size,
    }));
    const vols = rows.map(r => r.appears).filter(Boolean).sort((a, b) => a - b);
    const median = vols[Math.floor(vols.length / 2)] || 0;

    return rows
        .filter(r => r.appears > 0 && (r.appears < median * 0.35 || r.months < floor))
        .sort((a, b) => a.appears - b.appears)
        .map(r => ({ ...r, median, confMonths }));
}

/* ---------- 2. the live ArbiterLive spot-check ---------- */

/**
 * Each site keeps its ArbiterLive roster differently — some in a JSON file,
 * some inline in build-schedule.js — so try the files first and fall back to
 * reading the ids straight out of the script. Reading them from the repo
 * rather than duplicating them here means the list can never drift.
 */
async function arbiterRoster(site) {
    let js;
    try { js = await getText(raw(site.repo, 'scripts/build-schedule.js')); }
    catch { return []; }

    const decl = js.match(/const\s+ARBITER_SCHOOLS\s*=\s*([\s\S]*?);\s*\n/);
    if (!decl) return [];

    // "= require('./skyland-arbiter-schools.json')" — fetch exactly that file.
    // Several repos also carry a stale arbiter-schools.json they no longer use,
    // so never guess the name.
    const req = decl[1].match(/require\(['"]\.\/([^'"]+)['"]\)/);
    if (req) {
        try {
            const list = await getJson(raw(site.repo, 'scripts/' + req[1]));
            return Array.isArray(list) ? list.filter(x => x && x.entityId) : [];
        } catch { return []; }
    }

    // Inline array. name and entityId appear in either order across the sites.
    const block = js.match(/const\s+ARBITER_SCHOOLS\s*=\s*\[([\s\S]*?)\n\];/);
    if (!block) return [];
    const out = [];
    for (const entry of block[1].split(/\}\s*,?/)) {
        const id = entry.match(/entityId:\s*(\d+)/);
        const nm = entry.match(/name:\s*'([^']+)'/) || entry.match(/name:\s*"([^"]+)"/);
        if (id && nm) out.push({ name: nm[1], entityId: Number(id[1]) });
    }
    return out;
}

async function singleRequestCount(entityId, start, end) {
    const calUrl = `${ARB}/School/Calendar/${entityId}`;
    const seed = await fetch(calUrl, { headers: { 'User-Agent': UA } });
    if (!seed.ok) throw new Error(`calendar page ${seed.status}`);
    const cookie = (seed.headers.getSetCookie ? seed.headers.getSetCookie() : [])
        .map(c => c.split(';')[0]).join('; ');
    const res = await fetch(`${ARB}/School/GetEventsByEntity/`, {
        method: 'POST',
        headers: {
            'User-Agent': UA, 'X-Requested-With': 'XMLHttpRequest', Referer: calUrl,
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            ...(cookie ? { Cookie: cookie } : {}),
        },
        body: new URLSearchParams({ startDate: start, endDate: end }).toString(),
    });
    if (!res.ok) throw new Error(`events endpoint ${res.status}`);
    const detail = JSON.parse((await res.json()).EventsFilteredDetailString || '[]');
    return detail.filter(e => /fc-event-type-Game/.test(e.className || '')).length;
}

function seasonRange() {
    // Aug through Jul of the current school year, the same window the builds use.
    const now = new Date();
    const y = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
    return [`${y}-8-1`, `${y + 1}-7-31`];
}

async function spotCheck(pool, cursor) {
    const arbiter = require(path.join(ROOT, 'scripts', 'sources', 'arbiter.js'));
    const [start, end] = seasonRange();
    const picked = [];
    for (let i = 0; i < Math.min(SAMPLE_SIZE, pool.length); i++) {
        picked.push(pool[(cursor + i) % pool.length]);
    }

    const results = [];
    for (const p of picked) {
        try {
            const one = await singleRequestCount(p.entityId, start, end);
            await new Promise(r => setTimeout(r, 700));
            const many = (await arbiter.fetchSchool(p, start, end, { pauseMs: 260 })).length;
            let verdict = 'ok';
            // paged > single means ArbiterLive truncated the long request, which is
            // exactly what paging is for — the site is fine, this is informational.
            // Any real excess means the single request was truncated. The old 1.15
            // buffer existed to absorb "dedup across window edges", which turned out
            // not to be a thing — a healthy school matches exactly. Allow 2 games of
            // churn for a fixture added between the two calls, nothing more.
            if (many > one + 2) verdict = 'truncating (paging is doing its job)';
            // paged < single means OUR windows are dropping something. That is a bug.
            if (many < one) verdict = 'PAGED IS SHORT — windows are losing games';
            results.push({ ...p, one, many, verdict });
        } catch (err) {
            results.push({ ...p, error: err.message });
        }
        await new Promise(r => setTimeout(r, 700));
    }
    return { results, nextCursor: (cursor + picked.length) % Math.max(1, pool.length) };
}

/* ---------- 3. the report ---------- */

function isoWeek(d = new Date()) {
    const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    t.setUTCDate(t.getUTCDate() + 4 - (t.getUTCDay() || 7));
    const jan1 = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
    return `${t.getUTCFullYear()}-W${String(Math.ceil(((t - jan1) / 864e5 + 1) / 7)).padStart(2, '0')}`;
}

function buildReport(sites, spot, prev) {
    const L = [];
    const problems = [];

    L.push(`_Checked ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC._`, '');
    L.push('| Site | Games | Sources | Last build | vs last week |');
    L.push('|---|---:|:---:|---|---:|');

    for (const s of sites) {
        const before = prev.sites && prev.sites[s.key];
        let delta = '—';
        if (before && before.games != null && s.games != null) {
            const d = s.games - before.games;
            delta = d === 0 ? '0' : (d > 0 ? `+${d}` : `${d}`);
            if (before.games > 0 && Math.abs(d) / before.games > SWING) {
                problems.push(`**${s.label}**: game count moved ${((d / before.games) * 100).toFixed(0)}% in a week (${before.games} → ${s.games})`);
            }
        }
        const src = s.sourcesTotal ? `${s.sourcesOk}/${s.sourcesTotal}` : '—';
        const age = s.generated ? String(s.generated).slice(0, 10) : '—';
        L.push(`| ${s.label} | ${s.games == null ? '—' : s.games.toLocaleString()} | ${src} | ${age} | ${delta} |`);
        s.problems.forEach(p => problems.push(`**${s.label}**: ${p}`));
    }

    if (spot && spot.results.length) {
        L.push('', '### ArbiterLive spot-check', '',
            `Re-fetched ${spot.results.length} schools two ways — one request for the whole season, then paged by month.`,
            '', '| School | single | paged | |', '|---|---:|---:|---|');
        for (const r of spot.results) {
            if (r.error) { L.push(`| ${r.name} | — | — | error: ${r.error} |`); continue; }
            const mark = r.verdict === 'ok' ? 'ok' : (r.verdict.startsWith('PAGED') ? `⚠️ ${r.verdict}` : r.verdict);
            L.push(`| ${r.name} | ${r.one} | ${r.many} | ${mark} |`);
            if (r.verdict.startsWith('PAGED')) {
                problems.push(`**${r.name}**: paged fetch returned ${r.many} against a single request's ${r.one} — the month windows are dropping games`);
            }
        }
    }

    const thin = [];
    sites.forEach(s => (s.thin || []).forEach(t => thin.push(
        `**${s.label}** — ${t.school} [${t.src}]: ${t.appears} appearances`
        + (t.appears < t.median * 0.35 ? ` (site median ${t.median})` : '')
        + (t.months < Math.max(2, Math.floor(t.confMonths * 0.5)) ? `, ${t.months}-month span vs ${t.confMonths}` : ''))));

    if (thin.length) {
        L.push('', '### Thin schools', '',
            'Low volume or a short season span. Often genuine — a small programme, or a feed that only publishes the current term — but worth an eye.', '');
        thin.forEach(t => L.push(`- ${t}`));
    }

    const head = problems.length
        ? [`**${problems.length} thing${problems.length === 1 ? '' : 's'} to look at**`, '', ...problems.map(p => `- ${p}`), '']
        : ['**All clear.** Every site is building, every source reporting, and no school came back short.', ''];

    return { markdown: [...head, ...L].join('\n'), problemCount: problems.length };
}

/* ---------- run ---------- */

(async () => {
    const args = process.argv.slice(2);
    const live = !args.includes('--no-live');
    const force = args.includes('--force');

    let prev = { week: null, cursor: 0, sites: {} };
    try { prev = JSON.parse(fs.readFileSync(HISTORY, 'utf8')); } catch { /* first run */ }

    const week = isoWeek();
    // GitHub drops a good share of scheduled runs, so the workflow fires on
    // several days and this keeps only the first one to land each week.
    if (prev.week === week && !force) {
        console.log(`already reported for ${week} — nothing to do (use --force to override)`);
        fs.writeFileSync(path.join(ROOT, 'health-skip'), 'skip', 'utf8');
        return;
    }

    console.log(`health check for ${week}\n`);
    const sites = [];
    for (const s of SITES) {
        const r = await readSite(s);
        sites.push(r);
        console.log(`  ${r.label.padEnd(10)} ${r.games == null ? '?' : r.games} games, sources ${r.sourcesOk ?? '?'}/${r.sourcesTotal ?? '?'}, ${r.problems.length} problem(s)`);
    }

    let spot = null;
    if (live) {
        // Interleave by site so a week's sample spans conferences. Ordered by
        // site, the first several weeks would only ever look at SEC, which holds
        // 40 of the 81 ArbiterLive schools.
        const perSite = [];
        for (const s of SITES) {
            const roster = await arbiterRoster(s);
            perSite.push(roster.map(x => ({ name: `${x.name} (${s.label})`, entityId: x.entityId })));
        }
        const totalArb = perSite.reduce((n, r) => n + r.length, 0);
        const pool = [];
        for (let i = 0; pool.length < totalArb; i++) {
            for (const r of perSite) if (r[i]) pool.push(r[i]);
        }
        console.log(`\n  ArbiterLive pool: ${pool.length} schools; sampling ${Math.min(SAMPLE_SIZE, pool.length)} from cursor ${prev.cursor || 0}`);
        if (pool.length) {
            spot = await spotCheck(pool, prev.cursor || 0);
            spot.results.forEach(r => console.log(`     ${r.error ? 'ERR ' : ''}${r.name}: ${r.one ?? '-'} vs ${r.many ?? '-'} ${r.verdict || r.error}`));
        }
    }

    const { markdown, problemCount } = buildReport(sites, spot, prev);
    fs.writeFileSync(REPORT, markdown, 'utf8');

    const snapshot = { week, checked: new Date().toISOString(), cursor: spot ? spot.nextCursor : (prev.cursor || 0), sites: {} };
    sites.forEach(s => { snapshot.sites[s.key] = { games: s.games ?? null, sourcesOk: s.sourcesOk ?? null, generated: s.generated ?? null }; });
    fs.mkdirSync(path.dirname(HISTORY), { recursive: true });
    fs.writeFileSync(HISTORY, JSON.stringify(snapshot, null, 2) + '\n', 'utf8');

    console.log(`\n  ${problemCount} problem(s); report written to health-report.md`);
    fs.writeFileSync(path.join(ROOT, 'health-problems'), String(problemCount), 'utf8');
})();
