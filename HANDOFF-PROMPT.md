We're building a website for the Big North Conference (a 40-school New
Jersey high school athletic conference - Bergen/Passaic county area),
reusing the architecture of a site I already built for a different
conference (NJAC, at `nwjerseyac-new`) but with all new branding, colors,
schools, and content.

Before doing anything else, read `HANDOFF.md` in this same folder
(`big-north-conference/`) in full. I wrote it at the end of the NJAC build
specifically to hand this project to you. It covers:

- what the NJAC site actually does and how it's built (static site,
  Netlify, a nightly-scraped multi-platform schedule pipeline, a Decap CMS
  admin panel, a data-driven nav, scroll-reveal + Ken Burns hero effects)
- exactly which files to copy over as-is versus which are dead code or
  NJAC-specific one-off scripts not worth bringing along
- what has to be rebuilt from scratch for Big North (all the data, images,
  color palette, domain/hosting, GitHub OAuth app for the CMS)
- what I already researched and confirmed about Big North Conference
  directly from their real site (the 40 member schools, their AD names and
  phone numbers, their actual logo - saved in
  `handoff-assets/bnc-logo-as-found.png`, monochrome, no inherent color
  scheme - their real nav structure, and the fact that they organize
  schools into Divisions/Alignments, which NJAC's data model has no
  concept of at all)
- what's still unknown and needs real research or a decision from me
  before you can proceed (the biggest one: which scheduling platform each
  of the 40 schools actually uses for their own athletics schedule -
  ArbiterLive, DigitalSports, an iCal feed, or something else - this took
  real one-school-at-a-time digging for NJAC and there's no shortcut)
- a list of hard-won lessons from the NJAC build worth not re-learning
  (a nested-tag regex bug that silently truncated the nav, a CSS Grid
  `1fr` implicit-minimum bug, Netlify's silent-deploy-failure risk,
  testing on the real machine instead of just a sandbox, verifying
  against real data/screenshots instead of trusting a check that can't
  fail)
- a suggested order of work

Once you've read it, give me your own read on priority and sequencing
before writing any code - in particular I want your take on the divisions
question (does Big North's data model need a `division` field on schools/
standings from day one, or can that wait) and the color palette (I have no
strong opinion yet beyond "not the same navy/red as NJAC's site"). Don't
start the schedule-platform discovery work or write any data files until
we've talked through those two.

The actual `nwjerseyac-new` repo is a sibling folder at
`../nwjerseyac-new` if you need to open a file from it directly rather than
relying on what's summarized in HANDOFF.md - the summary is thorough but
verify anything load-bearing against the real file rather than trusting it
verbatim, the same discipline that document itself argues for.
