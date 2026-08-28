// Homepage load reveal: the Big North compass, struck on a silver medallion,
// spins in toward the viewer, lands upright, holds for a couple of seconds, then
// the whole veil fades to reveal the site. Plays once per browser session, skips
// on a click, honours reduced-motion, and always removes itself (a hard timeout
// guarantees the veil can never linger). Add ?intro to force a replay. Loaded in
// <head> so the veil covers the viewport before the page paints.
(function () {
    'use strict';

    var force = /[?&#]intro\b/i.test(location.search + location.hash);
    if (!force) {
        try {
            if (sessionStorage.getItem('bncIntroPlayed')) return;
            sessionStorage.setItem('bncIntroPlayed', '1');
        } catch (e) { /* storage blocked - still fine to play once */ }
        if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    }

    var veil = document.createElement('div');
    veil.id = 'bnc-intro';
    veil.setAttribute('aria-hidden', 'true');
    veil.style.cssText = 'position:fixed;inset:0;z-index:2147483647;cursor:pointer;' +
        'background:radial-gradient(120% 90% at 50% 42%,#15181d 0%,#0a0b0d 55%,#050607 100%);' +
        'transition:opacity .8s ease;opacity:1;';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    veil.appendChild(canvas);
    function mount() { if (!veil.parentNode) (document.body || document.documentElement).appendChild(veil); }
    mount();
    document.addEventListener('DOMContentLoaded', mount);

    var ctx = canvas.getContext('2d');
    var W, H, DPR, cx, cy, Rfinal, trail = [], start = null, raf = 0, ended = false;
    var T_FLY = 2900, T_HOLD = 3100;    // ~7s total with the fade

    function size() {
        W = window.innerWidth; H = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        cx = W * 0.5; cy = H * 0.45; Rfinal = Math.min(W, H) * 0.24;
    }
    size();

    var logo = new Image(), logoReady = false;
    logo.onload = function () { logoReady = true; };
    logo.onerror = function () { logoReady = 'fail'; };   // still show the medallion disc
    logo.src = 'images/bnc-logo-footer.png';

    function easeOut(p) { return 1 - Math.pow(1 - p, 3); }
    function easeOutBack(p) { var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

    function spotlight(alpha) {
        ctx.save(); ctx.globalAlpha = alpha;
        var g = ctx.createRadialGradient(cx, cy, Rfinal * 0.2, cx, cy, Rfinal * 2.4);
        g.addColorStop(0, 'rgba(195,201,209,0.14)'); g.addColorStop(1, 'rgba(195,201,209,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }

    function drawLogo(r, rot, alpha) {
        ctx.save();
        ctx.globalAlpha = alpha; ctx.translate(cx, cy); ctx.rotate(rot);
        // struck silver medallion, so the black compass reads on the dark veil
        ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = r * 0.3; ctx.shadowOffsetY = r * 0.07;
        var g = ctx.createRadialGradient(-r * 0.32, -r * 0.34, r * 0.15, 0, 0, r);
        g.addColorStop(0, '#f2f5f8'); g.addColorStop(0.68, '#c3c9d1'); g.addColorStop(1, '#8a9199');
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fillStyle = g; ctx.fill();
        ctx.shadowBlur = 0; ctx.shadowOffsetY = 0;
        ctx.lineWidth = Math.max(1.5, r * 0.035); ctx.strokeStyle = 'rgba(90,96,106,0.85)'; ctx.stroke();
        if (logoReady === true) {
            var iw = logo.naturalWidth || 1, ih = logo.naturalHeight || 1, fit = (1.42 * r) / Math.max(iw, ih);
            ctx.drawImage(logo, -iw * fit / 2, -ih * fit / 2, iw * fit, ih * fit);
        }
        ctx.restore();
    }

    function frame(ts) {
        if (ended) return;
        if (!logoReady) { raf = requestAnimationFrame(frame); return; }   // wait for the mark (or 'fail')
        if (start === null) start = ts;
        var e = ts - start;
        ctx.clearRect(0, 0, W, H);

        if (e < T_FLY) {
            var p = e / T_FLY;
            var r = 6 + (Rfinal - 6) * easeOutBack(p);
            var rot = easeOut(p) * (Math.PI * 2 * 3);       // exactly 3 turns, lands upright
            spotlight(easeOut(p) * 0.9);
            trail.push({ r: r, rot: rot }); if (trail.length > 5) trail.shift();
            for (var i = 0; i < trail.length - 1; i++) drawLogo(trail[i].r, trail[i].rot, (i / trail.length) * 0.14);
            drawLogo(r, rot, 1);
        } else if (e < T_FLY + T_HOLD) {
            spotlight(0.9);
            drawLogo(Rfinal, 0, 1);                          // upright, correct, sitting still
        } else {
            finish(); return;
        }
        raf = requestAnimationFrame(frame);
    }

    function finish() {
        if (ended) return; ended = true;
        if (raf) cancelAnimationFrame(raf);
        veil.style.opacity = '0';
        setTimeout(function () { if (veil.parentNode) veil.parentNode.removeChild(veil); }, 900);
    }

    veil.addEventListener('click', finish);
    window.addEventListener('resize', size);
    setTimeout(finish, 10000);           // hard safety net
    raf = requestAnimationFrame(frame);
})();
