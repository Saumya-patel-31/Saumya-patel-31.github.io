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
  const PARALLAX  = 64;   // px of vertical drift across a section (± half this)

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
         One-off filter on the whole stack, then cleared — no per-frame
         cost, so it doesn't reintroduce scroll jank.
  ---------------------------------------------------------- */
  const bgStack = $('#bgStack');
  window.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() === 'g' && bgStack) {
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
        `CS junior at UMBC (graduating Dec 2027), GPA 3.8, on the President's List. I build full-stack products end-to-end — <em>Campusly</em> is live with 100+ users. I learn faster by shipping than studying, so I ship.`,
      chips: ['Show me projects', 'School / GPA', 'Where are you based?'],
    },
    {
      id: 'projects',
      kw: [['projects', 3], ['project', 2], ['portfolio', 2], ['work', 2], ['built', 2], ['build', 1], ['shipped', 2], ['made', 1], ['what have you', 3]],
      reply: () =>
        `A few that matter:<br>
         • <em>Campusly</em> — campus social network, live at <a href="https://campusly.us" target="_blank" rel="noopener">campusly.us</a> with 100+ users<br>
         • <em>MoodMap</em> — OpenCV drowsiness detector using Eye Aspect Ratio<br>
         • <em>Visionary</em> — YOLOv8 spatial narrator for the visually impaired<br>
         • <em>IoT Soil Classifier</em> — Arduino sensor rig with crop recommendations<br>
         Ask me about any of them.`,
      chips: ['Tell me about Campusly', 'Tell me about MoodMap', 'Tell me about Visionary'],
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
      chips: ['Tell me about Visionary', 'Tell me about Campusly', 'What\'s your stack?'],
    },
    {
      id: 'visionary',
      kw: [['visionary', 5], ['yolo', 3], ['visually impaired', 4], ['accessibility', 3], ['blind', 3], ['spatial', 2], ['object detection', 3]],
      reply: () =>
        `<em>Visionary</em> — turns a webcam into a spatial narrator for the visually impaired. YOLOv8 Nano detects objects in frame, pyttsx3 speaks them with directional context (left/right/centre) at 320px so the pipeline stays smooth on CPU. Flask + OpenCV backend, Tailwind + TypeScript frontend. <a href="https://github.com/Saumya-patel-31/Visionary" target="_blank" rel="noopener">Repo →</a>`,
      chips: ['Tell me about MoodMap', 'Tell me about Campusly', 'See all projects'],
    },
    {
      id: 'iot',
      kw: [['iot', 4], ['arduino', 4], ['soil', 4], ['hardware', 3], ['sensor', 2], ['agriculture', 3]],
      reply: () =>
        `<em>IoT Agricultural Soil Classifier</em> (2023) — Arduino sensor rig logging moisture, pH and nutrients to SQL, then recommending crop types from soil conditions. My first dance with hardware, C++, and bugs that live in the physical world.`,
      chips: ['Other projects', 'What\'s your stack?'],
    },
    {
      id: 'tutormatch',
      kw: [['tutormatch', 5], ['tutor match', 5], ['ambassador', 3], ['referral', 2]],
      reply: () =>
        `<em>TutorMatch Student Ambassador</em> (Feb 2026 → now). Running multi-platform referral campaigns across UMBC Snapchat communities, Instagram, TikTok and Discord, owning the outreach-to-onboarding funnel with Stripe-integrated commission tracking.`,
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
        `Day-to-day: <em>Next.js</em>, <em>Supabase</em>, <em>PostgreSQL</em>, <em>Python</em> & <em>OpenCV</em>, <em>C / C++</em>. Plus TypeScript, Tailwind, Flask, YOLOv8, Arduino, Pandas / NumPy / scikit-learn, and the boring-but-essential side: auth flows, RLS policies, deploy pipelines.`,
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
        `GitHub: <a href="https://github.com/Saumya-patel-31" target="_blank" rel="noopener">github.com/Saumya-patel-31</a>. The Visionary and MoodMap repos are the most fun to skim.`,
      chips: ['Tell me about MoodMap', 'Tell me about Visionary'],
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
      kw: [['process', 3], ['how do you work', 4], ['approach', 3], ['workflow', 3], ['methodology', 3]],
      reply: () =>
        `Four steps: <em>(1)</em> write the problem in one sentence, <em>(2)</em> ugly clickable prototype by tomorrow, <em>(3)</em> lock down auth / RLS / empty states / loading states, <em>(4)</em> ship to production and listen to real users. Localhost answers your questions; production answers theirs.`,
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
        `Big plan: travel the world with my <em>local LLMs</em> running on the laptop the whole way. Remote work, slow pace, real places. Tech should fit in a backpack.`,
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
      setChips(['What have you built?', 'What\'s your stack?', 'Dream job?', 'Are you a gamer?', 'How do I reach you?']);
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
