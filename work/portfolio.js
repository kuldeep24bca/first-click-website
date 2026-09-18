/**
 * Portfolio — interactive website previews, category filters, navigation.
 *
 * Previews: each browser window holds a full-page screenshot. Hovering (or
 * focusing, or tapping on touch) slides the screenshot up at a constant speed
 * so the visitor sees the whole site. Leaving pauses it where it stands; the
 * next hover resumes from there.
 */

(function () {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = window.matchMedia('(hover: none)').matches;

  /* ---------- Interactive previews ---------- */
  const SPEED = Number(
    getComputedStyle(document.body).getPropertyValue('--scroll-speed').trim() || 150
  );

  const setUpPreview = (frame) => {
    const view = frame.querySelector('.browser-view');
    const shot = frame.querySelector('.browser-shot');
    const hint = frame.querySelector('.preview-hint-text');
    if (!view || !shot) return;

    if (hint && coarsePointer) hint.textContent = 'Tap to Explore';

    let travel = 0;
    const measure = () => {
      travel = Math.max(0, shot.offsetHeight - view.offsetHeight);
    };
    const currentY = () => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(shot).transform);
      return matrix.m42;
    };

    const play = () => {
      if (reduceMotion || !travel) return;
      const from = currentY();
      const target = from <= -travel + 1 ? 0 : -travel;
      const duration = Math.abs(target - from) / SPEED;
      shot.style.transitionDuration = `${duration}s`;
      shot.style.transform = `translate3d(0, ${target}px, 0)`;
      frame.classList.add('is-playing');
    };

    const pause = () => {
      const y = currentY();
      shot.style.transitionDuration = '0s';
      shot.style.transform = `translate3d(0, ${y}px, 0)`;
      void shot.offsetHeight; // commit the frozen position
      frame.classList.remove('is-playing');
    };

    if (shot.complete) measure();
    else shot.addEventListener('load', measure, { once: true });
    window.addEventListener('resize', measure);

    // Pointer and keyboard: hover or focus explores, leaving pauses in place
    frame.addEventListener('mouseenter', () => {
      measure();
      play();
    });
    frame.addEventListener('mouseleave', pause);
    frame.addEventListener('focus', () => {
      measure();
      play();
    });
    frame.addEventListener('blur', pause);

    if (coarsePointer) {
      // Touch: the first tap explores, the second opens the site. A card
      // centred in the viewport also starts on its own.
      frame.addEventListener('click', (event) => {
        if (!frame.classList.contains('is-playing')) {
          event.preventDefault();
          measure();
          play();
        }
      });

      if ('IntersectionObserver' in window) {
        new IntersectionObserver(
          ([entry]) => {
            measure();
            entry.isIntersecting ? play() : pause();
          },
          { threshold: 0.55 }
        ).observe(view);
      }
    }
  };

  document.querySelectorAll('[data-preview]').forEach(setUpPreview);

  /* ---------- Category filters ---------- */
  const grid = document.getElementById('projectGrid');
  const filterBar = document.querySelector('[data-filters]');

  if (grid && filterBar) {
    const projects = [...grid.querySelectorAll('.project')];
    const buttons = [...filterBar.querySelectorAll('.pf-filter')];
    const status = document.querySelector('.pf-filter-status');
    const empty = document.querySelector('.pf-empty');

    // Hide categories that have no projects, and show real counts
    const counts = projects.reduce((acc, project) => {
      const key = project.dataset.category;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    buttons.forEach((button) => {
      const key = button.dataset.filter;
      const count = key === 'all' ? projects.length : counts[key] || 0;
      if (!count) {
        button.remove();
        return;
      }
      let badge = button.querySelector('.pf-filter-count');
      if (!badge) {
        badge = document.createElement('span');
        badge.className = 'pf-filter-count';
        button.append(' ', badge);
      }
      badge.textContent = count;
    });

    const apply = (key) => {
      grid.classList.toggle('is-filtered', key !== 'all');
      let shown = 0;

      projects.forEach((project) => {
        const match = key === 'all' || project.dataset.category === key;
        if (match) shown++;
        if (match && project.hidden) {
          project.hidden = false;
          project.classList.add('is-hiding');
          requestAnimationFrame(() => project.classList.remove('is-hiding'));
        } else if (match) {
          project.classList.remove('is-hiding');
        } else if (!project.hidden) {
          project.classList.add('is-hiding');
          setTimeout(() => {
            if (project.classList.contains('is-hiding')) project.hidden = true;
          }, 220);
        }
      });

      if (empty) empty.hidden = shown > 0;
      if (status) {
        const label = filterBar.querySelector('.is-active')?.firstChild?.textContent?.trim();
        status.textContent = `${shown} project${shown === 1 ? '' : 's'} shown${
          key === 'all' ? '' : ` in ${label}`
        }`;
      }
    };

    filterBar.addEventListener('click', (event) => {
      const button = event.target.closest('.pf-filter');
      if (!button) return;
      filterBar.querySelectorAll('.pf-filter').forEach((other) => {
        const active = other === button;
        other.classList.toggle('is-active', active);
        other.setAttribute('aria-pressed', String(active));
      });
      apply(button.dataset.filter);
    });
  }

  /* ---------- Navigation ---------- */
  const header = document.getElementById('siteHeader');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });

    const toggle = header.querySelector('.nav-toggle');
    const menu = document.getElementById('mobileMenu');

    if (toggle && menu) {
      const setMenu = (open) => {
        header.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', String(open));
        menu.inert = !open;
      };
      setMenu(false);
      toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
      menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape' && header.classList.contains('is-open')) {
          setMenu(false);
          toggle.focus();
        }
      });
      window
        .matchMedia('(min-width: 901px)')
        .addEventListener('change', (event) => event.matches && setMenu(false));
    }

    const navLinks = [...header.querySelectorAll('.nav-links a')];
    const indicator = header.querySelector('.nav-indicator');
    const sections = new Map(
      navLinks.map((a) => [document.querySelector(a.getAttribute('href')), a])
    );

    if (indicator && 'IntersectionObserver' in window) {
      const visible = new Set();
      const observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) =>
            entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)
          );
          const current = [...sections.keys()].find((section) => visible.has(section));
          const link = current ? sections.get(current) : null;
          navLinks.forEach((a) => a.classList.toggle('is-active', a === link));
          if (!link) {
            indicator.style.opacity = '0';
            return;
          }
          indicator.style.width = `${link.offsetWidth - 28}px`;
          indicator.style.transform = `translateX(${link.offsetLeft + 14}px)`;
          indicator.style.opacity = '1';
        },
        { rootMargin: '-45% 0px -50% 0px' }
      );
      sections.forEach((_, section) => section && observer.observe(section));
    }
  }

  /* ---------- Scroll reveals & counters ---------- */
  document.querySelectorAll('[data-stagger]').forEach((group) => {
    [...group.querySelectorAll(':scope > [data-reveal]')].forEach((el, i) => {
      el.style.setProperty('--i', Math.min(i, 8));
    });
  });

  const revealTargets = document.querySelectorAll('[data-reveal]');
  if (reduceMotion || !('IntersectionObserver' in window)) {
    revealTargets.forEach((el) => el.classList.add('is-visible'));
  } else {
    const revealObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.1 }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  const counters = document.querySelectorAll('[data-count]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.dataset.count);
          observer.unobserve(el);
          if (document.hidden) {
            el.textContent = target;
            return;
          }
          const start = performance.now();
          const tick = (now) => {
            const p = Math.min((now - start) / 1100, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => {
      el.textContent = '0';
      countObserver.observe(el);
    });
  }

  /* ---------- Booking calendar ----------
     Calendly only hides its cookie banner when it knows the embedding site. */
  document.querySelectorAll('.booking-frame').forEach((frame) => {
    const url = new URL(frame.src);
    url.searchParams.set('embed_domain', window.location.hostname);
    frame.src = url.href;
  });

  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
