# Handoff: Big North Conference site, built on the NJAC site's bones

This document is for whoever (which may be a future me, in a fresh Claude
Code session with no memory of building nwjerseyac.org) picks up the job of
building a site for the **Big North Conference** using the same architecture
already proven out at `nwjerseyac-new`.

It is organized in the order a new session should actually read it: what this
project is, what to copy verbatim, what must be rebuilt from scratch, what is
already known about Big North specifically, what is still unknown and needs
research, the hard-won lessons from the first build that are worth not
re-learning, and a suggested order of work.

---

## 1. What this project is

`nwjerseyac-new` is a static site (plain HTML/CSS/JS, no build step, hosted on
Netlify, deployed from GitHub via `git push`) for the Northwest Jersey
Athletic Conference - 39 New Jersey high schools. Over one long build it grew:

- A hand-crafted design system (Oswald + Open Sans, navy/red/white, CSS
  custom properties) replicated visually from a reference site
  (skylandconference.com) rather than templated.
- A nightly-scraped, deduplicated conference-wide schedule spanning three
  different scheduling platforms per school (ArbiterLive, DigitalSports,
  iCal feeds), split by month for the browser, gender-split within sports
  that need it (boys'/girls' tennis and volleyball run in *opposite*
  seasons under NJSIAA - confirmed from real fixture dates, not assumed).
- A "Today at a Glance" homepage section and a "Search a Season" filterable
  calendar, both reading the same schedule data, both fetching only the
  month files a query actually needs.
- An AD contact directory, leadership list, hero photo slider with a slow
  Ken Burns drift, a scrolling logo strip behind the masthead, a video
  section, honors/news sections (built but left empty, waiting on content).
- A Decap CMS admin panel (`/admin`) so board members can edit content
  without touching code, built but **not yet activated** - the OAuth proxy
  it needs is deliberately staged outside `netlify/functions/` until someone
  deliberately wires it up (see `cms-activation/ACTIVATION.md` in that repo).
- A data-driven top nav (`data/nav.json` + `js/nav-render.js`) instead of
  the same markup hand-copied into every page, plus four generic,
  board-authored "Extra Pages" that stay invisible until a `published` flag
  is switched on.

None of that is specific to New Jersey or to a 39-school conference. The
**architecture** - how the schedule pipeline works, how the CMS is wired, how
the design system is built, what the reveal/hero/nav scripts do - is the
"bones" this handoff is about reusing. The **data** - which schools, what
colors, whose logo, which scraping platform each school uses - is entirely
Big North's own and has to be rebuilt, in some cases researched from
scratch.

---

## 2. What to copy essentially as-is (the bones)

Copy the whole repository as a starting point, then work through section 3 to
replace what needs replacing. These are the parts that should need little to
no change beyond branding:

**Architecture / build tooling**
- `scripts/build-schedule.js`, `scripts/split-schedule.js`,
  `scripts/check-schedule.js` - the whole schedule pipeline: fetch, dedupe,
  gender-split, guard-rail, split into month files. The `SPORT_SEASON` map
  and season-window logic should transfer directly if Big North is NJSIAA
  too (very likely - see section 4) - the fall/winter/spring boundaries and
  the tennis/volleyball season swap are NJSIAA-wide rules, not NJAC's own.
- `scripts/sources/arbiter.js`, `digitalsports.js`, `ical.js` - the three
  scraper implementations. These should work unchanged for any school on
  the same platforms; only the per-school entity IDs/URLs
  (`scripts/ds-schools.json`, the `ARBITER_SCHOOLS` array in
  `build-schedule.js`, and the iCal school list) are NJAC-specific and need
  Big North's own schools substituted in - after first discovering which
  platform each Big North school actually uses (this is real, per-school
  detective work; see section 5).
- `.github/workflows/schedule.yml` - the nightly GitHub Action, UTC cron +
  timezone gate for DST-correct 2am Eastern. Copy as-is.
- `scripts/preview-server.js` - the local static server for previewing
  before publishing. Copy as-is.
- `netlify.toml` - copy as-is; it only sets `publish = "."` and a couple of
  cache headers, nothing NJAC-specific.

**The CMS**
- `admin/config.yml`, `admin/index.html`, `cms-activation/` - the whole
  Decap CMS setup, including the local-backend preview trick and the
  staged-but-not-installed OAuth proxy. The *shape* of the six original
  collections (AD directory, leadership, hero slides, videos, honors, news)
  plus nav-as-data and the four Extra Pages should all transfer directly;
  only the field hints that mention NJAC specifics (logo folder names,
  school counts) need re-wording. **Do not skip re-registering a new GitHub
  OAuth App for the new repo** - the client ID/secret in Netlify's
  environment variables are per-site, not something copied over.

**Front-end scripts, mostly unchanged**
- `js/nav-render.js` - fully generic; reads `data/nav.json`, needs nothing
  NJAC-specific. Comes with a real, hard-won bug fix (see section 6) -
  don't "simplify" the balanced-tag close-finding logic back into a naive
  regex when adapting this.
- `js/redesign-reveal.js` - the scroll-reveal system, fully generic.
- `js/redesign-hero.js` + the Ken Burns CSS in `css/redesign-sections.css`
  - fully generic; only the actual photographs change.
- `js/redesign-logostrip.js` - generic, reads the school directory for
  crests; just needs the new directory data.
- `js/redesign-today.js`, `js/redesign-schedule.js` - the homepage "Today
  at a Glance" and the calendar's "Search a Season" feature. Fully generic
  against the schedule data shape; the `SPORT_SEASON` map inside
  `redesign-schedule.js` should be lifted from `data/standings.json`'s
  season groupings exactly the way it was for NJAC (see section 6 for why
  it has to be checked against real fixture dates, not assumed).
- `js/redesign-genericpage.js` - fully generic Extra Page renderer.

**Design system**
- `css/redesign.css`, `css/redesign-components.css`,
  `css/redesign-sections.css`, `css/redesign-pages.css` - the whole visual
  system. Colors live in `:root` custom properties in `redesign.css`
  (`--navy-900` etc.) - renaming and re-valuing those few variables should
  ripple through most of the design system, since (almost) nothing else
  hard-codes a color. Grep for stray hex codes outside `:root` before
  assuming that alone is sufficient.
- `css/styles.css` exists in the repo but is **dead** - not loaded by any
  page. Don't copy it; don't spend time reconciling it with the modern
  system.

**Page HTML** - `index.html`, `calendar.html`, `info.html`, `links.html`,
`videos.html`, `websites.html`, `custom-1.html` through `custom-4.html` -
copy the *structure* (masthead, nav mount point, footer, script tags), but
every page's copy (headlines, descriptions, meta/OG tags, the About/Links
page content) is NJAC-specific text that needs rewriting for Big North.
`schools.html` is a leftover, still-linked "all schools" page that predates
the homepage's own Member Schools grid - worth deciding whether Big North's
site wants that duplication at all, or just the homepage grid.

**Do not copy these** - dead code or one-off migration tools specific to
NJAC's own history, confirmed unused by grepping every page's script tags
before writing this list down rather than guessing:
- `js/main.js`, `js/njac-news.js`, `js/njac-vision.js`,
  `js/redesign-nav.js` (superseded by `nav-render.js`),
  `js/school-logos-strip.js`, `js/schools-grid.js`, `js/scores-display.js`,
  `js/sponsors-slider.js` - all loaded by zero pages.
- `apply-replacements.js`, `download_logos.py`, `websites-update.sh`,
  `websites-html-replacements.json`, `websites-updates.json`,
  `njac-school-links.json`, `replacements.json`, `update-mapping.json`,
  `data/schools-arbiter.csv` - one-off scripts and their output from fixing
  NJAC's own dead school-website links early in that project. Meaningless
  for a different conference.
- `prototypes/scores/` - an unfinished, never-wired-up scores scraper.
  Genuinely unfinished, not just NJAC-specific; worth deciding fresh whether
  Big North's site wants this at all rather than inheriting an abandoned
  attempt.
- `Athletic Website Information.xlsx`, `SCORES-README.md`,
  `scripts/STATUS.md` - NJAC's own historical working documents.
- `twocrest.png` - a stray verification screenshot that ended up committed;
  meaningless outside the conversation that produced it.

---

## 3. What has to be rebuilt or replaced entirely

- **All of `data/*.json`** - directory, leadership, slides, videos, honors,
  news, standings, nav, the four `data/pages/custom-N.json` files. Every
  one currently holds NJAC's real data or NJAC-specific copy. Rebuilding
  these *is* most of the actual work of standing up Big North's site once
  the architecture is in place.
- **All of `images/`** - the 39 NJAC school crests, the NJAC seal, the
  hero photographs, the favicon/icon set generated from that seal
  (`scripts/build-brand-images.js` can regenerate icons and a social card
  from a new seal image the same way it did for NJAC's - but it needs a
  real seal image to work from, and Big North's own mark is a monochrome
  compass star, not a colorful seal - see section 4).
- **The color palette** in `css/redesign.css`'s `:root` block. NJAC's
  navy/red/white came from its own seal. Big North's real logo (found and
  saved to `handoff-assets/bnc-logo-as-found.png` in this folder) is plain
  black/white/gray - a compass rose and wordmark, no color of its own. This
  means the palette is a genuinely open design decision for the new site,
  not a color-picker exercise against an existing mark. Ask the person
  commissioning the site whether they have an unofficial color association
  (a compass/navigation theme suggests navy or slate blue as a natural
  choice, but that is a guess, not a fact) before picking one.
- **The domain and hosting** - a new Netlify site, a new custom domain
  (presumably something under `bignorthconference` - not decided here), a
  new GitHub repository. None of this can be the same site as
  nwjerseyac.org; it needs its own everything, copied-and-renamed rather
  than shared.
- **The GitHub OAuth App for the CMS** - per-site, must be freshly
  registered against the new repo once the CMS is actually activated.
- **Every school-specific config**: the ArbiterLive entity IDs, the
  DigitalSports subdomains, the iCal feed URLs, the AD contact list, the
  logo files - all have to be discovered or supplied fresh for Big North's
  40 schools. See section 5.

---

## 4. What is already known about Big North Conference

Researched directly from https://www.thebignorthconference.org/ rather than
assumed - fetched pages and raw HTML, not guessed. Still worth
double-checking anything load-bearing before publishing it, the same way
every fact NJAC's site published was checked against a primary source rather
than trusted on the first read.

**Identity**
- Full name: Big North Conference. New Jersey - Bergen and Passaic county
  area (schools include Hackensack, Teaneck, Paramus, Ridgewood, Wayne
  Hills/Valley, Passaic, Clifton and others in that region).
- Contact email listed on the site: `info@bignorth.powermediallc.org`
- Their own current site runs on Arbiter Sports / RSchoolToday's own
  website platform - that is the platform hosting *their conference site*,
  which says nothing on its own about which platform each *member school*
  uses for its own schedule (a separate question, see section 5).

**Branding**
- Real logo saved to `handoff-assets/bnc-logo-as-found.png` in this folder:
  a black/white/gray compass-star mark ("BIG" upper-left, "CONFERENCE"
  lower-left, star-compass center, "BIG NORTH CONFERENCE" wordmark).
  Genuinely monochrome - there is no existing color scheme to extract from
  it, unlike NJAC's own red/white/blue seal.
- Their current site itself is a fairly generic WordPress/Elementor build
  with no strong custom color identity of its own to borrow from - the hex
  colors found in its CSS (`#5eead4` teal, `#5d4fff` purple, etc.) read as
  generic theme/plugin defaults, not a deliberate brand palette. Don't
  mistake them for Big North's actual colors.

**Structure - genuinely different from NJAC in one important way**
- Big North organizes its 40 schools into **divisions** for scheduling and
  standings ("Alignments" - a PDF, linked from the About Us submenu:
  `Big-North-Alignments-for-2024-26.pdf`). NJAC's site treats its 39
  schools as one flat conference with no division layer. This is a real
  structural difference, not just more data - it may mean the AD directory,
  standings section, and possibly the schedule search filters want a
  Division dimension that nwjerseyac-new's data model has no field for at
  all. Read that PDF before designing the data model, not after.
- Nav structure on their real site: Home, About Us (submenu: Alignments,
  Committees, Constitution, Rules & Regulations, Meeting Dates, Summer No
  Contact Dates), Sportsmanship, Lou Molino Award, Athletic Directors,
  Member School Athletic Websites, Standing/All Division.

**The 40 member schools**, as listed on their site:
Bergen Catholic, Bergen County Technical, Bergenfield, Cliffside Park,
Clifton, DePaul Catholic, Don Bosco, Dumont, Dwight Morrow, Fair Lawn,
Fort Lee, Hackensack, Academy of the Holy Angels, Immaculate Heart Academy,
Indian Hills, John F. Kennedy (Paterson), Lakeland, Mahwah, Northern
Highlands, Northern Valley-Demarest, Northern Valley-Old Tappan, Paramus,
Paramus Catholic, Pascack Hills, Pascack Valley, Passaic, Passaic Valley,
Passaic County Technical Institute, Eastside (Paterson), Ramapo, Ramsey,
Ridgefield Park, Ridgewood, River Dell, St. Joseph Regional, Teaneck,
Tenafly, Wayne Hills, Wayne Valley, West Milford, Westwood.

**Athletic directors** - name and phone number for all 40 schools were
found on the conference's own Athletic Directors page. **No email
addresses are published there** - unlike NJAC, where a supplied spreadsheet
had them. The full name/phone list is worth pulling directly from
`https://www.thebignorthconference.org/athletic-directors/` again at build
time (it will have drifted since this was written) rather than copying
whatever list ends up in this document, since AD turnover is exactly the
kind of thing this whole CMS project exists to keep current.

**Not found** - no conference history, mission statement, or named
officers (president/secretary/treasurer/executive director) were present on
the About Us page at the time this was researched. NJAC's leadership
section had this; Big North's equivalent may not exist publicly, may be on
a page not discovered, or may need to be requested directly from the
conference rather than scraped.

---

## 5. What still needs research - the real unknowns

**The biggest one: which scheduling platform does each of the 40 schools
actually use?** This was genuinely hard, one-school-at-a-time detective work
for NJAC - reading each school's own athletics page, finding the actual
schedule widget, identifying whether it was ArbiterLive, DigitalSports
(Vantage), a Sidearm-powered iCal feed, or something else, then finding the
specific entity ID or feed URL. There is no shortcut for this; budget real
time for it, expect a few schools to need extra digging (in NJAC's case,
one school's site was fully broken and had to be excluded with a clear flag
rather than silently worked around).

**AD email addresses** - not published on the conference site. Either they
do not exist publicly, or they are on each school's own site rather than
the conference's. Worth checking a handful of individual school athletics
pages before assuming they cannot be found at all.

**Leadership / officers** - not found in this pass. Worth asking whoever
commissioned the site directly rather than continuing to search, the same
way NJAC's leadership list ultimately came from a spreadsheet the user
supplied rather than being fully scraped.

**The divisions/alignments PDF** - not read in this pass (PDF content
wasn't fetched). Read it before finalizing the data model for schools,
standings, or the AD directory, since it may mean every school record wants
a `division` field NJAC's schema never needed.

**Hero photography** - NJAC's came from the user's own conference photo
galleries, organized by sport. Big North will need its own source for
this, likely also supplied by whoever commissions the site rather than
scraped from the web.

**Color palette** - see section 3. A genuinely open decision, not a
research task with a findable answer.

---

## 6. Hard-won lessons from building nwjerseyac-new

These cost real time to find the first time. Worth reading before
repeating any of them on a second site built from the same bones.

- **A check that cannot fail is not a check.** Several real bugs across
  the NJAC build were caught only by measuring the actual rendered
  result against the actual source data, in a real browser, rather than
  trusting a signal that merely resembled verification - a 200 status, a
  field name existing in a schema, a string match. Examples: a
  `uniqueGameId` field that looked like a dedup key but was `null` on
  every record; a duplicate-rate calculation that ignored competition
  level and reported 4.19% when the true rate was zero; a logo strip
  animation that "passed" a test built on an assumption about layout
  that turned out to be wrong.
- **Test on the real machine, not just the sandbox.** A local preview
  server started without explicitly running on the user's own machine is
  invisible to the user's own browser, even though it looks identical to
  the agent. This wasted a whole round-trip once before the pattern was
  caught. Always confirm a "here's a link" moment actually resolves from
  the user's own machine, not just from wherever the agent's shell
  happens to be running.
- **A regex cannot safely span nested tags of the same name.** The
  nav-as-data migration for NJAC used a non-greedy regex to find and
  empty out `<ul class="navlist">...</ul>`, which matched the *first*
  closing `</ul>` it found - the end of a nested subnav, not the real end
  of the menu. That silently truncated the menu on every page and
  orphaned the rest as sibling elements, which stole layout width and
  pushed dropdowns off-screen at specific viewport widths. Caught only by
  comparing against the live, untouched site at the same exact widths.
  The fix (in `js/nav-render.js`'s history, and in whatever migration
  script did this) walks the string counting open tags against close
  tags rather than pattern-matching across the whole span.
- **CSS Grid's `1fr` has an implicit `minmax(auto, 1fr)`.** A four-column
  filter form collapsed to two columns on a phone, and the grid item's
  "auto" minimum width was driven by its longest `<select>` option text,
  which pushed a whole column 62px past the edge of the screen with
  nothing to scroll to reach it - not a cramped layout, invisible
  controls. Fixed with `min-width: 0` on both the grid item and the
  select. Worth checking early in any new grid-based form on this site.
- **Netlify deploys fail silently.** A failed deploy keeps serving the
  last good build, so the site can look completely healthy while new
  commits never reach it. This happened when a stray file landed in
  `netlify/functions/` (Netlify's auto-detected functions directory) with
  a dependency that could not resolve, since this project deliberately
  keeps `package.json` out of git. After every push, fetch something the
  new commit actually changed and confirm the change is present - a 200
  status proves nothing, since the old build returns 200 too.
- **Shell heredocs mangle backslashes and quotes.** Repeatedly, across
  this whole project, content containing regex backslashes, apostrophes,
  or embedded quotes got silently corrupted when written via a bash
  heredoc. Prefer the Write/Edit tools for any file whose content has
  backslashes, quotes, or apostrophes in it.
- **Verify a message-passing payload by actually evaluating the generated
  code**, not by eyeballing the string concatenation. The CMS's OAuth
  proxy needed a specific `postMessage` handshake string built through
  two layers of `JSON.stringify`; it was confirmed correct by literally
  running the generated JavaScript and checking the output, not by
  reading the source and assuming the escaping was right.
- **Fix the thing that was asked for, not the class of problem around
  it.** More than once, a fix that quietly did more than requested (e.g.
  adding a fallback safety net alongside a targeted bug fix) changed the
  feel of something the user had not asked to change, and the user
  noticed immediately. When a request is scoped, keep the diff scoped to
  match it, even when a broader improvement seems obviously good in
  isolation.
- **Ask the "is this actually still true" question about anything named
  in an older memory or handoff document before acting on it** - a file
  path, a function name, a flag - it may have been renamed or removed
  since. This document will decay exactly the same way; treat anything
  in it that names a specific file or line as a claim to verify, not a
  fact to build on unchecked.

---

## 7. Suggested order of work

1. Copy the repo (section 2's list, honoring section 2's exclusion list).
   Set up a new GitHub repo and a new Netlify site pointed at it. Confirm
   the copied site deploys and looks *exactly* like NJAC's - a known-good
   baseline before anything changes.
2. Read the Alignments/divisions PDF and decide the data model question in
   section 4 before writing any new JSON - whether `division` needs to be
   a first-class field on schools, standings, and possibly the AD
   directory.
3. Settle the color palette (section 3) - this is a conversation with
   whoever commissioned the site, not something to guess and move past.
4. Rebuild `data/directory.json` from the real, current Athletic Directors
   page - 40 schools, name and phone confirmed; decide what to do about
   the missing emails.
5. Source or commission a full set of school crests, sized and trimmed to
   match each other the way NJAC's 39 were - not raw uploads.
6. Regenerate favicons/icons/social card from the new mark via
   `scripts/build-brand-images.js`, adjusted for a monochrome source image
   rather than a colorful seal.
7. Begin the schedule-platform discovery work in section 5, school by
   school - this is the single largest, least shortcut-able task in the
   whole rebuild.
8. Wire up `scripts/build-schedule.js` and the source scrapers for
   whatever platforms are actually found, run it, and hold it to the same
   guard rail (`scripts/check-schedule.js`) before ever publishing.
9. Only after real schedule data exists, build out Today at a Glance and
   Search a Season - they are complete and generic already, but they are
   much easier to verify against data that is actually real.
10. Content: leadership, honors, news, hero photography - whatever the
    commissioning party can supply, the same way NJAC's was gathered
    piecemeal over the course of that whole project rather than all at
    once.
11. Activate the CMS last, once the site's shape has settled - register
    the new GitHub OAuth App, set the new environment variables, move the
    two staged functions into `netlify/functions/`, and add whichever Big
    North board members need access as repo collaborators.
