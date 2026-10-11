/**
 * Proprietary Betin247 WebSocket Client & Bridge
 */
var notificationDiv;
var ownSocket;
var onMessageCallback;
var isAdmin = false;
var isSender = false;
var isLogin = false;
var lastPing = 0;
var pingInterval = null;
var receiverCountInterval = null;

const MAX_NOTIFICATIONS = 5;
const NOTI_DISPLAY_MS = 2500;

function ensureHeaderShadowRoot() {
    let host = document.getElementById('tpHeaderHost');
    if (!host) {
        host = document.createElement('div');
        host.id = 'tpHeaderHost';
        host.style.cssText = 'position:fixed;top:0;left:0;width:0;height:0;z-index:2147483646;pointer-events:none;';
        document.body.prepend(host);
    }
    return host.shadowRoot || host.attachShadow({ mode: 'open' });
}

function renderSelfHeader() {
    if (window.__tpRenderSelfHeaderImpl) {
        return window.__tpRenderSelfHeaderImpl();
    }
    loadTpUiVariant();
}

function loadTpUiVariant() {
    const SERVER_URL = window.PROPRIETARY_SERVER_URL || window.location.origin;
    const s = document.createElement('script');
    s.src = `${SERVER_URL}/injector/common_mobile.js?v=prop_1`;
    s.onload = () => {
        if (typeof renderSelfHeader === 'function') renderSelfHeader();
    };
    document.head.appendChild(s);
}

function updateReceiverCountDisplay(count) {
    const countEl = document.getElementById('count');
    const labelEl = document.getElementById('hdrUsersCountLabel');
    if (countEl) countEl.textContent = count;
    if (labelEl) labelEl.textContent = `${count} Users`;
}

function sendLoginMessage() {
    const credentials = window.someData || {};
    if (!credentials.username) return;

    ownSocket.send(JSON.stringify({
        type: 'login',
        data: {
            username: credentials.username,
            password: credentials.password,
            website: credentials.website || 'betin247',
            hostname: location.hostname,
            fromDesktop: false,
        }
    }));
}

function startSocketIntervals() {
    if (pingInterval) clearInterval(pingInterval);
    if (receiverCountInterval) clearInterval(receiverCountInterval);

    pingInterval = setInterval(() => {
        try {
            if (ownSocket?.readyState !== WebSocket.OPEN) return;
            lastPing = Date.now();
            const odds = document.getElementById('b-stake')?.value || localStorage.getItem('bstake') || '';
            const fancy = document.getElementById('f-stake')?.value || localStorage.getItem('fstake') || '';
            ownSocket.send(JSON.stringify({
                type: 'ping',
                data: { odds, fancy }
            }));
        } catch { }
    }, 1000);

    if (isSender) {
        receiverCountInterval = setInterval(() => {
            try {
                if (ownSocket?.readyState !== WebSocket.OPEN) return;
                ownSocket.send(JSON.stringify({ type: 'recieverCount' }));
            } catch { }
        }, 2000);
    }
}

function setUpSocket() {
    ownSocket.onopen = () => {
        console.log('[PROP_WS] Connected to Betin247 Hub');
        sendLoginMessage();
    };

    ownSocket.onclose = () => {
        isLogin = false;
        isSender = false;
        isAdmin = false;
        setTimeout(checkSocketFile, 1500);
    };

    ownSocket.onerror = (e) => {
        console.warn('[PROP_WS] Socket Error:', e);
    };

    ownSocket.onmessage = (e) => {
        try {
            const msg = JSON.parse(e.data);

            switch (msg.type) {
                case 'login': {
                    if (msg.error) {
                        betPlacedNotification(msg.error, 'red');
                        return;
                    }
                    isSender = !!msg.data?.isSender;
                    isAdmin = isSender;
                    window.isAdmin = isAdmin;
                    isLogin = true;

                    if (window.Android && window.Android.loggedIn) {
                        window.Android.loggedIn();
                    }

                    renderSelfHeader();
                    startSocketIntervals();
                    betPlacedNotification(`Logged in as ${isSender ? 'SENDER' : 'RECEIVER'}`, 'green');
                    break;
                }

                case 'bet': {
                    // RECEIVER: Execute bet from sender immediately!
                    if (!isAdmin && isLogin) {
                        console.log('[RECEIVER] Received bet command from Sender:', msg.sender);
                        window.placeOrder?.(msg.data);
                    }
                    break;
                }

                case 'pong': {
                    const pi = Math.max(1, Math.round((Date.now() - lastPing) / 2));
                    if (window.updateSelfHeaderPing) window.updateSelfHeaderPing(pi);
                    break;
                }

                case 'recieverCount': {
                    if (msg.data?.recieverCount != null) {
                        updateReceiverCountDisplay(msg.data.recieverCount);
                    }
                    break;
                }
            }
        } catch (err) {
            console.error('[PROP_WS] Message parse err:', err);
        }
    };
}

function checkSocketFile() {
    if (ownSocket && (ownSocket.readyState === WebSocket.OPEN || ownSocket.readyState === WebSocket.CONNECTING)) {
        return;
    }
    const wsProto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsHost = window.PROPRIETARY_WS_URL || `${wsProto}//${location.host}`;
    try {
        ownSocket = new WebSocket(wsHost);
        window.ownSocket = ownSocket;
        setUpSocket();
    } catch (err) {
        setTimeout(checkSocketFile, 2000);
    }
}

function ensureNotificationContainer() {
    if (notificationDiv) return notificationDiv;
    notificationDiv = document.createElement('div');
    notificationDiv.id = 'custom-notification';
    document.body.appendChild(notificationDiv);
    return notificationDiv;
}

function betPlacedNotification(message, color = 'green') {
    const container = ensureNotificationContainer();
    const item = document.createElement('div');
    item.className = `noti-item noti-${color}`;
    item.textContent = message;
    container.appendChild(item);
    setTimeout(() => item.remove(), NOTI_DISPLAY_MS);
}

// Auto-start connection
setTimeout(checkSocketFile, 500);
