// Homepage load reveal: crack of the bat, a baseball rockets toward the viewer
// and spiderweb-fractures the "glass," then the whole veil fades to reveal the
// site. Plays once per browser session, skips on a click, honours
// reduced-motion, and always removes itself (a hard timeout guarantees the veil
// can never linger over the page). Loaded in <head> so the veil covers the
// viewport before the page paints - no flash of content first.
(function () {
    'use strict';

    // --- gates -----------------------------------------------------------
    // ?intro (or #intro) forces a replay - handy for testing and for a
    // "watch the intro" link - bypassing both the once-per-session guard and
    // the reduced-motion opt-out.
    var force = /[?&#]intro\b/i.test(location.search + location.hash);
    if (!force) {
        try {
            if (sessionStorage.getItem('bncIntroPlayed')) return;
            sessionStorage.setItem('bncIntroPlayed', '1');
        } catch (e) { /* storage blocked - still fine to play once */ }
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    }

    // --- veil (created immediately, before <body> exists) ---------------
    var veil = document.createElement('div');
    veil.id = 'bnc-intro';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:pointer;' +
        'background:radial-gradient(120% 90% at 50% 42%,#15181d 0%,#0a0b0d 55%,#050607 100%);' +
        'transition:opacity .55s ease;opacity:1;';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    veil.appendChild(canvas);

    // Mount to <html> right now (this runs in <head>, before <body> exists) so
    // the veil covers the viewport before the page paints - no flash first.
    // Re-assert on DOMContentLoaded as a safety net in case the early mount did
    // not stick.
    function mount() { if (!veil.parentNode) (document.body || document.documentElement).appendChild(veil); }
    mount();
    document.addEventListener('DOMContentLoaded', mount);

    var ctx = canvas.getContext('2d');
    var W, H, DPR, ix, iy, cracks = [], trail = [], start = null, raf = 0, ended = false;

    // --- timings (ms) ----------------------------------------------------
    var T_FLASH = 240, T_FLY = 1500, T_IMPACT = T_FLASH + T_FLY, T_LINGER = 2400;

    function size() {
        W = window.innerWidth; H = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        ix = W * 0.5; iy = H * 0.44;
    }
    size();

    // --- procedural fracture --------------------------------------------
    function rnd(a, b) { return a + Math.random() * (b - a); }

    function buildCracks() {
        cracks = [];
        var maxLen = Math.max(W, H) * 0.72;
        var main = 10 + Math.floor(rnd(0, 4));
        for (var i = 0; i < main; i++) {
            var ang = (i / main) * Math.PI * 2 + rnd(-0.2, 0.2);
            grow(ix, iy, ang, maxLen * rnd(0.7, 1), 0);
        }
        for (var r = 0; r < 2; r++) {
            cracks.push({ ring: true, r: rnd(16, 30) + r * rnd(18, 34), appear: rnd(0.05, 0.2) });
        }
    }
    function grow(x, y, ang, len, depth) {
        var seg = [{ x: x, y: y }];
        var steps = Math.max(3, Math.floor(len / rnd(18, 30))), stepLen = len / steps, a = ang;
        for (var s = 0; s < steps; s++) {
            a += rnd(-0.32, 0.32);
            x += Math.cos(a) * stepLen; y += Math.sin(a) * stepLen;
            seg.push({ x: x, y: y });
            if (depth < 2 && s > 0 && Math.random() < 0.22) {
                grow(x, y, a + rnd(0.5, 1.1) * (Math.random() < 0.5 ? 1 : -1), len * rnd(0.3, 0.55), depth + 1);
            }
        }
        cracks.push({ seg: seg, depth: depth, appear: rnd(0, 0.12) + depth * 0.05 });
    }

    // --- baseball --------------------------------------------------------
    function drawBall(x, y, r, rot, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha; ctx.translate(x, y); ctx.rotate(rot);
        var g = ctx.createRadialGradient(-r * 0.32, -r * 0.36, r * 0.1, 0, 0, r);
        g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#f2f0ea'); g.addColorStop(1, '#c9c6bd');
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#c0392b'; ctx.lineWidth = Math.max(1, r * 0.07); ctx.lineCap = 'round';
        for (var k = -1; k <= 1; k += 2) {
            ctx.beginPath();
            ctx.arc(k * r * 1.15, 0, r * 1.28, Math.PI * (k > 0 ? 0.72 : -0.28), Math.PI * (k > 0 ? 1.28 : 0.28));
            ctx.stroke();
            for (var t = 0.76; t < 1.25; t += 0.06) {
                var aa = Math.PI * (k > 0 ? t : t - 1);
                var sx = k * r * 1.15 + Math.cos(aa) * r * 1.28, sy = Math.sin(aa) * r * 1.28;
                ctx.lineWidth = Math.max(.8, r * 0.03);
                ctx.beginPath(); ctx.moveTo(sx, sy);
                ctx.lineTo(sx - Math.cos(aa) * r * 0.14 * k, sy - Math.sin(aa) * r * 0.14 * k); ctx.stroke();
                ctx.lineWidth = Math.max(1, r * 0.07);
            }
        }
        ctx.restore();
    }

    function stroke(seg, n, off) {
        ctx.beginPath(); ctx.moveTo(seg[0].x + off, seg[0].y + off);
        for (var i = 1; i < n; i++) ctx.lineTo(seg[i].x + off, seg[i].y + off);
        ctx.stroke();
    }
    function drawCracks(prog) {
        for (var i = 0; i < cracks.length; i++) {
            var cr = cracks[i];
            var local = Math.max(0, Math.min(1, (prog - cr.appear) / 0.35));
            if (local <= 0) continue;
            if (cr.ring) {
                ctx.globalAlpha = 0.4; ctx.strokeStyle = 'rgba(233,238,244,0.8)'; ctx.lineWidth = 1;
                ctx.beginPath(); ctx.arc(ix, iy, cr.r * local, 0, Math.PI * 2); ctx.stroke();
                continue;
            }
            var seg = cr.seg, n = Math.max(2, Math.floor(seg.length * local));
            ctx.globalAlpha = 0.55; ctx.strokeStyle = 'rgba(0,0,0,0.6)'; ctx.lineWidth = cr.depth ? 1.6 : 2.8;
            stroke(seg, n, 0.8);
            ctx.globalAlpha = 1; ctx.strokeStyle = 'rgba(240,244,250,0.95)'; ctx.lineWidth = cr.depth ? 0.9 : 1.7;
            ctx.shadowColor = 'rgba(180,210,255,0.6)'; ctx.shadowBlur = 6;
            stroke(seg, n, 0); ctx.shadowBlur = 0;
        }
        ctx.globalAlpha = 1;
    }

    // --- loop ------------------------------------------------------------
    function frame(ts) {
        if (ended) return;
        if (start === null) start = ts;
        var e = ts - start;
        ctx.clearRect(0, 0, W, H);

        if (e < T_FLASH) {
            var f = 1 - e / T_FLASH;
            ctx.save(); ctx.globalAlpha = f;
            var fg = ctx.createRadialGradient(ix, iy, 0, ix, iy, 70);
            fg.addColorStop(0, 'rgba(255,255,255,0.9)'); fg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = fg; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = 'rgba(255,255,255,' + f + ')'; ctx.lineWidth = 3;
            ctx.beginPath(); ctx.moveTo(ix - 46, iy + 28); ctx.lineTo(ix + 52, iy - 22); ctx.stroke();
            ctx.restore();
        }

        if (e >= T_FLASH && e < T_IMPACT) {
            var p = (e - T_FLASH) / T_FLY, ease = p * p;
            var r = 5 + ease * (Math.min(W, H) * 0.42);
            var x = ix + Math.sin(p * Math.PI) * W * 0.05, y = iy - 6 + ease * 6, rot = p * 26;
            trail.push({ x: x, y: y, r: r, rot: rot }); if (trail.length > 6) trail.shift();
            for (var ti = 0; ti < trail.length; ti++) {
                var tt = trail[ti]; drawBall(tt.x, tt.y, tt.r, tt.rot, (ti / trail.length) * 0.28);
            }
            drawBall(x, y, r, rot, 1);
        }

        if (e >= T_IMPACT) {
            trail.length = 0;
            if (!cracks.length) buildCracks();
            var since = e - T_IMPACT;
            if (since < 110) {
                ctx.save(); ctx.globalAlpha = 1 - since / 110;
                ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(0, 0, W, H); ctx.restore();
            }
            ctx.save(); ctx.globalAlpha = 0.5;
            var bg = ctx.createRadialGradient(ix, iy, 0, ix, iy, 50);
            bg.addColorStop(0, 'rgba(255,255,255,0.5)'); bg.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(ix, iy, 50, 0, Math.PI * 2); ctx.fill(); ctx.restore();
            drawCracks(Math.min(1, since / 550));
            if (since > T_LINGER) { finish(); return; }
        }
        raf = requestAnimationFrame(frame);
    }

    function finish() {
        if (ended) return; ended = true;
        if (raf) cancelAnimationFrame(raf);
        veil.style.opacity = '0';                    // cracks stay painted, whole veil fades
        setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 800);
    }

    veil.addEventListener('click', finish);
    window.addEventListener('resize', size);
    setTimeout(finish, 8000);                        // hard safety net
    raf = requestAnimationFrame(frame);
})();
