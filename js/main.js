(function () {
  const tabButtons = document.querySelectorAll('.tab-btn');
  const panels = document.querySelectorAll('.calculator-panel');

  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const target = button.getAttribute('data-target');

      tabButtons.forEach((tab) => tab.classList.remove('active'));
      panels.forEach((panel) => panel.classList.remove('active'));

      button.classList.add('active');
      document.getElementById(`${target}Panel`)?.classList.add('active');
    });
  });
})();
