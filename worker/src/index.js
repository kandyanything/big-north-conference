// Drives the hourly 11 am - 3 pm ET refresh window for four conference sites.
//
// GitHub's own scheduler honours roughly half the slots a workflow asks for.
// Measured on NJAC on 2026-09-29: of eight daily slots it ran three, and the
// ones it did run drifted 21-45 minutes late, leaving a five-and-a-half hour
// hole straight through the morning - exactly when schools enter same-day
// changes. A Morristown girls soccer fixture sat in DigitalSports for hours
// without reaching the conference site.
//
// Cloudflare's cron fires reliably, so this Worker keeps the time and asks
// GitHub to run each job now via workflow_dispatch, which is an ordinary API
// call and is not rate-limited the way the scheduler is. Each workflow keeps
// its own cron as an off-peak fallback.
//
// NJIC has its own Worker (njic-refresh-trigger) covering the same window; it
// predates this one and is left alone rather than merged, so a change here
// cannot take NJIC down with it.
//
// SEC and Olympic are deliberately NOT here. Both are entirely on ArbiterLive,
// whose robots.txt is "User-agent: * / Disallow: /". Until that is settled with
// them, those two stay on their three-hourly cron rather than having their
// request volume raised by a third.

const OWNER = 'kandyanything';
const WORKFLOW = 'schedule.yml';
const REF = 'main';
const FIRST_HOUR = 11;   // 11 am ET
const LAST_HOUR = 15;    // 3 pm ET, inclusive

// Chosen for how their schools publish, not by conference size: these are the
// sites where most schools are on DigitalSports, whose robots.txt permits the
// schedule path we read.
const REPOS = [
  'big-north-conference',      // 41 schools, all DigitalSports
  'nwjerseyac-new',            // 39 schools, 27 DigitalSports
  'skyland-conference',        // 21 schools, 11 DigitalSports
  'union-county-conference',   // 22 schools, 19 DigitalSports
];

function easternHour(date) {
  const h = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/New_York', hour: 'numeric', hour12: false,
  }).format(date);
  return Number(h) % 24;          // "24" at midnight in some ICU versions
}

// Cloudflare's dashboard form takes whatever key you type, and a hyphen is easy
// to produce; a secret cannot be renamed and GitHub shows a token once. Read
// both rather than force a rotation over a typo.
function token(env) {
  return env.GITHUB_TOKEN || env['GITHUB-TOKEN'] || '';
}

// "A secret exists" and "the secret is a usable token" are different questions.
// A truncated paste or a revoked token looks identical to a good one until a
// dispatch fails silently inside the window, which is the one time nobody is
// watching.
async function tokenWorks(env) {
  const t = token(env);
  if (!t) return { ok: false, reason: 'no secret set' };
  try {
    const res = await fetch(`https://api.github.com/repos/${OWNER}/${REPOS[0]}`, {
      headers: {
        'Authorization': `Bearer ${t}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `${OWNER}-conference-refresh-worker`,
      },
    });
    if (res.ok) return { ok: true };
    return { ok: false, reason: `GitHub answered ${res.status}` };
  } catch (err) {
    return { ok: false, reason: `could not reach GitHub: ${err.message}` };
  }
}

async function dispatch(env, repo) {
  const res = await fetch(
    `https://api.github.com/repos/${OWNER}/${repo}/actions/workflows/${WORKFLOW}/dispatches`,
    {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token(env)}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': `${OWNER}-conference-refresh-worker`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ ref: REF }),
    },
  );
  // 204 is success and carries no body; anything else is worth surfacing.
  if (res.status === 204) return { repo, ok: true };
  return { repo, ok: false, status: res.status, detail: (await res.text()).slice(0, 200) };
}

export default {
  async scheduled(event, env, ctx) {
    const hour = easternHour(new Date(event.scheduledTime));
    // Two cadences, both driven from here because GitHub delivers only about
    // 55% of the scheduled runs a workflow asks for - measured across five
    // repos over seven days - and it drops them around the clock, not just in
    // the window. Evening slots matter too: that is when the next morning's
    // reschedules get entered.
    //
    //   inside 11am-3pm ET : every hour, when same-day changes happen
    //   outside it         : every third hour, the original cadence
    //
    // Gated on the Eastern hour rather than the UTC cron, so the window does
    // not slide when the clocks change on 1 November.
    const inWindow = hour >= FIRST_HOUR && hour <= LAST_HOUR;
    const isBaseSlot = hour % 3 === 0;
    if (!inWindow && !isBaseSlot) {
      console.log(`skipped: ${hour}:00 ET is neither in the window nor a 3-hourly slot`);
      return;
    }
    if (!token(env)) {
      console.error('no GitHub token secret is set; nothing dispatched');
      return;
    }
    // One repo failing must not stop the rest - a bad token scope on one
    // would otherwise silently cost every site its refresh.
    const results = await Promise.all(REPOS.map(r => dispatch(env, r).catch(
      e => ({ repo: r, ok: false, detail: e.message }))));
    for (const r of results) {
      console.log(r.ok
        ? `dispatched ${r.repo} for ${hour}:00 ET`
        : `dispatch FAILED ${r.repo} (${r.status || '-'}) ${r.detail || ''}`);
    }
  },

  // Status only. This endpoint reports what the cron would do; it never
  // dispatches. Firing a real workflow_dispatch on a plain GET would make the
  // public workers.dev URL an unauthenticated build trigger for four repos.
  // Manual runs belong in the GitHub Actions UI, behind a login.
  async fetch(request, env) {
    const hour = easternHour(new Date());
    const inWindow = hour >= FIRST_HOUR && hour <= LAST_HOUR;
    const check = await tokenWorks(env);
    return Response.json({
      easternHour: hour,
      window: `${FIRST_HOUR}:00-${LAST_HOUR}:00 ET`,
      inWindow,
      repos: REPOS,
      hasToken: Boolean(token(env)),
      tokenWorks: check.ok,
      tokenProblem: check.ok ? undefined : check.reason,
      wouldDispatchNow: inWindow && check.ok,
    });
  },
};
