/**
 * First Click — page interactions
 * Navigation, scroll reveals, counters, review expanders, mobile sticky CTA.
 */

(function () {
  /* WhatsApp number for every "Get My Website" button (country code + number,
     digits only, e.g. '919876543210'). While empty, buttons scroll to #contact. */
  const WHATSAPP_NUMBER = '';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const header = document.getElementById('siteHeader');

  /* ---------- CTA links ---------- */
  if (WHATSAPP_NUMBER) {
    document.querySelectorAll('[data-cta]').forEach((link) => {
      const plan = link.dataset.package;
      const message = plan
        ? `Hi First Click, I'm interested in the ${plan} website package.`
        : "Hi First Click, I'd like a professional website for my business.";
      link.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
      link.target = '_blank';
      link.rel = 'noopener';
    });
  }

  /* ---------- Header state ---------- */
  const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 8);
  onScroll();
  window.addEventListener('scroll', onScroll, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = header.querySelector('.nav-toggle');
  const menu = document.getElementById('mobileMenu');

  const setMenu = (open) => {
    header.classList.toggle('is-open', open);
    toggle.setAttribute('aria-expanded', String(open));
    menu.inert = !open;
  };

  setMenu(false);
  toggle.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
  menu.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => setMenu(false)));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && header.classList.contains('is-open')) {
      setMenu(false);
      toggle.focus();
    }
  });
  window.matchMedia('(min-width: 901px)').addEventListener('change', (e) => e.matches && setMenu(false));

  /* ---------- Active nav indicator ---------- */
  const navLinks = [...document.querySelectorAll('.nav-links a')];
  const indicator = document.querySelector('.nav-indicator');
  const sectionFor = new Map(navLinks.map((a) => [document.querySelector(a.getAttribute('href')), a]));

  const moveIndicator = (link) => {
    navLinks.forEach((a) => a.classList.toggle('is-active', a === link));
    if (!link) {
      indicator.style.opacity = '0';
      return;
    }
    indicator.style.width = `${link.offsetWidth - 28}px`;
    indicator.style.transform = `translateX(${link.offsetLeft + 14}px)`;
    indicator.style.opacity = '1';
  };

  if ('IntersectionObserver' in window) {
    const visible = new Set();
    const navObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        });
        const current = [...sectionFor.keys()].find((section) => visible.has(section));
        moveIndicator(current ? sectionFor.get(current) : null);
      },
      { rootMargin: '-45% 0px -50% 0px' }
    );
    sectionFor.forEach((_, section) => section && navObserver.observe(section));
  }

  /* ---------- Scroll reveal (staggered within [data-stagger]) ---------- */
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
      { rootMargin: '0px 0px -8% 0px', threshold: 0.12 }
    );
    revealTargets.forEach((el) => revealObserver.observe(el));
  }

  /* ---------- Number counters ---------- */
  const counters = document.querySelectorAll('[data-count]');
  if (!reduceMotion && 'IntersectionObserver' in window) {
    const countObserver = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target;
          const target = Number(el.dataset.count);
          const start = performance.now();
          const duration = 1100;
          const tick = (now) => {
            const p = Math.min((now - start) / duration, 1);
            el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
            if (p < 1) requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
          observer.unobserve(el);
        });
      },
      { threshold: 0.6 }
    );
    counters.forEach((el) => {
      el.textContent = '0';
      countObserver.observe(el);
    });
  }

  /* ---------- Review "Read more" ---------- */
  document.querySelectorAll('.review-toggle').forEach((btn) => {
    const more = document.getElementById(btn.getAttribute('aria-controls'));
    if (!more) return;
    btn.addEventListener('click', () => {
      const open = btn.getAttribute('aria-expanded') !== 'true';
      more.hidden = !open;
      btn.setAttribute('aria-expanded', String(open));
      btn.textContent = open ? 'Show less' : 'Read more';
    });
  });

  /* ---------- Mobile sticky CTA ---------- */
  const sticky = document.getElementById('stickyCta');
  const heroActions = document.querySelector('.hero-actions');
  const finalCta = document.getElementById('contact');

  if (sticky && heroActions && finalCta && 'IntersectionObserver' in window) {
    let pastHero = false;
    let atFinal = false;
    const update = () => sticky.classList.toggle('is-visible', pastHero && !atFinal);

    new IntersectionObserver(([entry]) => {
      pastHero = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      update();
    }).observe(heroActions);

    new IntersectionObserver(([entry]) => {
      atFinal = entry.isIntersecting || entry.boundingClientRect.top < 0;
      update();
    }).observe(finalCta);
  }

  /* ---------- Footer year ---------- */
  const year = document.querySelector('[data-year]');
  if (year) year.textContent = new Date().getFullYear();
})();
