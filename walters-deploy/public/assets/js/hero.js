/* Walters Exterminating: home page hero slideshow.
   Photos change with a ripple drawn in WebGL: a noise-wobbled circle opens
   out from a point with a pale green ring riding its edge. No libraries.
   Without WebGL, or with reduced motion, the photos simply cross fade. */
(function () {
  'use strict';

  var hero = document.querySelector('[data-hero]');
  if (!hero) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var imgs = [].slice.call(hero.querySelectorAll('.hero__img'));
  var tabs = [].slice.call(hero.querySelectorAll('[data-go]'));
  var pauseBtn = hero.querySelector('[data-hero-pause]');
  var canvas = hero.querySelector('.hero__gl');
  if (imgs.length < 2) return;

  var SLIDE_MS = 7000;
  var TRANS_MS = 1900;
  var DRIFT_MS = 9000;
  var PAUSE_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><path d="M9 5v14M15 5v14"/></svg>';
  var PLAY_SVG = '<svg class="icon" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>';

  hero.style.setProperty('--slide-ms', SLIDE_MS + 'ms');

  var index = 0;
  var userPaused = reduce;
  var onScreen = true;
  var timer = 0;
  var dueAt = 0;
  var remaining = SLIDE_MS;
  var gl = null;

  /* ------------------------------------------------------------ slideshow timing */

  function running() { return !userPaused && onScreen && !document.hidden; }

  function schedule(ms) {
    clearTimeout(timer);
    remaining = ms;
    if (!running()) return;
    dueAt = performance.now() + ms;
    timer = setTimeout(function () { go(index + 1); }, ms);
  }

  function hold() {
    if (timer) {
      clearTimeout(timer);
      timer = 0;
      remaining = Math.max(400, dueAt - performance.now());
    }
  }

  function syncState() {
    hero.classList.toggle('is-paused', !running());
    if (running()) { if (!timer) schedule(remaining); } else hold();
    if (gl) gl.setActive(onScreen && !document.hidden);
  }

  function paintTabs() {
    tabs.forEach(function (t, k) {
      t.classList.remove('is-active');
      t.classList.toggle('is-done', k < index);
      if (k === index) t.setAttribute('aria-current', 'true'); else t.removeAttribute('aria-current');
    });
    void hero.offsetWidth; // restart the progress bar animation
    tabs[index].classList.add('is-active');
  }

  function ensureLoaded(img) {
    if (img.loading === 'lazy') img.loading = 'eager';
    return img.decode ? img.decode().catch(function () {}) : Promise.resolve();
  }

  function go(next, origin) {
    next = (next + imgs.length) % imgs.length;
    timer = 0;
    if (next === index) { schedule(SLIDE_MS); return; }
    if (gl && !gl.ready(next)) { // photo still downloading: show it as soon as it is ready
      clearTimeout(timer);
      gl.load(next).then(function () { go(next, origin); });
      return;
    }
    var prev = index;
    index = next;
    paintTabs();
    imgs.forEach(function (im, k) {
      if (k === index) im.removeAttribute('aria-hidden'); else im.setAttribute('aria-hidden', 'true');
    });
    if (gl) {
      gl.transition(prev, index, origin);
    } else {
      ensureLoaded(imgs[index]);
      imgs.forEach(function (im, k) { im.classList.toggle('is-active', k === index); });
    }
    imgs.forEach(function (im, k) { if (k === (index + 1) % imgs.length) ensureLoaded(im); });
    schedule(SLIDE_MS + (gl ? TRANS_MS * 0.5 : 0));
  }

  tabs.forEach(function (t) {
    t.addEventListener('click', function () {
      var r = t.getBoundingClientRect();
      var h = hero.getBoundingClientRect();
      var origin = [(r.left + r.width / 2 - h.left) / h.width, 1 - (r.top - h.top) / h.height];
      go(parseInt(t.getAttribute('data-go'), 10), origin);
    });
  });

  function paintPause() {
    if (!pauseBtn) return;
    pauseBtn.innerHTML = userPaused ? PLAY_SVG : PAUSE_SVG;
    pauseBtn.setAttribute('aria-label', userPaused ? 'Play slideshow' : 'Pause slideshow');
  }
  if (pauseBtn) {
    pauseBtn.addEventListener('click', function () {
      userPaused = !userPaused;
      paintPause();
      syncState();
    });
  }
  paintPause();

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      onScreen = entries[0].isIntersecting;
      syncState();
    }, { threshold: 0.02 }).observe(hero);
  }
  document.addEventListener('visibilitychange', syncState);

  /* ------------------------------------------------------------ WebGL renderer */

  var VERT = 'attribute vec2 aPos;varying vec2 vUv;void main(){vUv=aPos*0.5+0.5;gl_Position=vec4(aPos,0.0,1.0);}';
  var FRAG = [
    'precision highp float;',
    'uniform sampler2D uTex0;uniform sampler2D uTex1;',
    'uniform vec2 uRes;uniform vec2 uSize0;uniform vec2 uSize1;',
    'uniform float uZoom0;uniform float uZoom1;uniform float uP;uniform float uRing;uniform float uTime;',
    'uniform vec2 uCenter;uniform vec2 uRingCenter;uniform vec2 uMouse;',
    'varying vec2 vUv;',
    'vec2 cover(vec2 uv,vec2 size,float zoom){',
    '  float rs=uRes.x/uRes.y;float ri=size.x/size.y;',
    '  vec2 s=rs>ri?vec2(1.0,ri/rs):vec2(rs/ri,1.0);',
    '  return clamp((uv-0.5)*s/zoom+0.5+uMouse*0.01*s,0.001,0.999);',
    '}',
    'float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);vec2 u=f*f*(3.0-2.0*f);',
    '  return mix(mix(hash(i),hash(i+vec2(1.0,0.0)),u.x),mix(hash(i+vec2(0.0,1.0)),hash(i+vec2(1.0,1.0)),u.x),u.y);}',
    'float reach(vec2 c,vec2 asp){return length(vec2(max(c.x,1.0-c.x),max(c.y,1.0-c.y))*asp);}',
    'void main(){',
    '  vec2 uv=vUv;uv.y=1.0-uv.y;',
    '  vec2 sp=vec2(vUv.x,vUv.y);',
    '  vec2 asp=vec2(uRes.x/uRes.y,1.0);',
    '  float wob=(noise(sp*3.5+uTime*0.12)+noise(sp*9.0-uTime*0.2)*0.5)*0.09-0.068;',
    '  vec2 d=(sp-uCenter)*asp;float dist=length(d);',
    '  float radius=uP*(reach(uCenter,asp)+0.32)-0.1;',
    '  float edge=dist+wob-radius;',
    '  float live=step(0.0001,uP)*(1.0-smoothstep(0.9,1.0,uP));',
    '  float ring=exp(-(edge*edge)/0.0028)*live;',
    '  vec2 dir=dist>0.0001?(d/dist)/asp:vec2(0.0);',
    '  vec2 disp=dir*ring*0.028;disp.y=-disp.y;',
    '  float mask=smoothstep(-0.012,0.012,edge);',
    '  vec3 cNew=texture2D(uTex1,cover(uv-disp,uSize1,uZoom1)).rgb;',
    '  vec3 cOld=texture2D(uTex0,cover(uv+disp*0.7,uSize0,uZoom0)).rgb;',
    '  vec3 col=mix(cNew,cOld,mask);',
    '  vec3 teal=vec3(0.44,0.62,0.58);',
    '  col+=teal*ring*0.62+vec3(0.85,1.0,1.0)*pow(ring,8.0)*0.35;',
    '  float halo=exp(-(edge*edge)/0.03)*live*0.18;col=mix(col,col*vec3(0.75,1.08,1.08),halo);',
    '  if(uRing>0.0&&uRing<1.0){',
    '    vec2 d2=(sp-uRingCenter)*asp;float e2=length(d2)+wob-uRing*(reach(uRingCenter,asp)+0.3);',
    '    float fade=(1.0-uRing)*smoothstep(0.0,0.08,uRing);',
    '    col+=teal*exp(-(e2*e2)/0.004)*fade*0.9;',
    '    col+=teal*exp(-(e2*e2)/0.05)*fade*0.12;',
    '    float e3=length(d2)+wob-uRing*0.72*(reach(uRingCenter,asp)+0.3);',
    '    col+=teal*exp(-(e3*e3)/0.0015)*fade*0.45;',
    '  }',
    '  gl_FragColor=vec4(col,1.0);',
    '}'
  ].join('\n');

  function ease(t) { return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function drift(start, now) { return 1.1 - 0.08 * Math.min(1, Math.max(0, (now - start) / DRIFT_MS)); }

  function createRenderer() {
    var ctx;
    try {
      ctx = canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, premultipliedAlpha: false, powerPreference: 'high-performance' });
    } catch (e) { ctx = null; }
    if (!ctx) return null;
    var g = ctx;

    function shader(type, src) {
      var s = g.createShader(type);
      g.shaderSource(s, src);
      g.compileShader(s);
      if (!g.getShaderParameter(s, g.COMPILE_STATUS)) throw new Error(g.getShaderInfoLog(s));
      return s;
    }
    var prog = g.createProgram();
    g.attachShader(prog, shader(g.VERTEX_SHADER, VERT));
    g.attachShader(prog, shader(g.FRAGMENT_SHADER, FRAG));
    g.linkProgram(prog);
    if (!g.getProgramParameter(prog, g.LINK_STATUS)) throw new Error('link failed');
    g.useProgram(prog);

    var buf = g.createBuffer();
    g.bindBuffer(g.ARRAY_BUFFER, buf);
    g.bufferData(g.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), g.STATIC_DRAW);
    var aPos = g.getAttribLocation(prog, 'aPos');
    g.enableVertexAttribArray(aPos);
    g.vertexAttribPointer(aPos, 2, g.FLOAT, false, 0, 0);

    var U = {};
    ['uTex0', 'uTex1', 'uRes', 'uSize0', 'uSize1', 'uZoom0', 'uZoom1', 'uP', 'uRing', 'uTime', 'uCenter', 'uRingCenter', 'uMouse']
      .forEach(function (n) { U[n] = g.getUniformLocation(prog, n); });
    g.uniform1i(U.uTex0, 0);
    g.uniform1i(U.uTex1, 1);

    var textures = imgs.map(function () { return { tex: null, w: 1, h: 1, loading: null }; });
    var zoomStart = imgs.map(function () { return performance.now(); });
    var state = { from: 0, to: 0, start: 0, origin: [0.68, 0.45], ringStart: -1 };
    var mouse = { x: 0, y: 0, tx: 0, ty: 0 };
    var active = true;
    var raf = 0;
    var frame = 0;
    var t0 = performance.now();

    function upload(i) {
      var im = imgs[i];
      var t = textures[i];
      var tex = g.createTexture();
      g.bindTexture(g.TEXTURE_2D, tex);
      g.pixelStorei(g.UNPACK_FLIP_Y_WEBGL, false);
      g.texImage2D(g.TEXTURE_2D, 0, g.RGB, g.RGB, g.UNSIGNED_BYTE, im);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MIN_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_MAG_FILTER, g.LINEAR);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_S, g.CLAMP_TO_EDGE);
      g.texParameteri(g.TEXTURE_2D, g.TEXTURE_WRAP_T, g.CLAMP_TO_EDGE);
      t.tex = tex;
      t.w = im.naturalWidth;
      t.h = im.naturalHeight;
    }

    function load(i) {
      var t = textures[i];
      if (t.tex) return Promise.resolve();
      if (!t.loading) {
        t.loading = ensureLoaded(imgs[i]).then(function () {
          if (imgs[i].complete && imgs[i].naturalWidth) upload(i);
          t.loading = null;
        });
      }
      return t.loading;
    }

    function resize() {
      var dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      var w = hero.clientWidth;
      var h = hero.clientHeight;
      var scale = Math.min(dpr, Math.sqrt(2600000 / Math.max(1, w * h)));
      var cw = Math.max(1, Math.round(w * scale));
      var ch = Math.max(1, Math.round(h * scale));
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
        g.viewport(0, 0, cw, ch);
      }
    }

    function draw(now) {
      var p = 0;
      var from = state.to;
      var to = state.to;
      if (state.start) {
        var raw = (now - state.start) / TRANS_MS;
        if (raw >= 1) {
          state.start = 0;
        } else {
          p = ease(raw);
          from = state.from;
        }
      }
      var t0x = textures[from];
      var t1x = textures[to];
      if (!t0x.tex || !t1x.tex) return;
      g.activeTexture(g.TEXTURE0);
      g.bindTexture(g.TEXTURE_2D, t0x.tex);
      g.activeTexture(g.TEXTURE1);
      g.bindTexture(g.TEXTURE_2D, t1x.tex);
      g.uniform2f(U.uRes, canvas.width, canvas.height);
      g.uniform2f(U.uSize0, t0x.w, t0x.h);
      g.uniform2f(U.uSize1, t1x.w, t1x.h);
      g.uniform1f(U.uZoom0, drift(zoomStart[from], now));
      g.uniform1f(U.uZoom1, drift(zoomStart[to], now));
      g.uniform1f(U.uP, p);
      g.uniform2f(U.uCenter, state.origin[0], state.origin[1]);
      var ring = state.ringStart < 0 ? 0 : (now - state.ringStart) / 2600;
      if (ring >= 1) { state.ringStart = -1; ring = 0; }
      g.uniform1f(U.uRing, ring);
      g.uniform2f(U.uRingCenter, 0.7, 0.42);
      g.uniform1f(U.uTime, (now - t0) / 1000);
      g.uniform2f(U.uMouse, mouse.x, mouse.y);
      g.drawArrays(g.TRIANGLES, 0, 3);
    }

    function loop(now) {
      raf = 0;
      if (!active) return;
      frame++;
      mouse.x += (mouse.tx - mouse.x) * 0.06;
      mouse.y += (mouse.ty - mouse.y) * 0.06;
      var busy = state.start || state.ringStart >= 0 || Math.abs(mouse.tx - mouse.x) + Math.abs(mouse.ty - mouse.y) > 0.002;
      if (busy || frame % 2 === 0) { resize(); draw(now); }
      raf = requestAnimationFrame(loop);
    }

    function setActive(on) {
      active = on;
      if (on && !raf) raf = requestAnimationFrame(loop);
    }

    if (window.matchMedia('(pointer: fine)').matches) {
      hero.addEventListener('pointermove', function (e) {
        var r = hero.getBoundingClientRect();
        mouse.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        mouse.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
      }, { passive: true });
      hero.addEventListener('pointerleave', function () { mouse.tx = 0; mouse.ty = 0; });
    }

    canvas.addEventListener('webglcontextlost', function (e) {
      e.preventDefault();
      active = false;
      gl = null;
      hero.classList.remove('is-gl');
      imgs.forEach(function (im, k) { im.classList.toggle('is-active', k === index); });
    });

    return {
      start: function () {
        return load(0).then(function () {
          if (!textures[0].tex) throw new Error('first photo not ready');
          zoomStart[0] = currentDriftStart(imgs[0]);
          resize();
          draw(performance.now());
          hero.classList.add('is-gl');
          state.ringStart = performance.now() + 150;
          raf = requestAnimationFrame(loop);
          imgs.forEach(function (im, k) { if (k) load(k); });
        });
      },
      load: load,
      ready: function (i) { return !!textures[i].tex; },
      setActive: setActive,
      transition: function (a, b, origin) {
        var now = performance.now();
        if (state.start) a = state.to; // a transition was still running: continue from where it was heading
        state.from = a;
        state.to = b;
        state.start = now;
        state.origin = origin || [0.7, 0.45];
        zoomStart[b] = now;
        setActive(active);
      }
    };
  }

  /* ------------------------------------------------------------ start */

  // Match the zoom the photo already has from its CSS animation, so the switch to WebGL is invisible.
  function currentDriftStart(img) {
    var now = performance.now();
    var m = /matrix\(([^,]+)/.exec(window.getComputedStyle(img).transform || '');
    var scale = m ? parseFloat(m[1]) : 1.1;
    if (!(scale > 0)) scale = 1.1;
    return now - Math.min(1, Math.max(0, (1.1 - scale) / 0.08)) * DRIFT_MS;
  }
  function begin() {
    if (!reduce && canvas && window.WebGLRenderingContext) {
      try {
        var r = createRenderer();
        if (r) {
          r.start().then(function () { gl = r; syncState(); }, function () { hero.classList.remove('is-gl'); });
        }
      } catch (err) {
        hero.classList.remove('is-gl');
      }
    }
    schedule(SLIDE_MS);
    syncState();
  }

  var first = imgs[0];
  if (first.complete && first.naturalWidth) begin();
  else {
    first.addEventListener('load', begin, { once: true });
    first.addEventListener('error', begin, { once: true });
  }
})();
