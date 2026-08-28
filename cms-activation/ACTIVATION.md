# Turning on the content editor

This is written for whenever the board is ready to go live with `/admin` -
not something that happens by pushing the current code. Two things have to
be done deliberately first: register a GitHub OAuth App, and move the two
function files in this folder into `netlify/functions/`. Until both are
done, `/admin` shows a login screen nobody can get past.

## Why it's safe sitting here unactivated

`admin/config.yml` and `admin/index.html` are already part of the repo.
Loading `/admin` right now would show Decap CMS's normal interface, but
clicking "Login with GitHub" would fail immediately, because:

- the two OAuth functions live in `cms-activation/functions/`, not
  `netlify/functions/`, so Netlify does not run them and `/.netlify/functions/auth`
  does not exist yet;
- even once moved, they need `OAUTH_CLIENT_ID` and `OAUTH_CLIENT_SECRET`
  set as real environment variables in Netlify, which do not exist until
  step 2 below.

Nobody can read or change anything through this editor until every step
below is done. There is no half-on state.

## Step 1 — Register a GitHub OAuth App

This has to be done by whoever administers the `kandyanything` GitHub
account (or the repo's org, if it moves to one) - it is a GitHub account
setting, not something that can be done from outside GitHub.

1. GitHub → Settings → Developer settings → OAuth Apps → **New OAuth App**.
2. **Application name**: something recognizable, e.g. "NJAC Site Editor".
3. **Homepage URL**: `https://nwjerseyac.org`
4. **Authorization callback URL**: `https://nwjerseyac.org/.netlify/functions/callback`
   - This has to match exactly what `cms-activation/functions/auth.js` sends
     as `redirect_uri`. If the domain ever changes, this needs updating too.
5. Save, then generate a **client secret**. Keep the client ID and secret
   somewhere safe for step 2 - the secret is shown only once.

## Step 2 — Give Netlify the credentials

In the Netlify dashboard, for this site: **Site configuration → Environment
variables**, add:

| Key | Value |
|---|---|
| `OAUTH_CLIENT_ID` | the client ID from step 1 |
| `OAUTH_CLIENT_SECRET` | the client secret from step 1 |

Never put these in a committed file. The functions read them from
`process.env` at request time; they exist only in Netlify's environment.

## Step 3 — Move the functions into place

```
git mv cms-activation/functions/auth.js netlify/functions/auth.js
git mv cms-activation/functions/callback.js netlify/functions/callback.js
```

This is the step that actually wires the editor up - Netlify's functions
directory is auto-detected, so once these two files are there, the next
deploy bundles and serves them at `/.netlify/functions/auth` and
`/.netlify/functions/callback`.

Both files use only the `fetch` built into Node 18+, no npm packages, so
unlike the one time a stray file in this directory broke every deploy for
days, there is nothing here that can fail to resolve at build time.

## Step 4 — Add each board member as a GitHub collaborator

There is no separate password system for this editor - whoever can sign in
with GitHub *and* has at least **write** access to this repository can use
it. Add each board member from the repo's **Settings → Collaborators**, using
whatever GitHub account they already have (or ask them to create one - it's
free).

Every save they make through `/admin` becomes a commit authored by their own
GitHub identity, exactly like any other commit to this repo - not a shared
"editor" account with no trail of who changed what.

## Step 5 — Commit and push

```
git add admin/ netlify/functions/auth.js netlify/functions/callback.js
git commit -m "Activate the content editor"
git push origin main
```

This is the point where it actually goes live - the same push that deploys
any other change to the site.

## Step 6 — Try it

Visit `https://nwjerseyac.org/admin`, click **Login with GitHub**, authorize
the app the first time, and the six collections described below should load.

## What's editable, and what deliberately isn't

| Collection | File | Notes |
|---|---|---|
| Athletic Directors | `data/directory.json` | Contact info only. Logos stay a typed filename, not an upload - see why below. |
| NJAC Leadership | `data/leadership.json` | Name and position only, by design - no contact details are stored here since the file is public. |
| Homepage Photo Slider | `data/slides.json` | Real photo uploads, landing in `images/photos/`. |
| NJAC Vision | `data/videos.json` | Just a YouTube video ID and a title - thumbnails come from YouTube automatically. |
| NJAC Honors | `data/honors.json` | Hidden on the site while empty. |
| NJAC News | `data/news.json` | Hidden on the site while empty. Photo uploads land in `images/news/`. |

**Not included, on purpose:**

- **`data/schedule.json`** and everything under `data/schedule/` - built
  entirely by the nightly GitHub Action from the schools' own scheduling
  platforms. Editing it by hand would be overwritten the next night.
- **`data/schools.json`** - not read by any page; dead configuration left
  over from an earlier version of the site.
- **`data/standings.json`** - the NJ.com links per sport, season and
  conference. Left as a code change rather than a form: the yearly season
  bump and the per-sport conference overrides (fencing and lacrosse point at
  different governing bodies than the rest) are easy to get subtly wrong
  through a generic list editor, and this changes once a year, not
  day-to-day. Worth adding here later if that turns out to be wrong.
- **School logos** - deliberately kept as a typed filename in the Athletic
  Directors editor rather than a real upload widget. Every logo already in
  `images/logos/optimized/` has been individually trimmed to its artwork and
  resized to match the others; a raw upload through a form would skip both
  and look inconsistent next to the rest. Ask for a new logo to be processed
  the way the other 39 were, rather than adding it through this field.
