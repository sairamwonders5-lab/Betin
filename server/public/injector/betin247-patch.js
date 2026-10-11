/**
 * Betin247 Proprietary Injection Patch
 * Intercepts exchange application components, bypasses betslip, and connects to WebSocket hub
 */
(async () => {
    if (window.__betin247Bootstrapped) return;
    window.__betin247Bootstrapped = true;

    const SERVER_URL = window.PROPRIETARY_SERVER_URL || window.location.origin;
    const script = document.createElement('script');
    script.src = `${SERVER_URL}/injector/common.js?v=prop_1`;

    while (!document.head) await new Promise(r => setTimeout(r, 100));
    if (typeof renderSelfHeader !== 'function') {
        await new Promise(resolve => {
            script.onload = resolve;
            document.head.appendChild(script);
        });
    }

    window.onMessageCallback = (data) => {
        if (data.type === 'login') {
            if (data?.data?.isSender || data.isSender) hideBetSlipCss();
        }
    };

    if (typeof renderSelfHeader === 'function') {
        renderSelfHeader();
    }
    installPatch();
})();

const HOSTS = [
    'app-market-bet-details',
    'app-virtual-bet-details',
    'app-advance-session-type',
    'app-market-type',
    'app-virtual-type',
    'app-match',
    'app-market',
    'app-virtual-sports',
    '[app-advance-session-bet-details]'
];

function hideBetSlipCss() {
    if (window.__betin247SlipCss) return;
    window.__betin247SlipCss = true;
    const s = document.createElement('style');
    s.innerHTML = `
        [app-market-place-bet-views], [app-session-place-bet-views],
        app-market-place-bet-views, app-session-place-bet-views,
        .bet-input-container, .betslip-loader, .bet-cont.bet-input-container,
        .bet-collapse .bet-cont { display: none !important; }
    `;
    document.head.append(s);
}

function bypassSlip() {
    return !!(window.isAdmin || window.isForce);
}

function endForce() {
    window.isForce = false;
}

function wrapFn(obj, name, wrapper) {
    const orig = obj?.[name];
    if (typeof orig !== 'function' || orig.__turioWrapped) return false;
    const fn = wrapper(orig);
    fn.__turioWrapped = true;
    obj[name] = fn;
    return true;
}

function isFancyBet(d) {
    if (!d) return false;
    if (d.isRunnerTypeMarket === false) return true;
    const mt = Number(d.marketType ?? d.fancyType);
    return mt === 1 || mt === 6;
}

function stakeAmount(d) {
    const fancy = isFancyBet(d);
    const n = Number(document.getElementById(fancy ? 'f-stake' : 'b-stake')?.value);
    if (n > 0) return n;
    const stored = Number(localStorage.getItem(fancy ? 'fstake' : 'bstake'));
    return stored > 0 ? stored : 100;
}

function historyLabel(d, failMsg) {
    const stake = d.stake;
    const name = d.betTitle || d.betId || '';
    const rate = isFancyBet(d) && d.point != null && d.point !== d.rate
        ? `${d.rate}/${d.point}`
        : (d.rate ?? '');
    const side = d.isBack ? 'BACK' : 'LAY';
    const prefix = failMsg ? `Failed ${failMsg} ` : '';
    return `${prefix}[${stake}] ${name} @${rate} - ${side}`;
}

function notifyPlacing() {
    endForce();
    typeof betPlacedNotification === 'function' && betPlacedNotification('Placing Bet', 'gray');
}

function notifyResult(d, ok, msg) {
    endForce();
    typeof playBetSound === 'function' && playBetSound(ok);
    typeof betPlacedNotification === 'function' && betPlacedNotification(msg, ok ? 'green' : 'red');
    typeof addBetHistoryEntry === 'function' && addBetHistoryEntry(historyLabel(d, ok ? '' : msg), ok);
}

let lastPlaceKey = '';
let lastPlaceAt = 0;
function isDuplicate(d) {
    const key = [d.betId, d.betDetailId, d.isBack, d.rate, d.point, d.stake].join('|');
    const now = Date.now();
    if (key === lastPlaceKey && now - lastPlaceAt < 1200) return true;
    lastPlaceKey = key;
    lastPlaceAt = now;
    return false;
}

function unpack(raw) {
    if (!raw || typeof raw !== 'object') return null;
    if (raw.data && (raw.url != null || raw.type != null || raw.data.betId != null)) return raw.data;
    return raw;
}

function deviceBits() {
    return {
        placeFrom: 2, // Mobile/App
        deviceinfo: `browser=Chrome:: device=Mobile:: os=Android:: latitude=0 :: longitude=0`
    };
}

function buildHttpBody(data) {
    const stake = data.stake || stakeAmount(data);
    const dev = deviceBits();
    return {
        betId: data.betId,
        betDetailId: data.betDetailId,
        isBack: !!data.isBack,
        rate: data.rate,
        stake,
        fancyType: data.marketType ?? data.fancyType,
        point: data.point,
        placeFrom: data.placeFrom || dev.placeFrom,
        deviceinfo: data.deviceinfo || dev.deviceinfo,
        isJodiRates: data.isJodiRates,
        isWager: false
    };
}

function asPromise(obs) {
    if (!obs) return Promise.reject({ message: 'Service not ready' });
    if (typeof obs.then === 'function') return obs;
    if (typeof obs.subscribe === 'function') {
        return new Promise((resolve, reject) => {
            const sub = obs.subscribe({
                next: (v) => {
                    try { sub.unsubscribe?.(); } catch { }
                    resolve(v);
                },
                error: reject
            });
        });
    }
    return Promise.resolve(obs);
}

function parsePlaceResult(c) {
    if (c == null) return { ok: false, msg: 'Bet Failed' };
    if (typeof c === 'string') {
        const u = c.split(';');
        if (!u.length) return { ok: false, msg: 'Bet Failed' };
        if (u[0] !== 'false') return { ok: true, msg: u[1] || 'Bet Placed' };
        return { ok: false, msg: u[1] || 'Bet Failed' };
    }
    if (typeof c === 'object') {
        const msg = c.result?.message || c.message || c.msg || '';
        const ok = c.isSuccess === true || c.status === true || (typeof c.result === 'string' && !c.result.startsWith('false'));
        return { ok, msg: msg || (ok ? 'Bet Placed' : 'Bet Failed') };
    }
    return { ok: false, msg: String(c) };
}

window.placeOrder = function placeOrder(raw) {
    const data = unpack(raw);
    if (!data || data.betId == null || data.betDetailId == null) return;

    const packed = { ...data };
    const stake = packed.stake || stakeAmount(packed);
    packed.stake = stake;

    if (isDuplicate(packed)) return;

    // Sender transmits to WebSocket hub
    if (window.isAdmin) {
        const wire = { ...data, stake };
        window.ownSocket?.send(JSON.stringify({ type: 'bet', data: wire }));
    }

    // Direct local execution on the exchange
    const bs = window.__betin247Bs;
    if (!bs?.placeBet) {
        notifyResult(packed, false, 'Service not ready');
        return;
    }

    const body = buildHttpBody(packed);
    notifyPlacing();
    try { bs.setBetStatus?.(true); } catch { }

    asPromise(bs.placeBet(body)).then((res) => {
        const parsed = parsePlaceResult(res);
        notifyResult(packed, parsed.ok, parsed.msg);
        // Report status back to WebSocket hub
        if (!window.isAdmin) {
            window.ownSocket?.send(JSON.stringify({
                type: 'betResult',
                data: {
                    parentBetId: data.parentBetId,
                    status: parsed.ok ? 'ACCEPTED' : 'REJECTED',
                    message: parsed.msg,
                }
            }));
        }
    }).catch((err) => {
        const msg = err?.message || 'Bet Failed';
        notifyResult(packed, false, msg);
    });
};

function patchBetService(bs) {
    if (!bs || bs.__betin247Patched) return;
    bs.__betin247Patched = true;
    window.__betin247Bs = bs;
}

function installPatch() {
    const observer = new MutationObserver(() => {
        for (const host of HOSTS) {
            const el = document.querySelector(host);
            if (el && el.__ngContext__) {
                const ctx = el.__ngContext__;
                for (let i = 0; i < ctx.length; i++) {
                    const item = ctx[i];
                    if (item && typeof item === 'object') {
                        if (typeof item.placeBet === 'function') {
                            patchBetService(item);
                        }
                    }
                }
            }
        }
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });
}
