/*
 * Copyright (c) 2026 TrueCalc
 * Licensed under the MIT License
 */

(function (global) {
  "use strict";

  const config = global.EASYCALC_SUPABASE_CONFIG || {};
  const preferenceKey = "easycalc-analytics-consent";
  const visitorKey = "easycalc-analytics-visitor";
  const sessionKey = "easycalc-analytics-session";
  const consentPanel = document.getElementById("analyticsConsent");
  const status = document.getElementById("analyticsConsentStatus");
  let heartbeatId;
  let warningShown = false;
  let consentOverride;

  function configured() {
    return Boolean(config.url && config.publishableKey);
  }

  function consentValue() {
    if (consentOverride !== undefined) return consentOverride;
    try {
      return global.localStorage.getItem(preferenceKey);
    } catch {
      return null;
    }
  }

  function uuid(storage, key) {
    let value = storage.getItem(key);
    if (!value) {
      if (!global.crypto || typeof global.crypto.randomUUID !== "function") {
        throw new Error("Secure random identifiers are unavailable in this browser.");
      }
      value = global.crypto.randomUUID();
      storage.setItem(key, value);
    }
    return value;
  }

  async function send(action, keepalive) {
    if (!configured()) return;
    if (action !== "forget" && consentValue() !== "granted") return;
    let visitorId;
    let sessionId;
    try {
      visitorId = uuid(global.localStorage, visitorKey);
      sessionId = uuid(global.sessionStorage, sessionKey);
    } catch (error) {
      if (!warningShown) {
        warningShown = true;
        console.warn("TrueCalc analytics is disabled because browser storage is unavailable.", error);
      }
      return;
    }

    try {
      const response = await global.fetch(
        config.collectorUrl ||
          `${config.url.replace(/\/+$/, "")}/functions/v1/collect-analytics`,
        {
          method: "POST",
          headers: {
            apikey: config.publishableKey,
            "content-type": "application/json",
          },
          body: JSON.stringify({
            visitor_id: visitorId,
            session_id: sessionId,
            action,
          }),
          keepalive: Boolean(keepalive),
        },
      );
      if (!response.ok && !warningShown) {
        warningShown = true;
        console.warn(`TrueCalc analytics event was not accepted (HTTP ${response.status}).`);
      }
    } catch (error) {
      if (!warningShown) {
        warningShown = true;
        console.warn("TrueCalc analytics could not reach its collection endpoint.", error);
      }
    }
  }

  function stopTracking() {
    if (heartbeatId) {
      global.clearInterval(heartbeatId);
      heartbeatId = undefined;
    }
  }

  function startTracking() {
    if (!configured() || consentValue() !== "granted" || heartbeatId) return;
    void send("start");
    heartbeatId = global.setInterval(() => void send("ping"), 30_000);
  }

  function showConsent() {
    if (!consentPanel) return;
    consentPanel.hidden = false;
    if (status) {
      status.textContent = configured()
        ? "Allow consent to count anonymous visits; your calculator inputs and results are never collected."
        : "Analytics is not configured yet. No visitor analytics will be collected.";
    }
  }

  function setConsent(value) {
    const previousConsent = consentValue();
    consentOverride = value;
    try {
      global.localStorage.setItem(preferenceKey, value);
    } catch (error) {
      console.error("Could not save the analytics preference.", error);
      if (status) status.textContent = "Your preference could not be saved. Analytics will stay off for this visit.";
      stopTracking();
      return;
    }
    if (consentPanel) consentPanel.hidden = true;
    if (value === "granted") startTracking();
    else {
      stopTracking();
      const removeIdentifiers = () => {
        try {
          global.localStorage.removeItem(visitorKey);
          global.sessionStorage.removeItem(sessionKey);
        } catch (error) {
          console.warn("TrueCalc could not clear stored analytics identifiers.", error);
        }
      };
      if (previousConsent === "granted" && global.localStorage.getItem(visitorKey)) {
        void send("forget").finally(removeIdentifiers);
      } else removeIdentifiers();
    }
  }

  const acceptButton = document.getElementById("analyticsAccept");
  if (acceptButton) acceptButton.addEventListener("click", () => setConsent("granted"));
  const rejectButton = document.getElementById("analyticsReject");
  if (rejectButton) rejectButton.addEventListener("click", () => setConsent("denied"));

  global.addEventListener("pagehide", () => {
    if (consentValue() === "granted") {
      void send("end", true);
    }
  });

  const savedConsent = consentValue();
  if (savedConsent === "granted") startTracking();
  else if (configured() && savedConsent === null) {
    global.setTimeout(() => {
      if (consentValue() === null) showConsent();
    }, 10_000);
  }

})(window);
