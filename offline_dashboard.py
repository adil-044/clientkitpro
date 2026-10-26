#!/usr/bin/env python3
"""
ClientForge PRO — Private Synchronized Offline Dashboard & Analytics Engine
Run: python offline_dashboard.py
Opens: http://localhost:5000
"""

import http.server
import socketserver
import json
import sqlite3
import os
import sys
import urllib.parse
from datetime import datetime

PORT = 5000
DB_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), "analytics.db")

# Initialize SQLite database
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS events (
            id TEXT PRIMARY KEY,
            event_name TEXT,
            timestamp TEXT,
            session_id TEXT,
            visitor_id TEXT,
            city TEXT,
            country TEXT,
            source TEXT,
            medium TEXT,
            campaign TEXT,
            content TEXT,
            term TEXT,
            fbclid TEXT,
            device TEXT,
            os TEXT,
            scroll_pct INTEGER DEFAULT 0,
            time_spent INTEGER DEFAULT 0,
            details TEXT
        )
    """)
    conn.commit()
    conn.close()

init_db()

def insert_event(data):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    ev_id = data.get("id") or ("ev_" + str(datetime.now().timestamp()))
    name = data.get("name") or "unknown"
    ts = data.get("timestamp") or datetime.now().isoformat()
    s_id = data.get("sessionId") or ""
    v_id = data.get("visitorId") or ""
    
    geo = data.get("geo") or {}
    city = geo.get("city") or "India"
    country = geo.get("country") or "India"
    
    attr = data.get("attribution") or {}
    source = attr.get("utm_source") or "direct"
    medium = attr.get("utm_medium") or ""
    campaign = attr.get("utm_campaign") or "none"
    content = attr.get("utm_content") or ""
    term = attr.get("utm_term") or ""
    fbclid = attr.get("fbclid") or ""
    
    dev = data.get("device") or {}
    device_type = dev.get("device") or "Mobile"
    os_name = dev.get("os") or "Unknown"
    
    details = data.get("details") or {}
    scroll_pct = details.get("percent") if name == "scroll_depth" else 0
    time_spent = details.get("seconds") if name == "time_on_page" else 0
    
    c.execute("""
        INSERT OR REPLACE INTO events 
        (id, event_name, timestamp, session_id, visitor_id, city, country, source, medium, campaign, content, term, fbclid, device, os, scroll_pct, time_spent, details)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (ev_id, name, ts, s_id, v_id, city, country, source, medium, campaign, content, term, fbclid, device_type, os_name, scroll_pct, time_spent, json.dumps(details)))
    conn.commit()
    conn.close()

def get_all_events():
    conn = sqlite3.connect(DB_FILE)
    conn.row_factory = sqlite3.Row
    c = conn.cursor()
    c.execute("SELECT * FROM events ORDER BY timestamp DESC LIMIT 1000")
    rows = [dict(row) for row in c.fetchall()]
    conn.close()
    return rows

HTML_PAGE = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ClientForge PRO — Private Offline Analytics</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;800&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
    <style>
        body { background-color: #07090e; color: #e2e8f0; font-family: 'Plus Jakarta Sans', sans-serif; }
        .glass-panel { background: rgba(17, 23, 35, 0.85); backdrop-filter: blur(14px); border: 1px solid rgba(255, 255, 255, 0.08); }
        .live-dot { width: 8px; height: 8px; border-radius: 50%; background-color: #10b981; animation: pulse 1.5s infinite; }
        @keyframes pulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.85); } }
    </style>
</head>
<body class="p-6">
    <div class="max-w-7xl mx-auto space-y-6">
        <!-- Header -->
        <div class="glass-panel p-5 rounded-2xl flex items-center justify-between">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white">CF</div>
                <div>
                    <h1 class="text-lg font-black text-white flex items-center gap-2">
                        ClientForge PRO &bull; Private Synchronized Console
                        <span class="text-[10px] bg-emerald-500/20 text-emerald-400 font-bold px-2 py-0.5 rounded border border-emerald-500/30">ONLINE & SYNCED</span>
                    </h1>
                    <p class="text-xs text-slate-400">Stores all visitor actions from Meta Ads permanently in SQLite</p>
                </div>
            </div>
            <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 bg-dark-900 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
                    <span class="live-dot"></span>
                    <span class="text-slate-300">Auto-refresh (2s)</span>
                </div>
                <button onclick="fetchEvents()" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all">
                    Refresh Now
                </button>
            </div>
        </div>

        <!-- KPI Cards -->
        <div class="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div class="glass-panel p-5 rounded-2xl">
                <p class="text-xs text-slate-400 font-bold uppercase">Total Ad Visits</p>
                <p class="text-3xl font-black text-white mt-1" id="stat-visits">0</p>
                <p class="text-[11px] text-slate-500 mt-1">Unique prospects across all devices</p>
            </div>
            <div class="glass-panel p-5 rounded-2xl">
                <p class="text-xs text-slate-400 font-bold uppercase">Unique Prospects</p>
                <p class="text-3xl font-black text-indigo-400 mt-1" id="stat-uniques">0</p>
                <p class="text-[11px] text-slate-500 mt-1">Mobile & Desktop sessions</p>
            </div>
            <div class="glass-panel p-5 rounded-2xl border-emerald-500/40">
                <p class="text-xs text-emerald-400 font-bold uppercase">Mintlink Checkout Clicks</p>
                <p class="text-3xl font-black text-emerald-400 mt-1" id="stat-checkouts">0</p>
                <p class="text-[11px] text-slate-500 mt-1">Direct buy button clicks (₹99)</p>
            </div>
            <div class="glass-panel p-5 rounded-2xl border-amber-500/40">
                <p class="text-xs text-amber-400 font-bold uppercase">Click Conversion (CTR)</p>
                <p class="text-3xl font-black text-white mt-1" id="stat-ctr">0.0%</p>
                <p class="text-[11px] text-slate-500 mt-1">Checkout / Total Visits</p>
            </div>
        </div>

        <!-- Live Table -->
        <div class="glass-panel rounded-2xl overflow-hidden">
            <div class="p-5 border-b border-slate-800 flex justify-between items-center">
                <h3 class="font-bold text-white text-sm">Synchronized Visitor Clickstream (All Devices)</h3>
                <span class="text-xs text-slate-400 font-mono" id="last-updated">Updating...</span>
            </div>
            <div class="overflow-x-auto">
                <table class="w-full text-left text-xs text-slate-300">
                    <thead class="bg-slate-900/60 text-slate-400 uppercase text-[10px] font-bold border-b border-slate-800">
                        <tr>
                            <th class="p-3">Time</th>
                            <th class="p-3">Location</th>
                            <th class="p-3">Source / Campaign</th>
                            <th class="p-3">Ad Creative</th>
                            <th class="p-3">Device</th>
                            <th class="p-3">Event Action</th>
                            <th class="p-3">Details</th>
                        </tr>
                    </thead>
                    <tbody id="events-table" class="divide-y divide-slate-800/60 font-mono text-[11px]">
                        <!-- Populated by JS -->
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <script>
        async function fetchEvents() {
            try {
                const res = await fetch('/api/events');
                const data = await res.json();
                render(data);
            } catch (e) {
                console.error(e);
            }
        }

        function render(events) {
            document.getElementById('last-updated').innerText = 'Last updated: ' + new Date().toLocaleTimeString();
            const pageviews = events.filter(e => e.event_name === 'pageview').length;
            const uniques = new Set(events.map(e => e.visitor_id)).size;
            const checkouts = events.filter(e => e.event_name === 'checkout_click').length;
            const ctr = pageviews > 0 ? ((checkouts / pageviews) * 100).toFixed(1) : 0;

            document.getElementById('stat-visits').innerText = pageviews;
            document.getElementById('stat-uniques').innerText = uniques;
            document.getElementById('stat-checkouts').innerText = checkouts;
            document.getElementById('stat-ctr').innerText = ctr + '%';

            const tbody = document.getElementById('events-table');
            if (events.length === 0) {
                tbody.innerHTML = '<tr><td colspan="7" class="p-6 text-center text-slate-500">No events received yet. Live events from any device will appear here instantly.</td></tr>';
                return;
            }

            tbody.innerHTML = events.slice(0, 100).map(e => {
                const isCheckout = e.event_name === 'checkout_click';
                const actionBadge = isCheckout ? 
                    '<span class="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold">🛒 CHECKOUT (₹99)</span>' :
                    `<span class="bg-slate-800 text-slate-300 px-2 py-0.5 rounded">${e.event_name}</span>`;
                
                return `
                    <tr class="hover:bg-slate-800/40 transition-colors">
                        <td class="p-3 text-slate-400">${new Date(e.timestamp).toLocaleTimeString()}</td>
                        <td class="p-3 text-white font-sans">${e.city}, ${e.country}</td>
                        <td class="p-3 text-indigo-400">${e.source} / <b>${e.campaign || 'none'}</b></td>
                        <td class="p-3 text-amber-400">${e.content || '-'}</td>
                        <td class="p-3 text-slate-400 font-sans">${e.device} (${e.os})</td>
                        <td class="p-3">${actionBadge}</td>
                        <td class="p-3 text-slate-400 text-[10px] truncate max-w-xs">${e.details || ''}</td>
                    </tr>
                `;
            }).join('');
        }

        setInterval(fetchEvents, 2000);
        fetchEvents();
    </script>
</body>
</html>
"""

class RequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/events":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            events = get_all_events()
            self.wfile.write(json.dumps(events).encode("utf-8"))
        elif parsed.path == "/" or parsed.path == "/dashboard":
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(HTML_PAGE.encode("utf-8"))
        else:
            super().do_GET()

    def do_POST(self):
        parsed = urllib.parse.urlparse(self.path)
        if parsed.path == "/api/event" or parsed.path == "/api/track":
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            try:
                data = json.loads(body.decode("utf-8"))
                insert_event(data)
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(b'{"status":"recorded"}')
                print(f"[{datetime.now().strftime('%H:%M:%S')}] Logged {data.get('name')} from {data.get('geo', {}).get('city', 'Unknown')}")
            except Exception as e:
                self.send_response(400)
                self.end_headers()
                self.wfile.write(str(e).encode())
        else:
            self.send_response(404)
            self.end_headers()

def run_server():
    print("=" * 60)
    print(" ClientForge PRO — Private Synchronized Offline Dashboard")
    print(f" Local URL: http://localhost:{PORT}")
    print(f" Database: {DB_FILE}")
    print("=" * 60)
    with socketserver.TCPServer(("", PORT), RequestHandler) as httpd:
        httpd.serve_forever()

if __name__ == "__main__":
    run_server()
