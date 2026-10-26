/**
 * ClientForge PRO — Advanced Meta Ad & Customer Journey Telemetry Engine v3.0
 * Universal Cloud & Offline Synchronization
 */

(function () {
    const CHECKOUT_BASE_URL = "https://mintlink.in/m/clientkitpro";
    const SYNC_ENDPOINT = "https://noncoplanar-unfrizzled-marilyn.ngrok-free.dev/api/event";
    const LOCAL_SYNC_ENDPOINT = "http://localhost:5000/api/event";

    const STORAGE_KEY_SESSION = "clientforge_session_id";
    const STORAGE_KEY_VISITOR = "clientforge_visitor_id";
    const STORAGE_KEY_LOGS = "clientforge_analytics_events";
    const STORAGE_KEY_ATTR = "clientforge_attribution";
    const BROADCAST_CHANNEL_NAME = "clientforge_analytics_channel";

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

    const urlParams = new URLSearchParams(window.location.search);
    const referrer = document.referrer || "direct";

    function detectReferrerSource(ref) {
        if (!ref || ref === "direct") return "Direct / Bookmark";
        const lower = ref.toLowerCase();
        if (lower.includes("instagram.com") || lower.includes("l.instagram.com")) return "Instagram (Ad/Organic)";
        if (lower.includes("facebook.com") || lower.includes("fb.me") || lower.includes("l.facebook.com")) return "Facebook (Ad/Organic)";
        if (lower.includes("google.com")) return "Google Search";
        if (lower.includes("twitter.com") || lower.includes("t.co") || lower.includes("x.com")) return "Twitter / X";
        if (lower.includes("linkedin.com") || lower.includes("lnkd.in")) return "LinkedIn";
        if (lower.includes("whatsapp")) return "WhatsApp Chat";
        return ref;
    }

    let attribution = JSON.parse(sessionStorage.getItem(STORAGE_KEY_ATTR) || "null");
    if (!attribution) {
        attribution = {
            utm_source: urlParams.get("utm_source") || (urlParams.get("fbclid") ? "meta" : (referrer.includes("instagram") ? "instagram" : (referrer.includes("facebook") ? "facebook" : "direct"))),
            utm_medium: urlParams.get("utm_medium") || (urlParams.get("fbclid") ? "cpc" : "referral"),
            utm_campaign: urlParams.get("utm_campaign") || (urlParams.get("fbclid") ? "meta_campaign" : "none"),
            utm_content: urlParams.get("utm_content") || "none",
            utm_term: urlParams.get("utm_term") || "none",
            adset_id: urlParams.get("adset_id") || "none",
            campaign_id: urlParams.get("campaign_id") || "none",
            ad_id: urlParams.get("ad_id") || "none",
            fbclid: urlParams.get("fbclid") || "none",
            raw_referrer: referrer,
            source_platform: detectReferrerSource(referrer),
            entry_page: window.location.pathname + window.location.search,
            landing_time: new Date().toISOString()
        };
        sessionStorage.setItem(STORAGE_KEY_ATTR, JSON.stringify(attribution));
    }

    function enrichCheckoutLinks() {
        const checkoutAnchors = document.querySelectorAll(`a[href*="mintlink.in"]`);
        const queryParams = new URLSearchParams();

        if (attribution.utm_source && attribution.utm_source !== "none") queryParams.set("utm_source", attribution.utm_source);
        if (attribution.utm_medium && attribution.utm_medium !== "none") queryParams.set("utm_medium", attribution.utm_medium);
        if (attribution.utm_campaign && attribution.utm_campaign !== "none") queryParams.set("utm_campaign", attribution.utm_campaign);
        if (attribution.utm_content && attribution.utm_content !== "none") queryParams.set("utm_content", attribution.utm_content);
        if (attribution.utm_term && attribution.utm_term !== "none") queryParams.set("utm_term", attribution.utm_term);
        if (attribution.fbclid && attribution.fbclid !== "none") queryParams.set("fbclid", attribution.fbclid);

        queryParams.set("client_session", sessionId);

        const queryString = queryParams.toString();
        const finalUrl = queryString ? `${CHECKOUT_BASE_URL}?${queryString}` : CHECKOUT_BASE_URL;

        checkoutAnchors.forEach(a => {
            a.href = finalUrl;
            a.setAttribute("target", "_blank");
            a.setAttribute("rel", "noopener noreferrer");
        });
    }

    function getDeviceInfo() {
        const ua = navigator.userAgent;
        let device = "Desktop";
        if (/Mobi|Android/i.test(ua)) device = "Mobile";
        else if (/Tablet|iPad/i.test(ua)) device = "Tablet";

        let os = "Unknown";
        if (ua.indexOf("Win") !== -1) os = "Windows";
        else if (ua.indexOf("Mac") !== -1) os = "macOS";
        else if (ua.indexOf("Linux") !== -1) os = "Linux";
        else if (ua.indexOf("Android") !== -1) os = "Android";
        else if (ua.indexOf("like Mac") !== -1 || ua.indexOf("iPhone") !== -1 || ua.indexOf("iPad") !== -1) os = "iOS";

        return {
            device,
            os,
            screenWidth: window.screen.width,
            screenHeight: window.screen.height,
            language: navigator.language || "en"
        };
    }

    const deviceInfo = getDeviceInfo();

    let geoInfo = { country: "India", country_code: "IN", city: "Local", ip: "Masked" };
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
                    }
                }).catch(() => {});
        }
    } catch (e) {}

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

        // 1. Save local
        try {
            const raw = localStorage.getItem(STORAGE_KEY_LOGS);
            const events = raw ? JSON.parse(raw) : [];
            events.unshift(eventObj);
            if (events.length > 500) events.pop();
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(events));
        } catch (e) {}

        // 2. Broadcast local tab
        if (broadcastChannel) {
            try { broadcastChannel.postMessage({ type: "NEW_EVENT", event: eventObj }); } catch (err) {}
        }

        // 3. SYNCHRONIZE GLOBALLY TO CLOUD (Available across all devices)
        try {
            fetch(CLOUD_SYNC_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventObj),
                keepalive: true
            }).catch(() => {});
        } catch (err) {}

        // 4. SYNCHRONIZE TO LOCAL OFFLINE DASHBOARD IF RUNNING
        try {
            fetch(LOCAL_SYNC_ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(eventObj),
                keepalive: true
            }).catch(() => {});
        } catch (err) {}

        // 5. Trigger Meta Pixel
        fireMetaPixelEvent(eventName, eventDetails);

        return eventObj;
    }

    function fireMetaPixelEvent(name, details) {
        if (typeof window.fbq === "function") {
            try {
                if (name === "pageview") {
                    window.fbq('track', 'PageView');
                    window.fbq('track', 'ViewContent', { content_name: 'ClientForge PRO', value: 99.00, currency: 'INR' });
                } else if (name === "checkout_click") {
                    window.fbq('track', 'InitiateCheckout', {
                        content_name: 'ClientForge PRO',
                        value: 99.00,
                        currency: 'INR',
                        button_location: details.buttonLocation || 'unknown'
                    });
                }
            } catch (err) {}
        }
    }

    const scrollMilestones = { 25: false, 50: false, 75: false, 90: false, 100: false };
    function handleScroll() {
        const h = document.documentElement, b = document.body;
        const st = 'scrollTop', sh = 'scrollHeight';
        const percent = Math.round(((h[st]||b[st]) / ((h[sh]||b[sh]) - h.clientHeight)) * 100);

        [25, 50, 75, 90, 100].forEach(mark => {
            if (percent >= mark && !scrollMilestones[mark]) {
                scrollMilestones[mark] = true;
                logEvent("scroll_depth", { percent: mark });
            }
        });
    }

    window.addEventListener("scroll", handleScroll, { passive: true });

    let secondsSpent = 0;
    const timeMilestones = [5, 15, 30, 60, 120, 300];
    let timeIdx = 0;
    setInterval(() => {
        secondsSpent += 1;
        if (timeIdx < timeMilestones.length && secondsSpent === timeMilestones[timeIdx]) {
            logEvent("time_on_page", { seconds: secondsSpent });
            timeIdx++;
        }
    }, 1000);

    function setupClickTrackers() {
        enrichCheckoutLinks();

        document.addEventListener("click", function (e) {
            const link = e.target.closest('a[href*="mintlink.in"]');
            if (link) {
                let loc = "body_card";
                if (link.closest("header")) loc = "header_nav";
                else if (link.closest("#hero") || link.closest("section:first-of-type")) loc = "hero_primary";
                else if (link.closest("#guarantee")) loc = "guarantee_card";
                else if (link.closest("#sticky-cta-bar")) loc = "sticky_mobile_bar";

                logEvent("checkout_click", {
                    url: link.href,
                    buttonLocation: loc,
                    buttonText: link.innerText.trim().replace(/\s+/g, ' ').substring(0, 50),
                    secondsBeforeClick: secondsSpent,
                    scrollPercent: Math.round((window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100) || 0
                });
            }

            const copyBtn = e.target.closest('button[onclick*="copyText"]');
            if (copyBtn) {
                logEvent("script_copied", { buttonText: copyBtn.innerText.trim() });
            }

            const faqBtn = e.target.closest('button[onclick*="toggleFaq"]');
            if (faqBtn) {
                logEvent("faq_opened", { question: faqBtn.querySelector('span')?.innerText.trim() || "FAQ" });
            }
        }, true);
    }

    let initialized = false;
    function initTracker() {
        if (initialized) return;
        initialized = true;
        setupClickTrackers();
        logEvent("pageview", {
            title: document.title,
            url: window.location.href,
            referrer: referrer
        });
    }

    if (document.readyState === "complete" || document.readyState === "interactive") {
        initTracker();
    } else {
        document.addEventListener("DOMContentLoaded", initTracker);
        window.addEventListener("load", initTracker);
    }

    window.ClientForgeTracker = {
        logEvent,
        getAttribution: () => attribution,
        getDeviceInfo: () => deviceInfo
    };
})();
