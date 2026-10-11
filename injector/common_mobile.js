/**
 * Proprietary Betin247 Mobile Floating HUD
 */
const THEME = {
    bg: '#1a2332',
    color: '#ffffff',
    border: 'rgba(255,255,255,0.18)',
    primary: '#0855b1',
    success: '#1f6b52',
    warning: '#7d5e18',
    danger: '#a03333',
};

window.updateSelfHeaderPing = function (pingMs) {
    const el = document.getElementById('pingValue');
    const header = document.getElementById('headerCustom');
    if (el) el.textContent = `${pingMs}ms`;
    if (header) {
        if (pingMs <= 150) header.style.background = THEME.success;
        else if (pingMs <= 800) header.style.background = THEME.warning;
        else header.style.background = THEME.danger;
    }
};

window.__tpRenderSelfHeaderImpl = function () {
    const existing = document.getElementById('headerCustom');
    if (existing) existing.remove();

    const host = document.getElementById('tpHeaderHost') || document.body;
    const hud = document.createElement('div');
    hud.id = 'headerCustom';
    hud.style.cssText = `
        position: fixed;
        top: 12px;
        right: 12px;
        z-index: 2147483647;
        background: ${THEME.bg};
        border: 1px solid ${THEME.border};
        border-radius: 10px;
        padding: 6px 10px;
        color: #fff;
        font-family: -apple-system, sans-serif;
        font-size: 12px;
        display: flex;
        align-items: center;
        gap: 8px;
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
        pointer-events: auto;
        user-select: none;
    `;

    hud.innerHTML = `
        <div style="display:flex;align-items:center;gap:4px;font-weight:700;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:#4ade80;"></span>
            <span id="pingValue">--ms</span>
        </div>
        <div style="height:14px;width:1px;background:rgba(255,255,255,0.2);"></div>
        <div style="display:flex;align-items:center;gap:4px;">
            <span id="hdrUsersCountLabel" style="font-weight:600;color:#93c5fd;">0 Users</span>
        </div>
        <div style="height:14px;width:1px;background:rgba(255,255,255,0.2);"></div>
        <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:10px;opacity:0.8;">B:</span>
            <input id="b-stake" type="number" value="${localStorage.getItem('bstake') || '100'}" style="width:45px;padding:2px 4px;border-radius:4px;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:700;" />
        </div>
        <div style="display:flex;align-items:center;gap:4px;">
            <span style="font-size:10px;opacity:0.8;">F:</span>
            <input id="f-stake" type="number" value="${localStorage.getItem('fstake') || '100'}" style="width:45px;padding:2px 4px;border-radius:4px;border:none;background:rgba(255,255,255,0.15);color:#fff;font-size:11px;font-weight:700;" />
        </div>
    `;

    document.body.appendChild(hud);

    // Save stakes on change
    hud.querySelector('#b-stake')?.addEventListener('input', (e) => {
        localStorage.setItem('bstake', (e.target as HTMLInputElement).value);
    });
    hud.querySelector('#f-stake')?.addEventListener('input', (e) => {
        localStorage.setItem('fstake', (e.target as HTMLInputElement).value);
    });

    // Make HUD draggable
    let isDragging = false, startX = 0, startY = 0, initialLeft = 0, initialTop = 0;
    hud.addEventListener('touchstart', (e) => {
        if ((e.target as HTMLElement).tagName === 'INPUT') return;
        isDragging = true;
        const touch = e.touches[0];
        startX = touch.clientX;
        startY = touch.clientY;
        const rect = hud.getBoundingClientRect();
        initialLeft = rect.left;
        initialTop = rect.top;
    });

    window.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        const touch = e.touches[0];
        hud.style.left = `${initialLeft + (touch.clientX - startX)}px`;
        hud.style.top = `${initialTop + (touch.clientY - startY)}px`;
        hud.style.right = 'auto';
    });

    window.addEventListener('touchend', () => { isDragging = false; });
};
