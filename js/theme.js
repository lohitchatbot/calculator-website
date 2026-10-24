/*
 * Copyright (c) 2026 TrueCalc
 * Licensed under the MIT License
 */

(function () {
  const themeToggle = document.getElementById("themeToggle");
  const savedTheme = localStorage.getItem("calculator-theme");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  function applyTheme(theme) {
    document.body.classList.toggle("dark", theme === "dark");
    if (themeToggle) {
      themeToggle.textContent = theme === "dark" ? "☀️" : "🌙";
    }
  }
  const initialTheme = savedTheme || (prefersDark ? "dark" : "light");
  applyTheme(initialTheme);
  if (themeToggle) {
    themeToggle.addEventListener("click", () => {
      const nextTheme = document.body.classList.contains("dark") ? "light" : "dark";
      localStorage.setItem("calculator-theme", nextTheme);
      applyTheme(nextTheme);
    });
  }
})();