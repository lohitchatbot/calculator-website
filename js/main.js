/*
 * Copyright (c) 2026 EasyCalc
 * Licensed under the MIT License
 */

// Manages the accessible tab functionality for the calculator modes.
(function () {
  const tablist = document.querySelector('[role="tablist"]');
  const tabs = document.querySelectorAll('[role="tab"]');
  const panels = document.querySelectorAll('[role="tabpanel"]');
  if (!tablist || !tabs.length || !panels.length) {
    return;
  }
  // Function to switch tabs
  const switchTab = (newTab) => {
    // Deactivate all tabs and panels
    tabs.forEach((tab) => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
      tab.setAttribute('tabindex', '-1');
    });
    panels.forEach((panel) => {
      panel.classList.remove('active');
    });
    // Activate the new tab and panel
    newTab.classList.add('active');
    newTab.setAttribute('aria-selected', 'true');
    newTab.setAttribute('tabindex', '0');
    newTab.focus();
    const newPanel = document.getElementById(newTab.getAttribute('aria-controls'));
    if (newPanel) {
      newPanel.classList.add('active');
    }
  };
  // Add click event listener to each tab
  tabs.forEach((tab) => {
    tab.addEventListener('click', (e) => {
      switchTab(e.currentTarget);
    });
  });
  // Add keyboard navigation
  tablist.addEventListener('keydown', (e) => {
    let currentTab = document.activeElement;
    // Ensure the active element is a tab before proceeding
    if (!currentTab.matches('[role="tab"]')) {
      return;
    }
    let newTab;
    const currentIndex = Array.from(tabs).indexOf(currentTab);
    if (e.key === 'ArrowRight') {
      const nextIndex = (currentIndex + 1) % tabs.length;
      newTab = tabs[nextIndex];
    } else if (e.key === 'ArrowLeft') {
      const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
      newTab = tabs[prevIndex];
    }
    if (newTab) {
      e.preventDefault();
      switchTab(newTab);
    }
  });
})();