/*
 * Copyright (c) 2026 TrueCalc
 * Licensed under the MIT License
 */

(function (global) {
  "use strict";

  const config = global.EASYCALC_SUPABASE_CONFIG || {};
  const activeCount = document.getElementById("activeVisitorCount");
  const uniqueCount = document.getElementById("uniqueVisitorCount");
  const status = document.getElementById("visitorCountStatus");
  const endpoint = config.url && `${config.url.replace(/\/+$/, "")}/rest/v1/rpc/get_analytics_counts`;

  if (!activeCount || !uniqueCount || !status || !endpoint || !config.publishableKey) return;

  async function refresh() {
    try {
      const response = await global.fetch(endpoint, {
        method: "POST",
        headers: {
          apikey: config.publishableKey,
          authorization: `Bearer ${config.publishableKey}`,
          "content-type": "application/json",
          "cache-control": "no-store",
        },
        body: "{}",
        cache: "no-store",
      });
      if (!response.ok) {
        throw new Error(`Count request failed with HTTP ${response.status}.`);
      }
      const counts = await response.json();
      if (
        !counts ||
        !Number.isSafeInteger(Number(counts.active_visitors)) ||
        !Number.isSafeInteger(Number(counts.unique_visitors)) ||
        Number(counts.active_visitors) < 0 ||
        Number(counts.unique_visitors) < 0
      ) {
        throw new Error("Count response was invalid.");
      }
      activeCount.textContent = Number(counts.active_visitors).toLocaleString();
      uniqueCount.textContent = Number(counts.unique_visitors).toLocaleString();
      status.textContent = "Live estimate";
    } catch (error) {
      activeCount.textContent = "—";
      uniqueCount.textContent = "—";
      status.textContent = "Counts temporarily unavailable";
      console.warn("TrueCalc visitor counts are temporarily unavailable.", error);
    }
  }

  void refresh();
  global.setInterval(() => {
    if (!document.hidden) void refresh();
  }, 10_000);
})(window);
