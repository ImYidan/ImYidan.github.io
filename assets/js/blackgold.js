(() => {
  'use strict';
  const themeButton = document.querySelector('.theme-toggle');
  const applyTheme = theme => {
    const light = theme === 'light';
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    if (themeButton) {
      themeButton.setAttribute('aria-pressed', String(light));
      const label = light ? '切换到深色模式' : '切换到浅色模式';
      themeButton.setAttribute('aria-label', label);
      themeButton.title = label;
    }
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f4f0e6' : '#090a09');
  };
  applyTheme(document.documentElement.dataset.theme);
  if (themeButton) {
    themeButton.addEventListener('click', () => {
      const theme = document.documentElement.dataset.theme === 'light' ? 'dark' : 'light';
      applyTheme(theme);
      try { localStorage.setItem('yidan-theme', theme); } catch (error) { /* The toggle still works without storage. */ }
    });
    themeButton.hidden = false;
  }
  window.addEventListener('storage', event => {
    if (event.key === 'yidan-theme' || event.key === null) applyTheme(event.newValue === 'light' ? 'light' : 'dark');
  });
  const button = document.querySelector('.menu-toggle');
  const nav = document.querySelector('#navigation');
  const closeMenu = () => {
    if (!button || !nav) return;
    button.setAttribute('aria-expanded', 'false');
    nav.classList.remove('is-open');
  };
  button?.addEventListener('click', () => {
    const open = button.getAttribute('aria-expanded') !== 'true';
    button.setAttribute('aria-expanded', String(open));
    nav.classList.toggle('is-open', open);
  });
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && nav?.classList.contains('is-open')) {
      closeMenu();
      button.focus();
    }
  });
  document.addEventListener('click', event => {
    if (!event.target.closest('.header')) closeMenu();
  });
  window.matchMedia('(min-width: 701px)').addEventListener('change', closeMenu);
  const page = document.body.dataset.page;
  nav?.querySelectorAll('a[data-nav]').forEach(link => {
    if (link.dataset.nav === page) link.setAttribute('aria-current', 'page');
    link.addEventListener('click', closeMenu);
  });
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.08 });
    document.querySelectorAll('.intro-grid, .education-row, .travel-feature, .timeline-item, .about-content, .closing').forEach(element => {
      element.classList.add('reveal');
      observer.observe(element);
    });
    document.documentElement.classList.add('js-ready');
  }
})();
