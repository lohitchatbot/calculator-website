/*
 * Copyright (c) 2026 TrueCalc
 * Licensed under the MIT License
 */

(function () {
  const navToggle = document.getElementById('navToggle');
  const topNav = document.getElementById('topNav');
  if (navToggle && topNav) {
    navToggle.addEventListener('click', () => {
      const isExpanded = navToggle.getAttribute('aria-expanded') === 'true';
      navToggle.setAttribute('aria-expanded', !isExpanded);
      topNav.classList.toggle('active');
      document.body.classList.toggle('nav-open');
    });
  }
})();