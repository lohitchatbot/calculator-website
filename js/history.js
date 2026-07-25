(function () {
  const historyListEl = document.getElementById("historyList");
  const clearHistoryBtn = document.getElementById("clearHistory");
  const maxEntries = 8;
  let entries = [];

  function createElement(tag, props = {}, children = []) {
    const el = document.createElement(tag);
    Object.entries(props).forEach(([key, value]) => el.setAttribute(key, value));
    children.forEach(child => {
      if (typeof child === 'string') {
        el.appendChild(document.createTextNode(child));
      } else {
        el.appendChild(child);
      }
    });
    return el;
  }

  function renderHistory() {
    if (!historyListEl) {
      return;
    }

    // Clear existing content safely
    while (historyListEl.firstChild) {
      historyListEl.removeChild(historyListEl.firstChild);
    }

    if (!entries.length) {
      const emptyItem = createElement('li', { 'class': 'history-item' }, ['No saved calculations yet.']);
      historyListEl.appendChild(emptyItem);
      return;
    }

    entries.forEach(entry => {
      const strong = createElement('strong', {}, [entry.expression]);
      const div = createElement('div', {}, [entry.result]);
      const li = createElement('li', { 
        'class': 'history-item', 
        'data-expression': entry.expression 
      }, [strong, div]);
      
      li.addEventListener("click", () => {
        const expression = entry.expression;
        if (window.calculatorState) {
          window.calculatorState.expression = expression;
          window.calculatorState.result = expression;
          const displayEl = document.getElementById("display");
          if (displayEl) {
            displayEl.textContent = expression;
          }
        }
      });
      
      historyListEl.appendChild(li);
    });
  }

  function addEntry(expression, result) {
    entries = [{ expression, result }, ...entries].slice(0, maxEntries);
    renderHistory();
  }

  function clearHistory() {
    entries = [];
    renderHistory();
  }

  if (clearHistoryBtn) {
    clearHistoryBtn.addEventListener("click", clearHistory);
  }

  window.historyManager = { addEntry, clearHistory };
  window.addEventListener("DOMContentLoaded", renderHistory);
})();