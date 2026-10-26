/**
 * ClientForge PRO — Advanced Meta Ad & Customer Journey Telemetry Engine v2.1
 * Bulletproof event capture, immediate execution, and Mintlink checkout attribution
 */

(function () {
    const CHECKOUT_BASE_URL = "https://mintlink.in/m/clientkitpro";
    const STORAGE_KEY_SESSION = "clientforge_session_id";
    const STORAGE_KEY_VISITOR = "clientforge_visitor_id";
    const STORAGE_KEY_LOGS = "clientforge_analytics_events";
    const STORAGE_KEY_ATTR = "clientforge_attribution";
    const STORAGE_KEY_WEBHOOK = "clientforge_webhook_url";
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

    function detectReferrerSource(ref) {
        if (!ref || ref === "direct") return "Direct / Bookmark";
        const lower = ref.toLowerCase();
        if (lower.includes("instagram.com") || lower.includes("l.instagram.com")) return "Instagram (Ad/Organic)";
        if (lower.includes("facebook.com") || lower.includes("fb.me") || lower.includes("l.facebook.com")) return "Facebook (Ad/Organic)";
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
            utm_source: urlParams.get("utm_source") || (urlParams.get("fbclid") ? "meta" : (referrer.includes("instagram") ? "instagram" : (referrer.includes("facebook") ? "facebook" : "direct"))),
            utm_medium: urlParams.get("utm_medium") || (urlParams.get("fbclid") ? "cpc" : "referral"),
            utm_campaign: urlParams.get("utm_campaign") || (urlParams.get("fbclid") ? "meta_campaign" : "none"),
            utm_content: urlParams.get("utm_content") || "none",
            utm_term: urlParams.get("utm_term") || "none",
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

    // 3. Dynamic CTA Link Enrichment
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

    // 4. Device Detection
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

    // 5. Geolocation Lookup
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

    // 6. Broadcast Channel
    let broadcastChannel;
    try {
        if ("BroadcastChannel" in window) {
            broadcastChannel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        }
    } catch (e) {}

    // 7. Core Event Logger
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

        try {
            const raw = localStorage.getItem(STORAGE_KEY_LOGS);
            const events = raw ? JSON.parse(raw) : [];
            events.unshift(eventObj);
            if (events.length > 500) events.pop();
            localStorage.setItem(STORAGE_KEY_LOGS, JSON.stringify(events));
        } catch (e) {}

        if (broadcastChannel) {
            try {
                broadcastChannel.postMessage({ type: "NEW_EVENT", event: eventObj });
            } catch (err) {}
        }

        // Webhook notification (Discord / Telegram) if configured
        notifyWebhook(eventObj);

        // Meta Pixel
        fireMetaPixelEvent(eventName, eventDetails);

        return eventObj;
    }

    // Optional Webhook Push for external visitor visibility
    function notifyWebhook(ev) {
        const webhookUrl = localStorage.getItem(STORAGE_KEY_WEBHOOK);
        if (!webhookUrl) return;

        if (ev.name === "pageview" || ev.name === "checkout_click") {
            try {
                const isCheckout = ev.name === "checkout_click";
                const payload = {
                    content: isCheckout ? 
                        `🚨 **MINTLINK CHECKOUT CLICK!** (₹99)\nProspect: ${ev.geo.city}, ${ev.geo.country} (${ev.device.device} - ${ev.device.os})\nCampaign: \`${ev.attribution.utm_campaign}\` | Ad: \`${ev.attribution.utm_content}\`` :
                        `👀 **New Ad Visitor!**\nFrom: ${ev.geo.city}, ${ev.geo.country} | Platform: ${ev.attribution.source_platform}\nCampaign: \`${ev.attribution.utm_campaign}\``
                };
                fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                }).catch(() => {});
            } catch (e) {}
        }
    }

    function fireMetaPixelEvent(name, details) {
        if (typeof window.fbq === "function") {
            try {
                if (name === "pageview") {
                    window.fbq('track', 'PageView');
                    window.fbq('track', 'ViewContent', {
                        content_name: 'ClientForge PRO',
                        value: 99.00,
                        currency: 'INR'
                    });
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

    // 8. Scroll Depth Tracker
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

    // 9. Time on Page
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

    // 10. Click Listeners
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

    // 11. BULLETPROOF INITIALIZATION (Fixed race condition)
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
