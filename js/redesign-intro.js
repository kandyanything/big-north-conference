// Homepage load reveal: a circle coin-flips through five sport balls
// (basketball, soccer, tennis, lacrosse, volleyball), then flips one last time
// to morph into the Big North compass, and "BIG NORTH CONFERENCE" fades in
// beneath before the veil fades to the site. Plays once per browser session,
// skips on a click, honours reduced-motion, and always removes itself (a hard
// timeout guarantees the veil can never linger). Add ?intro to force a replay.
// Loaded in <head> so the veil covers the viewport before it paints.
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
        'background:radial-gradient(120% 90% at 50% 40%,#15181d 0%,#0a0b0d 55%,#050607 100%);' +
        'transition:opacity .8s ease;opacity:1;';
    var canvas = document.createElement('canvas');
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block;';
    veil.appendChild(canvas);
    function mount() { if (!veil.parentNode) (document.body || document.documentElement).appendChild(veil); }
    mount();
    document.addEventListener('DOMContentLoaded', mount);

    var ctx = canvas.getContext('2d');
    var W, H, DPR, cx, cy, R, start = null, raf = 0, ended = false;
    var PI = Math.PI, PI2 = PI * 2;

    var logo = new Image(), logoReady = false;
    logo.onload = function () { logoReady = true; };
    logo.src = 'images/bnc-logo-footer.png';

    function size() {
        W = window.innerWidth; H = window.innerHeight;
        DPR = Math.min(window.devicePixelRatio || 1, 2);
        canvas.width = W * DPR; canvas.height = H * DPR;
        ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
        cx = W * 0.5; cy = H * 0.40; R = Math.min(W, H) * 0.19;
    }
    size();

    // ---- primitives -----------------------------------------------------
    function circle(r) { ctx.beginPath(); ctx.arc(0, 0, r, 0, PI2); }
    function seam(x1, y1, x2, y2) { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); }
    function sheen(r, s) { ctx.save(); ctx.globalAlpha = s ? 0.5 : 0.32; ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.ellipse(-r * 0.34, -r * 0.42, r * 0.30, r * 0.17, -0.6, 0, PI2); ctx.fill(); ctx.restore(); }
    function shadow(r) { ctx.save(); ctx.globalAlpha = 0.28; ctx.fillStyle = '#000';
        ctx.beginPath(); ctx.ellipse(0, r * 0.07, r * 0.98, r * 0.5, 0, 0, PI2); ctx.fill(); ctx.restore(); }
    function pentagon(px, py, rad, rot) { ctx.beginPath();
        for (var i = 0; i < 5; i++) { var a = rot + i * (PI2 / 5), x = px + Math.cos(a) * rad, y = py + Math.sin(a) * rad; i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); } ctx.closePath(); ctx.fill(); }

    // ---- the five balls (centred at 0,0) --------------------------------
    function basketball(r) {
        var g = ctx.createRadialGradient(-r * .35, -r * .4, r * .15, 0, 0, r);
        g.addColorStop(0, '#ffb26b'); g.addColorStop(.45, '#ec7a2f'); g.addColorStop(1, '#b4531b');
        ctx.fillStyle = g; circle(r); ctx.fill();
        ctx.strokeStyle = 'rgba(40,20,8,.85)'; ctx.lineWidth = r * .05; ctx.lineCap = 'round';
        circle(r); ctx.stroke(); seam(-r, 0, r, 0); seam(0, -r, 0, r);
        ctx.beginPath(); ctx.ellipse(0, 0, r * .5, r, 0, 0, PI2); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(0, 0, r, r * .5, 0, 0, PI2); ctx.stroke(); sheen(r);
    }
    function soccer(r) {
        var g = ctx.createRadialGradient(-r * .35, -r * .4, r * .2, 0, 0, r);
        g.addColorStop(0, '#fff'); g.addColorStop(.8, '#eef0f2'); g.addColorStop(1, '#c6cacd');
        ctx.fillStyle = g; circle(r); ctx.fill();
        ctx.save(); circle(r); ctx.clip();
        ctx.strokeStyle = 'rgba(25,28,33,.55)'; ctx.lineWidth = r * .03;
        for (var i = 0; i < 5; i++) { var a = -PI / 2 + i * (PI2 / 5); seam(Math.cos(a) * r * .30, Math.sin(a) * r * .30, Math.cos(a) * r, Math.sin(a) * r); }
        ctx.fillStyle = '#15181d'; pentagon(0, 0, r * .30, -PI / 2);
        for (i = 0; i < 5; i++) { var b = -PI / 2 + PI / 5 + i * (PI2 / 5); pentagon(Math.cos(b) * r * .74, Math.sin(b) * r * .74, r * .24, b + PI / 2); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(25,28,33,.35)'; ctx.lineWidth = r * .02; circle(r); ctx.stroke(); sheen(r);
    }
    function tennis(r) {
        var g = ctx.createRadialGradient(-r * .35, -r * .4, r * .2, 0, 0, r);
        g.addColorStop(0, '#eef95f'); g.addColorStop(.7, '#c7d92b'); g.addColorStop(1, '#96a41d');
        ctx.fillStyle = g; circle(r); ctx.fill();
        ctx.save(); circle(r); ctx.clip();
        ctx.strokeStyle = '#fbfce9'; ctx.lineWidth = r * .11; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.ellipse(-r * .66, 0, r * .52, r * 1.06, 0, -PI * .44, PI * .44); ctx.stroke();
        ctx.beginPath(); ctx.ellipse(r * .66, 0, r * .52, r * 1.06, 0, PI - PI * .44, PI + PI * .44); ctx.stroke();
        ctx.restore(); sheen(r);
    }
    function lacrosse(r) {
        var g = ctx.createRadialGradient(-r * .3, -r * .38, r * .12, 0, 0, r);
        g.addColorStop(0, '#fff'); g.addColorStop(.72, '#eef1f4'); g.addColorStop(1, '#bfc5cc');
        ctx.fillStyle = g; circle(r); ctx.fill();
        ctx.strokeStyle = 'rgba(150,158,168,.35)'; ctx.lineWidth = r * .02;
        ctx.beginPath(); ctx.ellipse(0, 0, r * .34, r, 0, 0, PI2); ctx.stroke(); sheen(r, true);
    }
    function volleyball(r) {
        var g = ctx.createRadialGradient(-r * .35, -r * .4, r * .2, 0, 0, r);
        g.addColorStop(0, '#fff'); g.addColorStop(.8, '#f0f4f8'); g.addColorStop(1, '#c6ccd2');
        ctx.fillStyle = g; circle(r); ctx.fill();
        ctx.save(); circle(r); ctx.clip();
        ctx.strokeStyle = 'rgba(38,58,88,.6)'; ctx.lineWidth = r * .055; ctx.lineCap = 'round';
        for (var k = 0; k < 3; k++) { ctx.save(); ctx.rotate(k * PI2 / 3);
            for (var j = 0; j < 2; j++) { var off = (j ? 1 : -1) * r * .17;
                ctx.beginPath(); ctx.moveTo(-r * 1.15, off); ctx.quadraticCurveTo(0, off + r * .55, r * 1.15, off); ctx.stroke(); }
            ctx.restore(); }
        ctx.restore();
        ctx.strokeStyle = 'rgba(38,58,88,.3)'; ctx.lineWidth = r * .02; circle(r); ctx.stroke(); sheen(r);
    }

    // ---- the crest: silver medallion + the real compass -----------------
    function crest(r) {
        var g = ctx.createRadialGradient(-r * .32, -r * .34, r * .15, 0, 0, r);
        g.addColorStop(0, '#f4f7fa'); g.addColorStop(.68, '#c3c9d1'); g.addColorStop(1, '#8a9199');
        circle(r); ctx.fillStyle = g; ctx.fill();
        ctx.lineWidth = r * .035; ctx.strokeStyle = 'rgba(90,96,106,.85)'; circle(r); ctx.stroke();
        if (logoReady && logo.naturalWidth) {
            var iw = logo.naturalWidth, ih = logo.naturalHeight, fit = 1.42 * r / Math.max(iw, ih);
            ctx.drawImage(logo, -iw * fit / 2, -ih * fit / 2, iw * fit, ih * fit);
        }
    }

    var faces = [basketball, soccer, tennis, lacrosse, volleyball, crest];
    function drawFace(i, scaleX, r) { ctx.save(); ctx.translate(cx, cy); shadow(r); ctx.scale(scaleX, 1); faces[i](r); ctx.restore(); }

    function spotlight(alpha) {
        ctx.save(); ctx.globalAlpha = alpha;
        var g = ctx.createRadialGradient(cx, cy, R * .3, cx, cy, R * 2.8);
        g.addColorStop(0, 'rgba(195,201,209,.12)'); g.addColorStop(1, 'rgba(195,201,209,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
    }
    function wordmark(alpha) {
        ctx.save(); ctx.globalAlpha = alpha; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 ' + Math.min(W * 0.052, 50) + 'px "Oswald","Arial Narrow",system-ui,sans-serif';
        ctx.fillStyle = '#fff'; ctx.shadowColor = 'rgba(195,201,209,.5)'; ctx.shadowBlur = 18;
        ctx.fillText('BIG NORTH CONFERENCE', cx, cy + R * 1.85);
        ctx.shadowBlur = 0; ctx.globalAlpha = alpha * .9; ctx.strokeStyle = '#c3c9d1'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx - R * 1.1, cy + R * 1.45); ctx.lineTo(cx + R * 1.1, cy + R * 1.45); ctx.stroke();
        ctx.restore();
    }

    // ---- timeline -------------------------------------------------------
    var SHOW = 440, FLIP = 240, UNIT = SHOW + FLIP, BALLS = 5, LOGO_HOLD = 700, SWAP = 800, TAG_HOLD = 1500;
    var ballsEnd = BALLS * UNIT;
    function easeOutBack(p) { var c = 1.70158, c3 = c + 1; return 1 + c3 * Math.pow(p - 1, 3) + c * Math.pow(p - 1, 2); }

    function frame(ts) {
        if (ended) return;
        if (start === null) start = ts;
        var e = ts - start;
        ctx.clearRect(0, 0, W, H);
        spotlight(0.85);

        if (e < ballsEnd) {
            var idx = Math.floor(e / UNIT), into = e - idx * UNIT;
            if (into < SHOW) drawFace(idx, 1, R);
            else { var q = (into - SHOW) / FLIP, sx = Math.abs(Math.cos(q * PI)), f = q < 0.5 ? idx : idx + 1; drawFace(f, sx, R); }
        } else {
            var t = e - ballsEnd;
            if (t < LOGO_HOLD) { var pop = t < 220 ? easeOutBack(t / 220) : 1; drawFace(5, 1, R * pop); }
            else if (t < LOGO_HOLD + SWAP) { drawFace(5, 1, R); wordmark((t - LOGO_HOLD) / SWAP); }
            else if (t < LOGO_HOLD + SWAP + TAG_HOLD) { drawFace(5, 1, R); wordmark(1); }
            else { finish(); return; }
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
    setTimeout(finish, 11000);           // hard safety net
    raf = requestAnimationFrame(frame);
})();
