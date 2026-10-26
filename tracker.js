/**
 * ClientForge PRO — Advanced Meta Ad & Customer Journey Telemetry Engine
 * Tracks Meta ads (UTM source/medium/campaign/adset/creative), fbclid,
 * page depth, interactions, and checkout clicks to https://mintlink.in/m/clientkitpro
 */

(function () {
    const CHECKOUT_BASE_URL = "https://mintlink.in/m/clientkitpro";
    const STORAGE_KEY_SESSION = "clientforge_session_id";
    const STORAGE_KEY_VISITOR = "clientforge_visitor_id";
    const STORAGE_KEY_LOGS = "clientforge_analytics_events";
    const STORAGE_KEY_ATTR = "clientforge_attribution";
    const BROADCAST_CHANNEL_NAME = "clientforge_analytics_channel";

    // 1. Generate or retrieve persistent IDs
    function getUUID() {
        return 'cf_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now().toString(36);
    }

    let visitorId = localStorage.getItem(STORAGE_KEY_VISITOR);
    if (!visitorId) {
        visitorId = getUUID();
        localStorage.setItem(STORAGE_KEY_VISITOR, visitorId);
    }

    let sessionId = sessionStorage.getItem(STORAGE_KEY_SESSION);
    if (!sessionId) {
        sessionId = getUUID();
        sessionStorage.setItem(STORAGE_KEY_SESSION, sessionId);
    }

    // 2. Parse URL parameters & Attribution
    const urlParams = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "direct";

    // Detect referrer platform if direct or social
    function detectReferrerSource(ref) {
        if (!ref || ref === "direct") return "Direct / Bookmark";
        const lower = ref.toLowerCase();
        if (lower.includes("instagram.com")) return "Instagram (Organic/Ad)";
        if (lower.includes("facebook.com") || lower.includes("fb.me")) return "Facebook (Organic/Ad)";
        if (lower.includes("google.com")) return "Google Search";
        if (lower.includes("twitter.com") || lower.includes("t.co") || lower.includes("x.com")) return "Twitter / X";
        if (lower.includes("linkedin.com") || lower.includes("lnkd.in")) return "LinkedIn";
        if (lower.includes("whatsapp")) return "WhatsApp Chat";
        if (lower.includes("youtube.com")) return "YouTube";
        return ref;
    }

    let attribution = JSON.parse(sessionStorage.getItem(STORAGE_KEY_ATTR) || "null");
    if (!attribution) {
        attribution = {
            utm_source: urlParams.get("utm_source") || (urlParams.get("fbclid") ? "meta_ads" : (referrer.includes("instagram") ? "instagram" : (referrer.includes("facebook") ? "facebook" : "direct"))),
            utm_medium: urlParams.get("utm_medium") || (urlParams.get("fbclid") ? "cpc" : "referral"),
            utm_campaign: urlParams.get("utm_campaign") || (urlParams.get("fbclid") ? "meta_campaign" : "none"),
            utm_content: urlParams.get("utm_content") || "none", // ad creative name
            utm_term: urlParams.get("utm_term") || "none", // ad set name
            adset_id: urlParams.get("adset_id") || urlParams.get("hsa_grp") || "none",
            campaign_id: urlParams.get("campaign_id") || urlParams.get("hsa_cam") || "none",
            ad_id: urlParams.get("ad_id") || urlParams.get("hsa_ad") || "none",
            fbclid: urlParams.get("fbclid") || "none",
            raw_referrer: referrer,
            source_platform: detectReferrerSource(referrer),
            entry_page: window.location.pathname + window.location.search,
            landing_time: new Date().toISOString()
        };
        sessionStorage.setItem(STORAGE_KEY_ATTR, JSON.stringify(attribution));
    }

    // 3. Dynamic CTA Link Enrichment (Pass-through UTMs & fbclid to Mintlink)
    function enrichCheckoutLinks() {
        const checkoutAnchors = document.querySelectorAll(`a[href*="mintlink.in"]`);
        const queryParams = new URLSearchParams();

        if (attribution.utm_source && attribution.utm_source !== "none") queryParams.set("utm_source", attribution.utm_source);
        if (attribution.utm_medium && attribution.utm_medium !== "none") queryParams.set("utm_medium", attribution.utm_medium);
        if (attribution.utm_campaign && attribution.utm_campaign !== "none") queryParams.set("utm_campaign", attribution.utm_campaign);
        if (attribution.utm_content && attribution.utm_content !== "none") queryParams.set("utm_content", attribution.utm_content);
        if (attribution.utm_term && attribution.utm_term !== "none") queryParams.set("utm_term", attribution.utm_term);
        if (attribution.fbclid && attribution.fbclid !== "none") queryParams.set("fbclid", attribution.fbclid);

        // Append visitor / session token for cross-platform matching
        queryParams.set("client_session", sessionId);

        const queryString = queryParams.toString();
        const finalUrl = queryString ? `${CHECKOUT_BASE_URL}?${queryString}` : CHECKOUT_BASE_URL;

        checkoutAnchors.forEach(a => {
            a.href = finalUrl;
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
        });
    }

    // 4. Device & Browser Detection
    function getDeviceInfo() {
        const ua = navigator.userAgent;
        let device = "Desktop";
        if (/Mobi|Android/i.test(ua)) device = "Mobile";
        else if (/Tablet|iPad/i.test(ua)) device = "Tablet";

        let browser = "Other";
        if (ua.indexOf("Firefox") > -1) browser = "Firefox";
        else if (ua.indexOf("SamsungBrowser") > -1) browser = "Samsung Internet";
        else if (ua.indexOf("Opera") > -1 || ua.indexOf("OPR") > -1) browser = "Opera";
        else if (ua.indexOf("Trident") > -1) browser = "Internet Explorer";
        else if (ua.indexOf("Edge") > -1 || ua.indexOf("Edg") > -1) browser = "Edge";
        else if (ua.indexOf("Chrome") > -1) browser = "Chrome";
        else if (ua.indexOf("Safari") > -1) browser = "Safari";

        let os = "Unknown";
        if (ua.indexOf("Win") !== -1) os = "Windows";
        if (ua.indexOf("Mac") !== -1) os = "macOS";
        if (ua.indexOf("Linux") !== -1) os = "Linux";
        if (ua.indexOf("Android") !== -1) os = "Android";
        if (ua.indexOf("like Mac") !== -1) os = "iOS";

        return {
            device,
            browser,
            os,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language || "en"
        };
    }

    const deviceInfo = getDeviceInfo();

    // 5. Geolocation Lookup (Non-blocking, cached)
    let geoInfo = { country: "India", city: "Detecting...", ip: "Anonymous" };
    try {
        const cachedGeo = sessionStorage.getItem("clientforge_geo");
        if (cachedGeo) {
            geoInfo = JSON.parse(cachedGeo);
        } else {
            fetch("https://ipapi.co/json/")
                .then(res => res.json())
                .then(data => {
                    if (data && data.country_name) {
                        geoInfo = {
                            country: data.country_name || "India",
                            country_code: data.country_code || "IN",
                            city: data.city || "Unknown",
                            region: data.region || "",
                            ip: data.ip || "Masked"
                        };
                        sessionStorage.setItem("clientforge_geo", JSON.stringify(geoInfo));
                        logEvent("geo_resolved", { geo: geoInfo });
                    }
                })
                .catch(() => {
                    // Fallback to secondary geo service if blocked
                    fetch("https://api.country.is/")
                        .then(r => r.json())
                        .then(d => {
                            if (d && d.country) {
                                geoInfo.country = d.country;
                                sessionStorage.setItem("clientforge_geo", JSON.stringify(geoInfo));
                            }
                        }).catch(() => {});
                });
        }
    } catch (e) {}

    // 6. Broadcast Channel & Event Logging System
    let broadcastChannel;
    try {
        if ("BroadcastChannel" in window) {
            broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        }
    } catch (e) {}

    function logEvent(eventName, eventDetails = {}) {
        const eventObj = {
            id: 'ev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 6),
            name: eventName,
            timestamp: new Date().toISOString(),
            timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            visitorId: visitorId,
            sessionId: sessionId,
            attribution: attribution,
            device: deviceInfo,
            geo: geoInfo,
            details: eventDetails
        };

        // Save into local history (capped to last 500 events to prevent quota overflow)
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LOGS);
            const events = raw ? JSON.parse(raw) : [];
            events.unshift(eventObj);
            if (events.length > 500) events.pop();
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(events));
        } catch (e) {
            console.warn("Storage quota full, pruning oldest events", e);
        }

        // Broadcast live to any open dashboard windows
        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage({ type: "NEW_EVENT", event: eventObj });
            } catch (err) {}
        }

        // Meta Pixel Triggering
        fireMetaPixelEvent(eventName, eventDetails);

        return eventObj;
    }

    // 7. Meta Pixel Bridge
    function fireMetaPixelEvent(name, details) {
        if (typeof window.fbq === "function") {
            try {
                if (name === "pageview") {
                    window.fbq('track', 'PageView');
                    window.fbq('track', 'ViewContent', {
                        content_name: 'ClientForge PRO',
                        content_category: 'Digital Toolkit',
                        value: 99.00,
                        currency: 'INR'
                    });
                } else if (name === "checkout_click") {
                    window.fbq('track', 'InitiateCheckout', {
                        content_name: 'ClientForge PRO',
                        content_ids: ['clientforge_pro_99'],
                        content_type: 'product',
                        value: 99.00,
                        currency: 'INR',
                        num_items: 1,
                        button_location: details.buttonLocation || 'unknown'
                    });
                } else if (name === "calculator_used") {
                    window.fbq('trackCustom', 'ToolInteraction', { tool: 'PricingCalculator' });
                }
            } catch (err) {
                console.warn("Meta Pixel call error", err);
            }
        }
    }

    // 8. Track Scroll Depth (25%, 50%, 75%, 90%, 100%)
    const scrollMilestones = { 25: false, 50: false, 75: false, 90: false, 100: false };
    function handleScroll() {
        const h = document.documentElement, 
              b = document.body,
              st = 'scrollTop',
              sh = 'scrollHeight';
        const percent = Math.round((h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight) * 100);

        [25, 50, 75, 90, 100].forEach(mark => {
            if (percent >= mark && !scrollMilestones[mark]) {
                scrollMilestones[mark] = true;
                logEvent("scroll_depth", { percent: mark });
            }
        });
    }

    let scrollTimeout;
    window.addEventListener("scroll", () => {
        if (!scrollTimeout) {
            scrollTimeout = setTimeout(() => {
                handleScroll();
                scrollTimeout = null;
            }, 250);
        }
    }, { passive: true });

    // 9. Time on Page Heartbeat (5s, 15s, 30s, 60s, 120s, 300s)
    const timeMilestones = [5, 15, 30, 60, 120, 300];
    let timeIndex = 0;
    let secondsSpent = 0;
    setInterval(() => {
        secondsSpent += 1;
        if (timeIndex < timeMilestones.length && secondsSpent === timeMilestones[timeIndex]) {
            logEvent("time_on_page", { seconds: secondsSpent });
            timeIndex++;
        }
    }, 1000);

    // 10. Click Tracker for Checkout Buttons & Interactions
    function setupClickTrackers() {
        enrichCheckoutLinks();

        // Listen for all clicks on mintlink links
        document.addEventListener("click", function (e) {
            const link = e.target.closest('a[href*="mintlink.in"]');
            if (link) {
                const btnLocation = link.getAttribute("data-location") || 
                                    link.closest("header") ? "header_nav" : 
                                    link.closest("#hero") || link.closest("section:first-of-type") ? "hero_primary" :
                                    link.closest("#guarantee") ? "guarantee_card" :
                                    link.closest("#sticky-cta-bar") ? "sticky_mobile_bar" : "body_card";

                logEvent("checkout_click", {
                    url: link.href,
                    buttonLocation: btnLocation,
                    buttonText: link.innerText.trim().replace(/\s+/g, ' ').substring(0, 50),
                    secondsBeforeClick: secondsSpent,
                    scrollPercent: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100) || 0
                });
            }

            // Copy script buttons
            const copyBtn = e.target.closest('button[onclick*="copyText"]');
            if (copyBtn) {
                logEvent("script_copied", {
                    buttonText: copyBtn.innerText.trim()
                });
            }

            // FAQ accordion buttons
            const faqBtn = e.target.closest('button[onclick*="toggleFaq"]');
            if (faqBtn) {
                logEvent("faq_opened", {
                    question: faqBtn.querySelector('span')?.innerText.trim() || "FAQ Item"
                });
            }
        });
    }

    // 11. Initial Page Load Execution
    window.addEventListener("DOMContentLoaded", () => {
        setupClickTrackers();
        logEvent("pageview", {
            title: document.title,
            url: window.location.href,
            referrer: referrer
        });
    });

    // Expose Global Helper for External Triggers
    window.ClientForgeTracker = {
        logEvent,
        getAttribution: () => attribution,
        getDeviceInfo: () => deviceInfo,
        getVisitorId: () => visitorId,
        getSessionId: () => sessionId
    };
})();
