/* Walters Exterminating: site behaviour. No libraries.
   Day/night switch, sticky header state, mobile menu, scroll reveals. */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };

  /* ---------------------------------------------------------- day / night */

  function currentTheme() {
    var set = root.getAttribute('data-theme');
    if (set) return set;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  $$('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try { localStorage.setItem('walters-theme', next); } catch (e) {}
      btn.setAttribute('aria-label', next === 'dark' ? 'Switch to day mode' : 'Switch to night mode');
    });
  });

  /* ---------------------------------------------------------- header */

  var hdr = $('[data-hdr]');
  if (hdr) {
    var onScroll = function () { hdr.classList.toggle('is-stuck', window.scrollY > 24); };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
  }

  /* ---------------------------------------------------------- mobile menu */

  var menu = $('[data-menu]');
  if (menu) {
    var panel = $('.menu__panel', menu);
    var openBtn = $('[data-menu-open]');
    var lastFocus = null;

    var focusables = function () {
      return $$('a[href], button:not([disabled])', panel).filter(function (el) {
        return el.offsetParent !== null;
      });
    };

    var open = function () {
      lastFocus = document.activeElement;
      menu.hidden = false;
      document.body.style.overflow = 'hidden';
      if (openBtn) openBtn.setAttribute('aria-expanded', 'true');
      var f = focusables();
      if (f.length) f[0].focus();
    };

    var close = function () {
      menu.hidden = true;
      document.body.style.overflow = '';
      if (openBtn) openBtn.setAttribute('aria-expanded', 'false');
      if (lastFocus) lastFocus.focus();
    };

    if (openBtn) openBtn.addEventListener('click', open);
    $$('[data-menu-close]').forEach(function (b) { b.addEventListener('click', close); });
    menu.addEventListener('click', function (ev) { if (ev.target === menu) close(); });
    $$('a', panel).forEach(function (a) { a.addEventListener('click', close); });

    document.addEventListener('keydown', function (ev) {
      if (menu.hidden) return;
      if (ev.key === 'Escape') { close(); return; }
      if (ev.key !== 'Tab') return;
      var f = focusables();
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }


  /* ------------------------------------------------- services drop down */
  /* Hover alone is not enough: it leaves the panel unreachable by keyboard
     and unusable on a touch screen, where there is no hover at all. The caret
     is a real button that toggles it, and CSS handles the pointer case. */
  $$('[data-drop]').forEach(function (wrap) {
    var toggle = wrap.querySelector('[data-drop-toggle]');
    if (!toggle) return;

    function close() {
      wrap.classList.remove('is-open');
      toggle.setAttribute('aria-expanded', 'false');
    }
    function open() {
      wrap.classList.add('is-open');
      toggle.setAttribute('aria-expanded', 'true');
    }

    toggle.addEventListener('click', function (ev) {
      ev.preventDefault();
      wrap.classList.contains('is-open') ? close() : open();
    });

    wrap.addEventListener('keydown', function (ev) {
      if (ev.key === 'Escape' && wrap.classList.contains('is-open')) {
        close();
        toggle.focus();
      }
    });

    document.addEventListener('click', function (ev) {
      if (!wrap.contains(ev.target)) close();
    });

    // leaving the whole group with the keyboard closes it too
    wrap.addEventListener('focusout', function (ev) {
      if (!wrap.contains(ev.relatedTarget)) close();
    });
  });

  /* ---------------------------------------------------------- reveals */

  var targets = $$('[data-reveal]');
  if (!targets.length) return;

  if (!('IntersectionObserver' in window)) {
    targets.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-in');
      io.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });

  targets.forEach(function (el) { io.observe(el); });
})();
