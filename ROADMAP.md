# 30-Day Step-by-Step Delivery Roadmap

## Project: Betin247 Proprietary Bet Placement System (BI247)
**Target Delivery Window**: 30 Days (Client Milestone Demo on Day 12)

---

### Phase 1 — Reverse Engineering, APK UI & Mobile Foundation (Days 1–7)
* **Day 1: APK Audit & Decompilation (COMPLETED)**
  * Decompile `betin247.apk` (`com.global.bi247`).
  * Extract layout assets, strings, colors, styles, and Java bytecode.
  * Extract `WebAppInterface`, `WebsiteConfig`, `PrefsManager`, and injection scripts.
* **Day 2: Mobile UI & Navigation (COMPLETED)**
  * Implement exact BI247 dark theme with blue accents.
  * Implement Website Selector with predefined dropdowns (`betin247`, `diamond`, `allpanel`).
  * Implement Credential Manager with masked passwords and "Remember Config" toggle.
* **Day 3: Target Account Selector (COMPLETED)**
  * Add multi-account selector (15, 20, 25, 30 accounts).
  * Build Sender vs. Receiver role switcher in mobile app settings.
* **Day 4: WebView Engine & Geolocation Injection (COMPLETED)**
  * Build hardware-accelerated WebView engine with custom user-agent.
  * Integrate Expo Location / Google Play Services Fused Location Provider Client.
  * Inject `window.updateGeoInfo({ lat, lon })` directly into the webview.
* **Day 5: Injector Script Refactoring (COMPLETED)**
  * Strip third-party dependencies (`echopeer.com`) from `betin247-patch.js`, `common.js`, and `common_mobile.js`.
  * Point all connections to the client's proprietary server.
* **Days 6–7: Mobile End-to-End Testing**
  * Test APK installation on physical Android devices.
  * Verify UI responsiveness across different screen densities.

---

### Phase 2 — Server 2: Bet Placement Engine & WebSocket Hub (Days 8–14)
* **Day 8: Server Initialization & API Specs (COMPLETED)**
  * Express + TypeScript + `ws` architecture setup.
  * Implement `/websites/:username/:password` and `/check-version` matching APK contracts.
* **Day 9: WebSocket Authentication & Ping Engine (COMPLETED)**
  * Implement `{ type: 'login' }` authentication handshake.
  * Implement 1-second ping/pong latency measurement (`pong` latency calculation).
* **Day 10: Multi-Account Bet Dispatcher (COMPLETED)**
  * Implement sub-millisecond parallel fan-out engine for `{ type: 'bet' }`.
  * Benchmark across 25–30 accounts (Achieved: **24ms total latency / 0.96ms per account**).
* **Day 11: Idempotency & Duplicate Protection**
  * Implement compound key deduplication: `[betId, betDetailId, isBack, rate, point, stake]`.
  * Prevent duplicate execution within a 1200ms window.
* **Day 12: Client Milestone 1 Demo**
  * Demonstrate 1-click bet submission from Sender triggering 25 Receiver accounts live.
* **Days 13–14: Per-Account Status Tracking & Audit Logging**
  * Track per-account execution status: `ACCEPTED`, `REJECTED`, `PENDING`, `UNKNOWN`.
  * Build `/api/bets` audit trail endpoint.

---

### Phase 3 — Server 1: Scraper Engine & Sub-Second Latency Optimization (Days 15–21)
* **Days 15–16: Scraper Engine Development (COMPLETED in `server/src/scraper.ts`)**
  * High-frequency polling engine (500ms intervals) for odds, bookmaker, and fancy markets.
* **Days 17–18: Rotating Proxy Integration**
  * Integrate residential/datacenter proxy pool via `https-proxy-agent`.
  * Rotate IP on each request to prevent exchange rate-limiting and IP blocks.
* **Day 19: Time Controller & Pre-Lock Alert**
  * Implement 2-to-3 second pre-lock detector before "ball running" status occurs.
  * Push alerts to the Sender floating HUD.
* **Days 20–21: Betslip Bypass Hardening**
  * Verify `placeBet` Angular context interception across all exchange domains.
  * Validate fallback for legacy HTTP direct submissions.

---

### Phase 4 — Railway Deployment, Stress Testing & APK Release (Days 22–30)
* **Days 22–23: Railway Multi-Service Deployment (COMPLETED)**
  * Deploy Server 1 (Scraper) and Server 2 (Bet Hub) as separate Railway services.
  * Configure environment secrets, SSL (`wss://`), and persistent logs.
* **Days 24–25: 30-Account Concurrency Stress Testing**
  * Simulate 30 concurrent receiver connections under heavy live-market odds load.
  * Verify zero dropped bets and sub-100ms dispatch latency.
* **Days 26–27: Production APK Generation**
  * Generate release APK using `eas build -p android --profile release`.
  * Sign APK with client release keystore.
* **Days 28–29: User Acceptance Testing (UAT)**
  * Run test betting runs on staging/sandbox exchange accounts.
  * Verify bet amounts, fancy stakes, and order history reconciliation.
* **Day 30: Final Handover & Source Code Delivery**
  * 100% complete source code transfer to the client.
  * Complete developer documentation and deployment runbooks.
