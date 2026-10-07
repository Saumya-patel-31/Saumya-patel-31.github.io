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

  const bgUrls = () => $$('.bg__layer[style]').map(el =>
    (el.style.backgroundImage.match(/url\(["']?(.+?)["']?\)/) || [])[1]
  ).filter(Boolean);

  const load1 = src => new Promise(res => {
    const i = new Image();
    i.onload = i.onerror = res;
    i.src = src;
  });

  // Only block the loader on the hero image (the sole layer visible at first
  // paint). The rest are multi-MB PNGs behind later sections — load them in
  // the background once the page is interactive so time-to-reveal stays low.
  const preloadHero = () => {
    const [hero] = bgUrls();
    return hero ? load1(hero) : Promise.resolve();
  };

  const preloadRest = () => {
    const rest = bgUrls().slice(1);
    const run = () => rest.forEach(load1);
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 2000 });
    else setTimeout(run, 200);
  };

  Promise.all([boot(), preloadHero()]).then(() => {
    loader.classList.add('is-done');
    document.body.classList.add('is-ready');
    preloadRest();
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
      ['link', 'btn', 'view'].forEach(k => {
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
     2b. TEXT FX — word splitting, read-along, scramble, count-up
  ---------------------------------------------------------- */
  // Wrap every word under `root` in <span class=cls>, keeping child
  // elements (<em>, <a>…) intact so styling and links survive.
  const splitWords = (root, cls, onWord) => {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      if (!node.textContent.trim()) return;
      const frag = document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(part => {
        if (!part) return;
        if (!part.trim()) { frag.appendChild(document.createTextNode(part)); return; }
        const w = document.createElement('span');
        w.className = cls;
        w.textContent = part;
        if (onWord) onWord(w);
        frag.appendChild(w);
      });
      node.parentNode.replaceChild(frag, node);
    });
  };

  // kinetic headlines: words rise one after another (CSS staggers on --wi)
  if (!prefersReduced) {
    $$('.reveal-lines').forEach(h => {
      let wi = 0;
      splitWords(h, 'w', w => w.style.setProperty('--wi', wi++));
      h.classList.add('is-split');
    });
  }

  // read-along paragraphs: onScroll feeds --p (0..1); each word lights in turn
  const scrubs = $$('[data-scrub]');
  scrubs.forEach(el => {
    let i = 0;
    splitWords(el, 'w', w => w.style.setProperty('--i', i++));
    el.style.setProperty('--n', i);
    el.style.setProperty('--p', prefersReduced ? 1 : 0);
  });

  // text scramble — random glyphs that resolve into the target text
  const GLYPHS = '!<>-_/[]{}=+*^?#ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const esc = c => c === '<' ? '&lt;' : c === '>' ? '&gt;' : c === '&' ? '&amp;' : c;
  const scramble = (el, to, { frames = 26, tint = true } = {}) => {
    cancelAnimationFrame(el._scr);
    if (prefersReduced) { el.textContent = to; return; }
    const from = el.textContent;
    const q = Array.from({ length: Math.max(from.length, to.length) }, (_, i) => {
      const start = Math.floor(Math.random() * frames * 0.5);
      const end = start + Math.ceil(frames * 0.5) + Math.floor(Math.random() * frames * 0.5);
      return { from: from[i] || '', to: to[i] || '', start, end, ch: '' };
    });
    let f = 0;
    const tick = () => {
      let out = '', done = 0;
      for (const c of q) {
        if (f >= c.end) { done++; out += esc(c.to); }
        else if (f >= c.start) {
          if (!c.ch || Math.random() < 0.3) c.ch = GLYPHS[Math.floor(Math.random() * GLYPHS.length)];
          out += tint ? `<span class="scramble-ch">${esc(c.ch)}</span>` : esc(c.ch);
        } else out += esc(c.from);
      }
      if (done === q.length) { el.textContent = to; return; }
      el.innerHTML = out;
      f++;
      el._scr = requestAnimationFrame(tick);
    };
    tick();
  };

  // count-up for stats; starts from 0 once the stat scrolls into view
  const counters = $$('[data-count]');
  const fmtCount = (el, v) => v.toFixed(+(el.dataset.decimals || 0)) + (el.dataset.suffix || '');
  if (!prefersReduced) counters.forEach(el => { el.textContent = fmtCount(el, 0); });
  const countUp = (el) => {
    const end = parseFloat(el.dataset.count);
    if (prefersReduced) { el.textContent = fmtCount(el, end); return; }
    const t0 = performance.now(), dur = 1500;
    const tick = (now) => {
      const t = clamp((now - t0) / dur, 0, 1);
      el.textContent = fmtCount(el, end * (1 - Math.pow(1 - t, 3)));
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };

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
  const PARALLAX  = 64;   // px of vertical drift across a section (± half this)

  // smoothstep — softens the edges of the fade curve so adjacent
  // sections ease in/out instead of fading linearly
  const smoothstep = (t) => {
    t = clamp(t, 0, 1);
    return t * t * (3 - 2 * t);
  };

  const root     = document.documentElement;
  const bgFocus  = $('#bgFocus');
  let scrollRAF  = null;

  const onScroll = () => {
    const y  = window.scrollY;
    const vh = window.innerHeight;
    const h  = document.documentElement.scrollHeight - vh;
    const p  = h > 0 ? clamp(y / h, 0, 1) : 0;   // 0..1 page progress

    // ---- global scroll-driven CSS vars
    root.style.setProperty('--scroll', p.toFixed(4));
    root.style.setProperty('--nav-veil', clamp(y / 400, 0, 1).toFixed(3));

    // ---- per-section bg opacity
    // Score = how close the section's center is to the viewport center,
    // normalised by viewport height. Full opacity at center, fades to 0
    // when the section is a full viewport away. Smoothstep softens the curve.
    let bestScore = -1;
    let bestSlug  = null;
    let bestId    = null;
    let heroScore = 0;

    sections.forEach(sec => {
      const rect = sec.getBoundingClientRect();   // viewport-relative
      const vcy  = vh / 2;                         // viewport center
      // Distance from the viewport center to the section's NEAREST EDGE —
      // 0 whenever the center sits anywhere inside the section. This keeps
      // tall sections (Work stacks 6 projects) fully lit across their whole
      // length instead of fading to black in the middle.
      const d = rect.top > vcy    ? rect.top - vcy
              : rect.bottom < vcy ? vcy - rect.bottom
              : 0;
      const raw   = 1 - d / (vh * 0.6);            // ~0.6vh crossfade between sections
      const score = smoothstep(raw);

      const slug = sec.dataset.bg;
      const layer = bgBySlug[slug];
      if (slug === 'hero') heroScore = score;
      if (layer) {
        layer.style.opacity = score.toFixed(4);
        // Gentle parallax: the frame drifts up as its section scrolls past,
        // so the image reads as tied to the content instead of a static crop.
        const q  = clamp((vcy - rect.top) / rect.height, 0, 1);
        const ty = prefersReduced ? 0 : (0.5 - q) * PARALLAX;
        layer.style.transform = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(1.16)`;
      }

      if (score > bestScore) {
        bestScore = score;
        bestSlug  = slug;
        bestId    = sec.id;
      }
    });

    // ---- Work carries two backgrounds that cross-fade across its long
    // project list: Brooklyn Bridge up top → Travel toward the lower
    // projects. The generic loop above already lit the 'work' layer to the
    // section's visibility; here we re-split that same visibility between the
    // two frames based on how far the viewport has travelled through Work, so
    // their opacities always sum to it (no black, no double-exposure).
    const workSec = document.getElementById('work');
    const workA = bgBySlug['work'];    // Brooklyn Bridge
    const workB = bgBySlug['work2'];   // Travel
    if (workSec && workA && workB) {
      const r  = workSec.getBoundingClientRect();
      const cy = vh / 2;
      const d  = r.top > cy ? r.top - cy : r.bottom < cy ? cy - r.bottom : 0;
      const visible = smoothstep(1 - d / (vh * 0.6));
      const q   = clamp((cy - r.top) / r.height, 0, 1);   // 0 → 1 through the section
      const mix = smoothstep((q - 0.4) / 0.25);           // ramp Travel in past the midpoint
      workA.style.opacity = (visible * (1 - mix)).toFixed(4);
      workB.style.opacity = (visible * mix).toFixed(4);
      // both Work frames share the same parallax so the crossfade stays put
      const ty = prefersReduced ? 0 : (0.5 - q) * PARALLAX;
      const tf = `translate3d(0, ${ty.toFixed(1)}px, 0) scale(1.16)`;
      workA.style.transform = tf;
      workB.style.transform = tf;
    }

    // ---- focus dimmer: art at full strength on the hero, calmer once you're reading
    if (bgFocus) bgFocus.style.opacity = (1 - heroScore).toFixed(3);

    // ---- read-along: 0 when a paragraph enters at 88% of the viewport,
    // 1 once its last line has risen past 45% (reads, then writes)
    if (!prefersReduced && scrubs.length) {
      const ps = scrubs.map(el => {
        const r = el.getBoundingClientRect();
        return clamp((vh * 0.88 - r.top) / (vh * 0.43 + r.height), 0, 1);
      });
      scrubs.forEach((el, i) => el.style.setProperty('--p', ps[i].toFixed(3)));
    }

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
        const n = e.target.querySelector('[data-count]');
        if (n) countUp(n);
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
     7. PROJECT SPOTLIGHT — a soft glow that follows the cursor
  ---------------------------------------------------------- */
  if (window.matchMedia('(hover: hover)').matches) {
    $$('.project').forEach(el => {
      let raf = null, mx = 0, my = 0;
      el.addEventListener('pointermove', (e) => {
        const r = el.getBoundingClientRect();
        mx = e.clientX - r.left; my = e.clientY - r.top;
        if (raf) return;
        raf = requestAnimationFrame(() => {
          el.style.setProperty('--mx', mx + 'px');
          el.style.setProperty('--my', my + 'px');
          raf = null;
        });
      });
    });
  }

  /* ----------------------------------------------------------
     7b. PROCESS — the step in the middle of the screen lights up,
         and the matching lines of process.ts light up with it
  ---------------------------------------------------------- */
  const steps = $$('#processSteps .timeline__step');
  const codeCard = $('#codeCard');
  const codeStatus = $('#codeStatus');
  if (steps.length && codeCard) {
    const lines = $$('.code-line', codeCard);
    lines.forEach((ln, i) => ln.style.setProperty('--li', i));
    $('#processSteps').classList.add('is-live');
    const firstLine = n => lines.findIndex(l => l.dataset.step === String(n)) + 1;
    let current = 0;
    const activate = (n) => {
      if (n === current) return;
      current = n;
      steps.forEach(st => st.classList.toggle('is-active', st.dataset.step === String(n)));
      codeCard.classList.add('has-active');
      lines.forEach(l => l.classList.toggle('is-on', l.dataset.step === String(n)));
      if (codeStatus) codeStatus.textContent = `Ln ${firstLine(n)}, Col 5 · step 0${n}`;
    };
    activate(1);
    const stepObs = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) activate(+e.target.dataset.step); });
    }, { rootMargin: '-45% 0px -45% 0px' });
    steps.forEach(st => {
      stepObs.observe(st);
      st.addEventListener('mouseenter', () => activate(+st.dataset.step));
    });

    // type the code in, line by line, the first time the panel is seen
    if (!prefersReduced) {
      codeCard.classList.add('is-armed');
      const typeObs = new IntersectionObserver(entries => {
        if (entries.some(e => e.isIntersecting)) {
          codeCard.classList.add('is-typed');
          typeObs.disconnect();
        }
      }, { threshold: 0.2 });
      typeObs.observe(codeCard);
    }
  }

  /* ----------------------------------------------------------
     7c. KINETIC TYPE — rotating role line, nav + label scrambles
  ---------------------------------------------------------- */
  const ticker = $('.role-ticker');
  if (ticker && !prefersReduced) {
    const roles = ticker.dataset.roles.split('|');
    let ri = 0, heroVisible = true;
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; }).observe($('#hero'));
    setTimeout(() => {
      setInterval(() => {
        if (!heroVisible || document.hidden) return;
        ri = (ri + 1) % roles.length;
        scramble(ticker, roles[ri], { frames: 30 });
      }, 2800);
    }, 2600);
  }

  if (!prefersReduced && window.matchMedia('(hover: hover)').matches) {
    $$('.nav__links a').forEach(a => {
      const span = a.querySelector('span');
      const label = span.textContent;
      // plain glyphs here: the nav underline lives on span::after
      a.addEventListener('mouseenter', () => scramble(span, label, { frames: 18, tint: false }));
    });
  }

  const labelObs = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (!e.isIntersecting) return;
      const el = e.target;
      scramble(el, el.textContent, { frames: 28 });
      labelObs.unobserve(el);
    });
  }, { threshold: 1 });
  $$('.section__index span:last-child').forEach(el => labelObs.observe(el));

  /* ----------------------------------------------------------
     7d. MARQUEE LEAN — skews with scroll speed, settles when you stop
  ---------------------------------------------------------- */
  const mqTrack = $('.marquee__track');
  if (mqTrack && !prefersReduced) {
    let lastY = window.scrollY, skew = 0, target = 0, raf = null;
    const loop = () => {
      skew = lerp(skew, target, 0.14);
      target = lerp(target, 0, 0.1);
      mqTrack.style.setProperty('--skew', skew.toFixed(2) + 'deg');
      if (Math.abs(skew) > 0.03 || Math.abs(target) > 0.03) raf = requestAnimationFrame(loop);
      else { mqTrack.style.setProperty('--skew', '0deg'); raf = null; }
    };
    window.addEventListener('scroll', () => {
      const y = window.scrollY;
      target = clamp((lastY - y) * 0.3, -9, 9);
      lastY = y;
      if (!raf) raf = requestAnimationFrame(loop);
    }, { passive: true });
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
         One-off filter on the whole stack, then cleared — no per-frame
         cost, so it doesn't reintroduce scroll jank.
  ---------------------------------------------------------- */
  const bgStack = $('#bgStack');
  window.addEventListener('keydown', (e) => {
    const t = e.target;
    if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
    if (e.key.toLowerCase() === 'g' && bgStack && !e.metaKey && !e.ctrlKey && !e.altKey) {
      bgStack.style.transition = 'filter .28s var(--ease)';
      bgStack.style.filter = 'hue-rotate(180deg) saturate(1.6) blur(3px)';
      setTimeout(() => { bgStack.style.filter = ''; }, 280);
    }
  });
})();

/* =============================================================
   11. CHATBOT — rule-based, trained on this page's content
   ============================================================= */
(() => {
  const root      = document.getElementById('chatbot');
  if (!root) return;
  const launcher  = document.getElementById('chatLauncher');
  const panel     = document.getElementById('chatPanel');
  const closeBtn  = document.getElementById('chatClose');
  const log       = document.getElementById('chatLog');
  const chipsRow  = document.getElementById('chatChips');
  const form      = document.getElementById('chatForm');
  const input     = document.getElementById('chatInput');

  const EMAIL = 'saumyapatel566@gmail.com';
  const PHONE = '(410) 240-1699';

  /* ---------- intent knowledge ----------
     Each intent has trigger keywords (scored against the input)
     and a reply (string or function). pick() returns the highest
     scoring intent, with the most-specific keywords weighted higher. */
  const intents = [
    {
      id: 'greet',
      kw: [['hi', 1], ['hii', 1], ['hello', 1], ['hey', 1], ['yo', 1], ['sup', 1], ['hola', 1], ['namaste', 1]],
      reply: () =>
        `Hey — Saumya here, sort of. I'm the auto-reply on this page. Ask me about <em>projects</em>, my <em>stack</em>, how to <em>reach</em> me, or anything else you see on the site.`,
      chips: ['What have you built?', 'What\'s your stack?', 'How do I contact you?'],
    },
    {
      id: 'about',
      kw: [['who are you', 4], ['about you', 4], ['tell me about', 3], ['who is saumya', 4], ['your story', 3], ['bio', 2], ['background', 2]],
      reply: () =>
        `CS junior at UMBC (graduating Dec 2027), GPA 3.8, on the President's List. 2026 so far: a software-engineering internship at <em>HeadsUp</em> (React Native + Firebase), a Peer Tutor role for UMBC's intro CS courses, and <em>Best Use of ElevenLabs</em> at hackUMBC with my team. <em>Campusly</em> is live with 100+ users. I learn faster by shipping than studying, so I ship.`,
      chips: ['Show me projects', 'Hackathon win?', 'School / GPA'],
    },
    {
      id: 'headsup',
      kw: [['headsup', 5], ['heads up', 5], ['react native', 4], ['firebase', 4], ['firestore', 4], ['expo', 3], ['swe', 3], ['software engineering intern', 5], ['internship', 3], ['mobile app', 3], ['leaderboard', 3], ['experience', 2]],
      reply: () =>
        `<em>HeadsUp — Software Engineering Intern</em> (Jun–Aug 2026), my best experience yet. Shipped 15+ screens of a cross-platform iOS/Android/web app in <em>React Native + Expo</em> — full light/dark design system, WCAG colour tokens, custom data viz. Architected a <em>Firebase/Firestore</em> backend across 9 collections with role-based security rules, then built a group-challenge & leaderboard system with a role-scoped admin console. <a href="https://www.linkedin.com/in/saumya31/details/experience/" target="_blank" rel="noopener">See it on LinkedIn →</a>`,
      chips: ['Show me projects', 'What\'s your stack?', 'How do I reach you?'],
    },
    {
      id: 'carryover',
      kw: [['carryover', 5], ['carry over', 5], ['hackathon', 5], ['hackumbc', 5], ['hack umbc', 5], ['elevenlabs', 5], ['eleven labs', 5], ['mlh', 4], ['award', 4], ['awards', 4], ['prize', 4], ['winner', 4], ['won', 2], ['win', 2], ['medical', 3], ['scribe', 4], ['clinical', 3], ['healthcare', 3]],
      reply: () =>
        `<em>Carryover</em> won <em>Best Use of ElevenLabs</em> (MLH track) at <em>hackUMBC 2026</em>. AI scribes turn a doctor's visit into a note and stop there — Carryover makes sure the note is right, complete and followed through: every sentence cites the transcript lines it came from, confidence is scored in code instead of taken on the model's word, a separate audit pass flags omissions, and the signed note becomes an office task list plus a plain-language patient summary in English or Spanish. Built with my team in one weekend on ElevenLabs Scribe v2 Medical, Gemini, Next.js and Postgres. <a href="https://github.com/dakhp43/OnePiece" target="_blank" rel="noopener">Repo →</a>`,
      chips: ['Show me projects', 'How do you work?', 'How do I reach you?'],
    },
    {
      id: 'projects',
      kw: [['projects', 3], ['project', 2], ['portfolio', 2], ['work', 2], ['built', 2], ['build', 1], ['shipped', 2], ['made', 1], ['what have you', 3]],
      reply: () =>
        `A few that matter:<br>
         • <em>HeadsUp</em> — my SWE internship; cross-platform React Native app + Firebase backend + leaderboard system<br>
         • <em>Carryover</em> — won Best Use of ElevenLabs at hackUMBC 2026; makes AI medical notes traceable and complete<br>
         • <em>OptionsLab</em> — from-scratch options pricing engine in Python (BSM, binomial, Monte Carlo, live IV smile)<br>
         • <em>Prism</em> — privacy-first local LLM hub with hybrid RAG, citations and retrieval evals<br>
         • <em>Campusly</em> — campus social network, live at <a href="https://campusly.us" target="_blank" rel="noopener">campusly.us</a> with 100+ users<br>
         • <em>MoodMap</em> — OpenCV drowsiness detector using Eye Aspect Ratio<br>
         Ask me about any of them.`,
      chips: ['Tell me about Carryover', 'Tell me about Prism', 'Tell me about OptionsLab'],
    },
    {
      id: 'campusly',
      kw: [['campusly', 5], ['social network', 2], ['100 users', 2], ['rls', 2], ['supabase', 1], ['.edu', 2]],
      reply: () =>
        `<em>Campusly</em> — live in production at <a href="https://campusly.us" target="_blank" rel="noopener">campusly.us</a> with 100+ active users. Next.js + Supabase + PostgreSQL. I built .edu email OTP auth, a posts/comments/DMs schema, Row-Level Security so data stays isolated per user and campus, and a glassmorphism UI powered by Supabase Realtime.`,
      chips: ['Other projects', 'What\'s your stack?', 'How do I reach you?'],
    },
    {
      id: 'moodmap',
      kw: [['moodmap', 5], ['mood map', 5], ['drowsi', 3], ['fatigue', 3], ['ear', 2], ['blink', 3], ['eye aspect', 4]],
      reply: () =>
        `<em>MoodMap</em> — webcam drowsiness detector using Eye Aspect Ratio and blink frequency. Calibrates a baseline per user, then triggers audio-visual alerts when alertness dips. Python + OpenCV + a small JS frontend. <a href="https://github.com/Saumya-patel-31/Moodmap" target="_blank" rel="noopener">Repo →</a>`,
      chips: ['Tell me about Prism', 'Tell me about OptionsLab', 'What\'s your stack?'],
    },
    {
      id: 'optionslab',
      kw: [['optionslab', 5], ['options lab', 5], ['optionlab', 5], ['options pricing', 5], ['black scholes', 5], ['black-scholes', 5], ['quant', 4], ['finance', 3], ['greeks', 4], ['monte carlo', 4], ['binomial', 4], ['volatility', 4], ['trading', 3], ['streamlit', 4]],
      reply: () =>
        `<em>OptionsLab</em> — a from-scratch options pricing engine in <em>Python</em>. Three independent pricers (Black-Scholes-Merton closed-form, a binomial CRR tree, Monte Carlo GBM with antithetic variates) cross-validated for convergence, all five Greeks derived analytically, multi-leg strategy P&amp;L, and a live implied-vol smile solved per strike with Brent's method on real options-chain data. Streamlit dashboard + pytest suite. <a href="https://github.com/Saumya-patel-31/Optionslab" target="_blank" rel="noopener">Repo →</a>`,
      chips: ['Tell me about Prism', 'What\'s your stack?', 'How do I reach you?'],
    },
    {
      id: 'prism',
      kw: [['prism', 5], ['local llm', 5], ['local model', 5], ['llm', 4], ['ollama', 5], ['rag', 5], ['retrieval', 4], ['embeddings', 4], ['bm25', 5], ['terraform', 4], ['privacy', 3], ['self-hosted', 4], ['self hosted', 4], ['language model', 4]],
      reply: () =>
        `<em>Prism</em> — a privacy-first hub for chatting with local LLMs over your own documents, zero cloud calls. Hybrid RAG (dense embeddings + BM25, fused with Reciprocal Rank Fusion, de-duplicated with MMR) with inline citations, a self-generating eval suite that reports Hit@K / MRR / latency, smart routing to the best local model, and hardened auth. The demo is Terraform-deployed to S3 + CloudFront via GitHub Actions OIDC — <a href="https://d1eau8jaupf0cp.cloudfront.net" target="_blank" rel="noopener">try it</a> or <a href="https://github.com/Saumya-patel-31/Prism" target="_blank" rel="noopener">read the code →</a>`,
      chips: ['Tell me about OptionsLab', 'Travel goals?', 'How do I reach you?'],
    },
    {
      id: 'peertutor',
      kw: [['peer tutor', 5], ['peer education', 4], ['cmsc', 5], ['cmsc 201', 5], ['cmsc 202', 5], ['cmsc 203', 5], ['teaching', 4], ['teach', 3], ['tutoring', 3], ['mentor', 3], ['tutor', 2], ['currently', 2], ['current role', 4], ['current job', 4], ['doing now', 3]],
      reply: () =>
        `<em>Peer Tutor at UMBC</em> (Aug 2026 → now) — my current role. Selected on faculty recommendation to tutor all three intro CS sequences: <em>CMSC 201</em> (Python), <em>CMSC 202</em> (C++/OOP) and <em>CMSC 203</em> (Discrete Structures). In walk-in sessions I coach debugging, data structures, memory management and proof techniques — and push students to read their own compiler errors so they leave able to debug without me.`,
      chips: ['What have you built?', 'What\'s your stack?', 'How do I reach you?'],
    },
    {
      id: 'tutormatch',
      kw: [['tutormatch', 5], ['tutor match', 5], ['ambassador', 3], ['referral', 2]],
      reply: () =>
        `<em>TutorMatch Student Ambassador</em> (Feb–Sep 2026). Ran multi-platform referral campaigns across UMBC Snapchat communities, Instagram, TikTok and Discord, owning the outreach-to-onboarding funnel with Stripe-integrated commission tracking.`,
      chips: ['What have you built?', 'How do I reach you?'],
    },
    {
      id: 'forage',
      kw: [['forage', 4], ['bcg', 3], ['accenture', 3], ['kpmg', 3], ['consulting', 2], ['virtual internship', 3]],
      reply: () =>
        `Three Forage virtual internships — <em>BCG X</em>, <em>Accenture</em>, <em>KPMG</em>. Data science, analytics & consulting: hypotheses, EDA, feature engineering, a supervised model, then client-facing presentations in each firm's voice. Pandas, NumPy, scikit-learn, Tableau.`,
      chips: ['What have you built?', 'What\'s your stack?'],
    },
    {
      id: 'stack',
      kw: [['stack', 4], ['skills', 3], ['tech', 2], ['technolog', 3], ['tools', 2], ['languages', 2], ['frameworks', 3], ['what do you use', 4], ['what do you know', 3]],
      reply: () =>
        `Main language: <em>Python</em> — OpenCV, YOLOv8, Flask, Pandas / NumPy / scikit-learn. I also ship in <em>TypeScript</em> (<em>Next.js</em>, <em>React Native</em>, Tailwind) on <em>Supabase</em> / <em>Firebase</em> / <em>PostgreSQL</em>, plus <em>C / C++</em> and the ElevenLabs & Gemini APIs — and the boring-but-essential side: auth flows, security rules, tests, deploy pipelines.`,
      chips: ['Show me projects', 'Tell me about Campusly', 'How do I reach you?'],
    },
    {
      id: 'contact',
      kw: [['contact', 4], ['reach', 3], ['email', 4], ['mail', 2], ['hire', 4], ['hiring', 4], ['recruit', 4], ['get in touch', 4], ['talk', 2], ['connect', 3], ['phone', 3], ['call', 2]],
      reply: () =>
        `Easiest: <a href="mailto:${EMAIL}">${EMAIL}</a>.<br>
         Phone: <a href="tel:+14102401699">${PHONE}</a><br>
         Also on <a href="https://linkedin.com/in/saumya31" target="_blank" rel="noopener">LinkedIn</a> and <a href="https://github.com/Saumya-patel-31" target="_blank" rel="noopener">GitHub</a>.<br>
         I'm open to <em>internships & co-ops</em> on the East Coast or remote.`,
      chips: ['What have you built?', 'Where are you based?', 'When do you graduate?'],
    },
    {
      id: 'resume',
      kw: [['resume', 4], ['cv', 4], ['linkedin', 4]],
      reply: () =>
        `My LinkedIn doubles as the up-to-date version: <a href="https://linkedin.com/in/saumya31" target="_blank" rel="noopener">linkedin.com/in/saumya31</a>. If you'd like the PDF resume, email <a href="mailto:${EMAIL}">${EMAIL}</a> and I'll send it within the day.`,
      chips: ['How do I reach you?', 'Show me projects'],
    },
    {
      id: 'github',
      kw: [['github', 5], ['code', 1], ['repo', 3], ['source', 2]],
      reply: () =>
        `GitHub: <a href="https://github.com/Saumya-patel-31" target="_blank" rel="noopener">github.com/Saumya-patel-31</a>. Most fun to skim: <a href="https://github.com/Saumya-patel-31/Prism" target="_blank" rel="noopener">Prism</a>, <a href="https://github.com/Saumya-patel-31/Optionslab" target="_blank" rel="noopener">OptionsLab</a> and <a href="https://github.com/dakhp43/OnePiece" target="_blank" rel="noopener">Carryover</a> (our hackUMBC winner).`,
      chips: ['Tell me about Prism', 'Tell me about OptionsLab'],
    },
    {
      id: 'location',
      kw: [['where', 2], ['based', 3], ['location', 3], ['live', 2], ['from', 1], ['city', 2], ['maryland', 3], ['hanover', 4], ['remote', 2], ['relocate', 3]],
      reply: () =>
        `Hanover, Maryland. Open to roles anywhere on the <em>East Coast</em> and to <em>remote</em>. English & Hindi fluent, Gujarati native.`,
      chips: ['How do I reach you?', 'When do you graduate?'],
    },
    {
      id: 'school',
      kw: [['umbc', 4], ['school', 2], ['college', 2], ['university', 3], ['gpa', 4], ['president', 3], ['academic', 2], ['student', 2], ['major', 2], ['degree', 2]],
      reply: () =>
        `B.S. Computer Science at <em>UMBC</em>. Junior year, GPA 3.8, on the President's List. Graduating December 2027.`,
      chips: ['When do you graduate?', 'Show me projects'],
    },
    {
      id: 'graduate',
      kw: [['graduate', 4], ['graduation', 4], ['when do you finish', 4], ['available', 3], ['start date', 3], ['when can you', 3], ['2027', 3]],
      reply: () =>
        `Graduating <em>December 2027</em>. Available for internships and co-ops before then — summer or part-time during the semester.`,
      chips: ['How do I reach you?', 'Where are you based?'],
    },
    {
      id: 'process',
      kw: [['process', 3], ['how do you work', 4], ['how do you build', 4], ['approach', 3], ['workflow', 3], ['methodology', 3]],
      reply: () =>
        `Same loop every build: <em>(1) Define</em> — the problem in one sentence plus the metric that proves it's solved. <em>(2) Prototype</em> — riskiest slice first, real data, zero polish. <em>(3) Harden</em> — auth, access rules, edge states, tests, fallbacks. <em>(4) Ship &amp; listen</em> — production is the real spec. That's how Carryover went from blank repo to a prize-winning demo in one weekend. <a href="#process">Watch it run as code →</a>`,
      chips: ['Show me projects', 'What\'s your stack?'],
    },
    {
      id: 'taste',
      kw: [['taste', 4], ['design', 2], ['ui', 2], ['ux', 2], ['aesthetic', 3], ['glassmorphism', 4], ['animation', 2], ['microinteraction', 3]],
      reply: () =>
        `I care about the twenty milliseconds between a click and a response, the weight of a single word in a button, and whether an empty state looks lived-in or abandoned. Glassmorphism UI, microinteractions, editorial typography, motion with a purpose.`,
      chips: ['Tell me about Campusly', 'Show me projects'],
    },
    {
      id: 'languages',
      kw: [['spoken languages', 5], ['speak', 3], ['hindi', 4], ['gujarati', 4], ['english', 2]],
      reply: () =>
        `Spoken: <em>English</em> & <em>Hindi</em> fluent, <em>Gujarati</em> native. Programming: see the stack question.`,
      chips: ['What\'s your stack?', 'Where are you based?'],
    },

    /* ---------- personal layer ---------- */
    {
      id: 'gaming',
      kw: [['gaming', 5], ['gamer', 4], ['game', 2], ['games', 2], ['minecraft', 5], ['cod', 4], ['call of duty', 5], ['warzone', 4], ['fps', 3], ['play with', 3], ['xbox', 3], ['ps5', 3], ['steam', 2]],
      reply: () =>
        `Big yes. <em>Minecraft</em> and <em>Call of Duty</em> are the regulars — if you play either, hit me up and we'll queue. Games are half the reason I build for fun in the first place.`,
      chips: ['Favorite anime?', 'What do you do for fun?', 'How do I reach you?'],
    },
    {
      id: 'anime',
      kw: [['anime', 5], ['one piece', 5], ['onepiece', 5], ['luffy', 5], ['sanji', 5], ['zoro', 3], ['manga', 4], ['weeb', 3], ['otaku', 3], ['shounen', 3]],
      reply: () =>
        `<em>One Piece</em>, obviously. I started as a hardcore Luffy guy — pure "I'll figure it out" energy — but lately I'm drifting more into <em>Sanji</em> territory. Loyalty, discipline, cooks for the crew, fights with style. I see it.`,
      chips: ['Favorite movie?', 'Are you a gamer?', 'What do you do for fun?'],
    },
    {
      id: 'food',
      kw: [['food', 4], ['eat', 2], ['favorite food', 5], ['fav food', 5], ['manchurian', 5], ['mexican', 4], ['cuisine', 3], ['hungry', 2], ['restaurant', 2], ['indo chinese', 4], ['burrito', 3], ['tacos', 3]],
      reply: () =>
        `<em>Manchurian</em> is the all-time pick — Indo-Chinese will always win. But put a Mexican spot in front of me and it's also game over. Tacos, burritos, the works.`,
      chips: ['Chai or coffee?', 'What do you do for fun?', 'Favorite anime?'],
    },
    {
      id: 'chai',
      kw: [['chai', 5], ['tea', 4], ['coffee', 3], ['caffeine', 2], ['drink', 1]],
      reply: () =>
        `<em>Chai</em>, every time. Coffee is fine, chai is home. The footer on this site isn't joking — there's a lot of it behind every shipped feature.`,
      chips: ['Favorite food?', 'Travel goals?', 'What do you do for fun?'],
    },
    {
      id: 'movies',
      kw: [['movie', 4], ['movies', 4], ['film', 3], ['favorite movie', 5], ['fav movie', 5], ['bollywood', 4], ['yeh jawani', 5], ['jawani', 4], ['diwani', 4], ['yjhd', 5], ['ranbir', 3]],
      reply: () =>
        `<em>Yeh Jawani Hai Diwani</em>. Bunny chasing the world while everyone else is settling — comfort movie, north-star movie, the whole thing. I rewatch it more than I'll admit.`,
      chips: ['Favorite anime?', 'Travel goals?', 'Dream job?'],
    },
    {
      id: 'workout',
      kw: [['workout', 5], ['gym', 5], ['fitness', 4], ['exercise', 3], ['lift', 3], ['training', 2], ['fit', 2]],
      reply: () =>
        `Daily non-negotiable. Gym if I can get there, home workout if I can't — doesn't matter where, just that it happens. Keeps the rest of life honest.`,
      chips: ['Favorite food?', 'Swimming?', 'What do you do for fun?'],
    },
    {
      id: 'swimming',
      kw: [['swim', 4], ['swimming', 5], ['pool', 3]],
      reply: () =>
        `Love swimming — though I'm honest, I haven't been in the pool as much lately. Want to fix that.`,
      chips: ['Do you workout?', 'What do you do for fun?'],
    },
    {
      id: 'travel',
      kw: [['travel', 4], ['traveling', 4], ['travelling', 4], ['trip', 2], ['world', 2], ['country', 2], ['countries', 2], ['nomad', 4], ['digital nomad', 5], ['where do you want to go', 4]],
      reply: () =>
        `Big plan: travel the world with my <em>local LLMs</em> running on the laptop the whole way — no cloud needed, which is the whole idea behind <em>Prism</em>. Remote work, slow pace, real places. Tech should fit in a backpack.`,
      chips: ['Dream job?', 'Where are you based?', 'How do I reach you?'],
    },
    {
      id: 'dream',
      kw: [['dream', 3], ['dream job', 5], ['dream role', 5], ['dream company', 5], ['ideal job', 4], ['ideal role', 4], ['goals', 2], ['ambition', 3], ['future', 2], ['five years', 3], ['10 years', 3], ['fun tech', 5], ['remote', 3], ['work life', 3]],
      reply: () =>
        `Not really a dream <em>company</em> — a dream <em>scenario</em>. Travelling the world while working remote, going at my own pace, building things that feel like <em>fun tech</em> instead of <em>tech for survival</em>. If a role gets me closer to that, we should talk.`,
      chips: ['How do I reach you?', 'Travel goals?', 'Show me projects'],
    },
    {
      id: 'fun',
      kw: [['fun', 3], ['hobby', 4], ['hobbies', 4], ['free time', 5], ['weekend', 3], ['what do you do', 3], ['for fun', 4], ['outside work', 4], ['outside code', 4]],
      reply: () =>
        `Two things, mostly: <em>building stuff</em> and <em>playing games</em>. Add gym, chai, anime, and a long walk to think — that's the whole loop.`,
      chips: ['Are you a gamer?', 'Favorite anime?', 'Chai or coffee?'],
    },
    {
      id: 'zodiac',
      kw: [['zodiac', 5], ['star sign', 5], ['sun sign', 4], ['horoscope', 4], ['aquarius', 5], ['astrology', 4]],
      reply: () =>
        `<em>Aquarius</em>. Make of that what you will.`,
      chips: ['How tall are you?', 'What do you do for fun?'],
    },
    {
      id: 'height',
      kw: [['height', 4], ['how tall', 5], ['tall', 3], ['5 10', 3], ['short', 2]],
      reply: () =>
        `<em>5'10"</em>.`,
      chips: ['Zodiac sign?', 'Where are you based?'],
    },

    {
      id: 'thanks',
      kw: [['thanks', 3], ['thank you', 4], ['thx', 2], ['ty', 2], ['appreciate', 2]],
      reply: () =>
        `Anytime — if you want to keep the thread going, just email <a href="mailto:${EMAIL}">${EMAIL}</a>.`,
      chips: ['How do I reach you?', 'Show me projects'],
    },
    {
      id: 'bye',
      kw: [['bye', 3], ['goodbye', 3], ['cya', 2], ['see ya', 2], ['later', 1]],
      reply: () => `Catch you later. The orange button stays — come back if anything else comes to mind.`,
      chips: [],
    },
  ];

  const FALLBACK = {
    text: `I don't have a great answer for that one — I'm a small bot trained on this page. Try one of the suggestions, or email Saumya directly at <a href="mailto:${EMAIL}">${EMAIL}</a>.`,
    chips: ['Show me projects', 'What\'s your stack?', 'How do I reach you?'],
  };

  /* ---------- intent matcher ---------- */
  function pick(text) {
    const t = ' ' + text.toLowerCase().replace(/[^a-z0-9 .@]/g, ' ').replace(/\s+/g, ' ') + ' ';
    let best = null;
    let bestScore = 0;
    for (const intent of intents) {
      let score = 0;
      for (const [kw, weight] of intent.kw) {
        if (t.includes(' ' + kw + ' ') || t.includes(kw)) {
          // exact word boundary matches score full; partial substring slightly less
          const boundary = new RegExp(`(^|[^a-z0-9])${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}([^a-z0-9]|$)`, 'i').test(t);
          score += boundary ? weight : weight * 0.5;
        }
      }
      if (score > bestScore) { bestScore = score; best = intent; }
    }
    if (!best || bestScore < 1) return null;
    return best;
  }

  /* ---------- rendering ---------- */
  function addMsg(html, who) {
    const li = document.createElement('li');
    li.className = 'chat-msg chat-msg--' + who;
    li.innerHTML = html;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }

  function showTyping() {
    const li = document.createElement('li');
    li.className = 'chat-msg chat-msg--bot';
    li.innerHTML = `<span class="chat-typing"><span></span><span></span><span></span></span>`;
    log.appendChild(li);
    log.scrollTop = log.scrollHeight;
    return li;
  }

  function setChips(arr) {
    chipsRow.innerHTML = '';
    (arr || []).forEach(label => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'chat-chip';
      b.dataset.cursor = 'btn';
      b.textContent = label;
      b.addEventListener('click', () => handle(label));
      chipsRow.appendChild(b);
    });
  }

  function reply(intent) {
    const typing = showTyping();
    const delay = 380 + Math.random() * 280;
    setTimeout(() => {
      typing.remove();
      if (intent) {
        addMsg(intent.reply(), 'bot');
        setChips(intent.chips);
      } else {
        addMsg(FALLBACK.text, 'bot');
        setChips(FALLBACK.chips);
      }
    }, delay);
  }

  function handle(text) {
    const trimmed = (text || '').trim();
    if (!trimmed) return;
    addMsg(escapeHtml(trimmed), 'user');
    input.value = '';
    reply(pick(trimmed));
  }

  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  /* ---------- open / close ---------- */
  let opened = false;
  function open() {
    if (opened) return;
    opened = true;
    panel.hidden = false;
    requestAnimationFrame(() => root.classList.add('is-open'));
    launcher.setAttribute('aria-expanded', 'true');
    if (!log.children.length) {
      // seed greeting on first open
      addMsg(`Hey — I'm Saumya's auto-reply bot. I know this page (and a fair bit beyond it) inside out. Ask me anything, or pick a starter below.`, 'bot');
      setChips(['What have you built?', 'Current role?', 'Hackathon project?', 'Are you a gamer?', 'How do I reach you?']);
    }
    setTimeout(() => input.focus(), 280);
  }
  function close() {
    if (!opened) return;
    opened = false;
    root.classList.remove('is-open');
    launcher.setAttribute('aria-expanded', 'false');
    setTimeout(() => { panel.hidden = true; }, 320);
  }

  launcher.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && opened) close();
  });
  form.addEventListener('submit', e => {
    e.preventDefault();
    handle(input.value);
  });
})();
