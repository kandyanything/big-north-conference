// Big North Vision: feature video + grid of game clips.
// YouTube entries: provide 'id' (the watch?v= part) — embeds inline on click.
// NFHS Network entries: provide 'url' and set source:'nfhs' — opens NFHS in
//   a new tab on click (NFHS blocks iframes on third-party sites).
document.addEventListener('DOMContentLoaded', function () {
    var section = document.querySelector('.njac-vision');
    if (!section) return;

    var feature = section.querySelector('.vision-feature');
    var grid = section.querySelector('.vision-grid');
    if (!feature || !grid) return;

    fetch('data/videos.json')
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (data) {
            // An NFHS entry has a url and NO youtube id. Filtering on v.id alone
            // silently drops every one of them, which hides the whole section.
            var videos = (data.videos || []).filter(function (v) { return v && (v.id || v.url); });
            if (!videos.length) { section.style.display = 'none'; return; }

            var limit = parseInt(section.dataset.limit, 10);
            var shown = limit > 0 ? videos.slice(0, limit) : videos;

            feature.appendChild(buildTile(shown[0], true));
            shown.slice(1).forEach(function (v) { grid.appendChild(buildTile(v, false)); });

            var more = section.querySelector('.vision-more');
            if (more && videos.length <= shown.length) more.hidden = true;
        })
        .catch(function () { section.style.display = 'none'; });

    function thumbUrl(v, big) {
        if (v.thumb && /^https?:\/\//i.test(v.thumb)) return v.thumb;
        if (v.id && !v.url) {
            if (v.thumb) return 'https://i.ytimg.com/vi/' + v.id + '/' + v.thumb + '.jpg';
            return 'https://i.ytimg.com/vi/' + v.id + '/' + (big ? 'maxresdefault' : 'hqdefault') + '.jpg';
        }
        // NFHS publishes a real frame from the broadcast, named after the game id.
        if (v.url) {
            var m = v.url.match(/\/(gam[a-z0-9]+)(?:[\/?#]|$)/i);
            if (m) return 'https://social.nfhsnetwork.com/thumbnails/' + m[1] + '_nfhs_net.jpg';
        }
        return '';
    }

    function buildTile(v, big) {
        var isExternal = !v.id && v.url;

        var tile = document.createElement('article');
        tile.className = 'vision-item' + (big ? ' vision-item--feature' : '');

        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'vision-thumb';
        btn.setAttribute('aria-label', (isExternal ? 'Watch video: ' : 'Play video: ') + (v.title || 'Big North game'));

        var img = document.createElement('img');
        img.src = thumbUrl(v, big);
        img.alt = v.title || 'Big North game video';
        img.loading = big ? 'eager' : 'lazy';
        // maxresdefault is not generated for every YouTube upload. This fallback
        // must NOT run for NFHS entries or it rewrites a good frame to vi/undefined/.
        if (v.id && !v.url) {
            img.onerror = function () {
                this.onerror = null;
                this.src = 'https://i.ytimg.com/vi/' + v.id + '/hqdefault.jpg';
            };
        }
        btn.appendChild(img);

        var play = document.createElement('span');
        play.className = 'vision-play';
        play.setAttribute('aria-hidden', 'true');
        btn.appendChild(play);

        if (isExternal) {
            var badge = document.createElement('span');
            badge.className = 'vision-source-badge';
            badge.setAttribute('aria-hidden', 'true');
            badge.textContent = (v.source === 'nfhs' || v.type === 'nfhs') ? 'NFHS Network' : 'Watch';
            btn.appendChild(badge);
        }

        btn.addEventListener('click', function () {
            if (isExternal) {
                // An NFHS broadcast cannot be framed on a third-party site, so send
                // the viewer to the game rather than to an iframe that never loads.
                window.open(v.url, '_blank', 'noopener,noreferrer');
            } else {
                var frame = document.createElement('iframe');
                frame.src = 'https://www.youtube.com/embed/' + v.id + '?autoplay=1&rel=0';
                frame.title = v.title || 'Big North game video';
                frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
                frame.referrerPolicy = 'strict-origin-when-cross-origin';
                frame.allowFullscreen = true;
                frame.setAttribute('frameborder', '0');
                btn.replaceWith(frame);
            }
        });

        var meta = document.createElement('div');
        meta.className = 'vision-meta';
        var h3 = document.createElement('h3');
        h3.textContent = v.title || 'Big North game';
        meta.appendChild(h3);
        if (v.sport || v.date || isExternal) {
            var p = document.createElement('p');
            p.className = 'vision-sub';
            var parts = [v.sport, formatDate(v.date)].filter(Boolean);
            if (isExternal) parts.push('Opens on NFHS Network ↗');
            p.textContent = parts.join(' · ');
            meta.appendChild(p);
        }

        tile.appendChild(btn);
        tile.appendChild(meta);
        return tile;
    }

    function formatDate(iso) {
        if (!iso) return '';
        var d = new Date(iso + 'T12:00:00');
        if (isNaN(d)) return iso;
        return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
});
