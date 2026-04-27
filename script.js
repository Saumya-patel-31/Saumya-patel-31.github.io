/* =============================================================
   SAUMY KASHYAP · PORTFOLIO 2026 — interactions
   Loader · Cursor · Section observer · BG fade · Scroll filter
   · Reveals · Parallax · Nav spy · Magnetic buttons
   ============================================================= */

(() => {
  const $  = (s, p = document) => p.querySelector(s);
  const $$ = (s, p = document) => Array.from(p.querySelectorAll(s));
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ----------------------------------------------------------
     1. LOADER
  ---------------------------------------------------------- */
  const loader   = $('#loader');
  const fill     = $('#loaderFill');
  const pctEl    = $('#loaderPct');

  const boot = () => new Promise(res => {
    let p = 0;
    const tick = () => {
      p += Math.random() * 6 + 2;
      if (p >= 100) p = 100;
      fill.style.width = p + '%';
      pctEl.textContent = Math.floor(p) + '%';
      if (p < 100) requestAnimationFrame(() => setTimeout(tick, 30));
      else setTimeout(res, 220);
    };
    tick();
  });

  const preloadImages = () => {
    const urls = $$('.bg__layer[style]').map(el =>
      (el.style.backgroundImage.match(/url\(["']?(.+?)["']?\)/) || [])[1]
    ).filter(Boolean);
    return Promise.all(urls.map(src => new Promise(res => {
      const i = new Image();
      i.onload = i.onerror = res;
      i.src = src;
    })));
  };

  Promise.all([boot(), preloadImages()]).then(() => {
    loader.classList.add('is-done');
    document.body.classList.add('is-ready');
    // kick off hero reveal
    const hero = $('#hero .reveal-lines');
    if (hero) requestAnimationFrame(() => hero.classList.add('is-in'));
  });

  /* ----------------------------------------------------------
     2. CUSTOM CURSOR
  ---------------------------------------------------------- */
  const dot  = $('#cursor');
  const ring = $('#cursorRing');
  let mx = window.innerWidth / 2, my = window.innerHeight / 2;
  let rx = mx, ry = my;

  if (window.matchMedia('(hover: hover)').matches) {
    window.addEventListener('mousemove', (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    }, { passive: true });

    const tick = () => {
      rx = lerp(rx, mx, 0.18);
      ry = lerp(ry, my, 0.18);
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(tick);
    };
    tick();

    const setState = (type) => {
      ['link', 'btn', 'view', 'locked'].forEach(k => {
        dot.classList.toggle('is-' + k, k === type);
        ring.classList.toggle('is-' + k, k === type);
      });
    };

    $$('[data-cursor]').forEach(el => {
      const type = el.dataset.cursor;
      el.addEventListener('mouseenter', () => setState(type));
      el.addEventListener('mouseleave', () => setState(null));
    });

    // hide while idle? nah, always on.
    window.addEventListener('mouseleave', () => {
      dot.style.opacity = '0'; ring.style.opacity = '0';
    });
    window.addEventListener('mouseenter', () => {
      dot.style.opacity = '1'; ring.style.opacity = '1';
    });
  }

  /* ----------------------------------------------------------
     3. BACKGROUND CROSS-FADE + SCROLL FILTER + NAV SPY
         opacity for each bg layer is computed continuously from
         each section's position in the viewport — adjacent sections
         naturally blend as you scroll between them.
  ---------------------------------------------------------- */
  const sections  = $$('.section[data-bg]');
  const bgLayers  = $$('.bg__layer');
  const bgBySlug  = Object.fromEntries(bgLayers.map(l => [l.dataset.section, l]));
  const navLinks  = $$('.nav__links a');

  // smoothstep — softens the edges of the fade curve so adjacent
  // sections ease in/out instead of fading linearly
  const smoothstep = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  const root     = document.documentElement;
  let scrollRAF  = null;

  const onScroll = () => {
    const y  = window.scrollY;
    const vh = window.innerHeight;
    const vc = y + vh / 2;                       // viewport center (document-space)
    const h  = document.documentElement.scrollHeight - vh;
    const p  = h > 0 ? clamp(y / h, 0, 1) : 0;   // 0..1 page progress

    // ---- global scroll-driven CSS vars
    root.style.setProperty('--scroll', p.toFixed(4));
    root.style.setProperty('--bg-hue',  (-40 * p).toFixed(2) + 'deg');
    root.style.setProperty('--bg-sat',  (1 + 0.18 * Math.sin(p * Math.PI)).toFixed(3));
    root.style.setProperty('--bg-blur', (0.8 * Math.sin(p * Math.PI)).toFixed(2) + 'px');
    root.style.setProperty('--nav-veil', clamp(y / 400, 0, 1).toFixed(3));

    // ---- per-section bg opacity
    // Score = how close the section's center is to the viewport center,
    // normalised by viewport height. Full opacity at center, fades to 0
    // when the section is a full viewport away. Smoothstep softens the curve.
    let bestScore = -1;
    let bestSlug  = null;
    let bestId    = null;

    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();
      const secCenterDoc = rect.top + window.scrollY + rect.height / 2;
      const dist   = Math.abs(secCenterDoc - vc);
      const raw    = 1 - dist / vh;
      const score  = smoothstep(raw);

      const slug = sec.dataset.bg;
      const layer = bgBySlug[slug];
      if (layer) layer.style.opacity = score.toFixed(4);

      if (score > bestScore) {
        bestScore = score;
        bestSlug  = slug;
        bestId    = sec.id;
      }
    });

    // nav active link — just the section closest to viewport center
    if (bestId) {
      navLinks.forEach(a => a.classList.toggle('is-active', a.getAttribute('href') === '#' + bestId));
    }

    scrollRAF = null;
  };

  const requestScroll = () => {
    if (scrollRAF !== null) return;
    scrollRAF = requestAnimationFrame(onScroll);
  };
  window.addEventListener('scroll', requestScroll, { passive: true });
  window.addEventListener('resize', requestScroll);
  onScroll();

  /* ----------------------------------------------------------
     5. REVEAL ON SCROLL
  ---------------------------------------------------------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('is-in');
        revealObserver.unobserve(e.target);
      }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -8% 0px' });

  $$('.reveal, .reveal-lines').forEach(el => revealObserver.observe(el));

  /* ----------------------------------------------------------
     6. MAGNETIC INTERACTIONS on [data-cursor="btn"]
  ---------------------------------------------------------- */
  if (!prefersReduced && window.matchMedia('(hover: hover)').matches) {
    $$('[data-cursor="btn"]').forEach(el => {
      let raf = null, tx = 0, ty = 0, ctx = 0, cty = 0;
      const strength = 14;
      const onMove = (e) => {
        const r = el.getBoundingClientRect();
        const dx = e.clientX - (r.left + r.width / 2);
        const dy = e.clientY - (r.top + r.height / 2);
        tx = dx * 0.22; ty = dy * 0.22;
        if (!raf) raf = requestAnimationFrame(tick);
      };
      const tick = () => {
        ctx = lerp(ctx, tx, 0.2); cty = lerp(cty, ty, 0.2);
        el.style.transform = `translate(${ctx}px, ${cty}px)`;
        if (Math.abs(ctx - tx) > 0.1 || Math.abs(cty - ty) > 0.1) raf = requestAnimationFrame(tick);
        else raf = null;
      };
      const reset = () => {
        tx = 0; ty = 0;
        if (!raf) raf = requestAnimationFrame(tick);
      };
      el.addEventListener('mousemove', onMove);
      el.addEventListener('mouseleave', reset);
    });
  }

  /* ----------------------------------------------------------
     7. PROJECT TILT ON HOVER
  ---------------------------------------------------------- */
  if (!prefersReduced && window.matchMedia('(hover: hover)').matches) {
    $$('.project').forEach(el => {
      const inner = el;
      el.addEventListener('mousemove', (e) => {
        const r = el.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        inner.style.transform = `perspective(1000px) rotateX(${-y * 1.2}deg) rotateY(${x * 1.8}deg) translateZ(0)`;
      });
      el.addEventListener('mouseleave', () => {
        inner.style.transform = '';
      });
    });
  }

  /* ----------------------------------------------------------
     8. BACK TO TOP
  ---------------------------------------------------------- */
  const toTop = $('#toTop');
  if (toTop) toTop.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  /* ----------------------------------------------------------
     9. SMOOTH NAV CLICKS (in case browser ignores scroll-behavior)
  ---------------------------------------------------------- */
  $$('a[href^="#"]').forEach(a => {
    a.addEventListener('click', (e) => {
      const id = a.getAttribute('href');
      if (id && id.length > 1 && $(id)) {
        e.preventDefault();
        $(id).scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  });

  /* ----------------------------------------------------------
     10. KEY INTERACTIONS — press 'g' to glitch background briefly
  ---------------------------------------------------------- */
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g') {
      root.style.transition = 'filter .12s';
      root.style.setProperty('--bg-blur', '6px');
      root.style.setProperty('--bg-hue', '180deg');
      setTimeout(() => {
        root.style.setProperty('--bg-blur', '0px');
        root.style.setProperty('--bg-hue', (-60 * parseFloat(getComputedStyle(root).getPropertyValue('--scroll'))).toFixed(2) + 'deg');
      }, 280);
    }
  });
})();
