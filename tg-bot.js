const fetch = require('node-fetch');
const TelegramBot = require('node-telegram-bot-api');

// dotenv yüklemesini opsiyonel yapalım, belki .env dosyası kullanmak istersiniz
require('dotenv').config();

// Kendi Telegram Bot Token'ınızı buraya yazın veya .env dosyasına TELEGRAM_BOT_TOKEN olarak ekleyin
const token = process.env.TELEGRAM_BOT_TOKEN || '8313873916:AAGxlvQxKaUZMbeBQUPg1LOJC9-2E3W2j1k';

// Bot token'ı kontrol et
if (token === 'BURAYA_TELEGRAM_BOT_TOKENINIZI_YAZIN') {
    console.error("❌ HATA: Lütfen bot.js dosyasındaki Telegram bot token'ınızı güncelleyin!");
    process.exit(1);
}

// Sadece sizin kullanmanızı sağlamak için yetkili Chat ID (Telegram Kullanıcı ID'niz)
// Kendi ID'nizi öğrenmek için Telegram'da @userinfobot 'a mesaj atabilirsiniz.
const ALLOWED_USER_ID = process.env.ALLOWED_USER_ID || '6698095710';


// Bot'u polling (sürekli dinleme) modunda başlat
const bot = new TelegramBot(token, { polling: true });

// RENDER.COM İÇİN DUMMY WEB SUNUCUSU (Sistemin çökmemsi için şarttır)
const http = require('http');
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('Bot aktif ve calisiyor!\n');
});
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🌍 Dummy web sunucusu port ${PORT} üzerinde dinleniyor (Render için)`);
});


const CLOUDFLARE_WORKER_URL = "https://little-river-67d2.yusufsaglm3.workers.dev"; 

// Ortak başlıklar
const commonHeaders = {
    "Accept": "application/json",
    "Accept-Language": "tr-TR,tr;q=0.7",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Origin": "https://ubigi.me",
    "Referer": "https://ubigi.me/",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/148.0.0.0 Safari/537.36",
    "X-Application-Version": "3.7.0"
};

// --- YARDIMCI FONKSİYONLAR ---

function generateRandomPassword() {
    const chars = 'abcdef0123456789';
    let res = '';
    for (let i = 0; i < 16; i++) res += chars[Math.floor(Math.random() * chars.length)];
    return res + "A1!";
}

function generateCustomEmail() {
    const randomString = Math.random().toString(36).substring(2, 10);
    return `${randomString}@yusuf1548.shop`; 
}

function extractCookies(response, previousCookies = "") {
    let cookieString = previousCookies;
    let rawCookies = [];
    if (typeof response.headers.getSetCookie === 'function') {
        rawCookies = response.headers.getSetCookie();
    } else if (response.headers.raw && response.headers.raw()['set-cookie']) {
        rawCookies = response.headers.raw()['set-cookie'];
    }
    if (rawCookies && rawCookies.length > 0) {
        rawCookies.forEach(c => {
            let cookie = c.split(';')[0];
            let cookieName = cookie.split('=')[0];
            let regex = new RegExp(`${cookieName}=[^;]+`, 'g');
            if (cookieString.match(regex)) {
                cookieString = cookieString.replace(regex, cookie);
            } else {
                cookieString = cookieString ? `${cookieString}; ${cookie}` : cookie;
            }
        });
    }
    return cookieString;
}

async function checkInboxForOTP(officialEmail) {
    try {
        const url = `${CLOUDFLARE_WORKER_URL}?email=${encodeURIComponent(officialEmail)}`;
        const res = await fetch(url);
        if (!res.ok) return null;
        const data = await res.json();
        if (data && data.otp) return data.otp;
    } catch (err) {}
    return null;
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- ANA ÜRETİM FONKSİYONU ---
// Sadece başarı veya hata objesi döner. Console çıktıları veya loglar silindi.
async function generateEsim() {
    try {
        const resmiEmail = generateCustomEmail();
        const randomPassword = generateRandomPassword();
        let activeCookies = "";
        
        // 1. KAYIT
        const registerRes = await fetch("https://ubigi.me/scapi/accounts", {
            method: "POST",
            headers: { ...commonHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({
                countryOfResidence: "TR",
                email: resmiEmail,
                firstName: "deneme",
                language: "tr-TR",
                lastName: "deneme",
                password: randomPassword,
                source: "SFC_WEB"
            })
        });
        if (!registerRes.ok) throw new Error("Kayıt başarısız");
        activeCookies = extractCookies(registerRes); 

        // 2. DOĞRULAMA MAİLİ TETİKLE
        const generateRes = await fetch("https://ubigi.me/scapi/accounts/email-validation-code/generate", {
            method: "POST",
            headers: { ...commonHeaders, "Content-Type": "application/json", "Cookie": activeCookies },
            body: JSON.stringify({ email: resmiEmail })
        });
        activeCookies = extractCookies(generateRes, activeCookies);

        // 3. OTP BEKLEME (120 sn maks)
        let otpCode = null;
        for (let i = 0; i < 24; i++) {
            await sleep(5000); 
            otpCode = await checkInboxForOTP(resmiEmail);
            if (otpCode) break;
        }
        if (!otpCode) throw new Error("Doğrulama kodu gelmedi");
        
        // 4. KODU DOĞRULA
        const verifyRes = await fetch("https://ubigi.me/scapi/accounts/email-validation-code/verify", {
            method: "POST",
            headers: { ...commonHeaders, "Content-Type": "application/json", "Cookie": activeCookies },
            body: JSON.stringify({ email: resmiEmail, code: String(otpCode).trim() })
        });
        if (!verifyRes.ok) throw new Error("Ubigi Kodu Reddetti");
        activeCookies = extractCookies(verifyRes, activeCookies);

        // 5. LOGIN
        const loginRes = await fetch("https://ubigi.me/scapi/auth/login", {
            method: "POST",
            headers: { ...commonHeaders, "Content-Type": "application/json" },
            body: JSON.stringify({ username: resmiEmail, password: randomPassword })
        });
        if (!loginRes.ok) throw new Error("Login başarısız");
        activeCookies = extractCookies(loginRes);

        // 6. TRAVELER DETAILS (mvnoRef için)
        const travelerRes = await fetch("https://ubigi.me/scapi/travelers/details", {
            method: "GET",
            headers: { ...commonHeaders, "Cookie": activeCookies }
        });
        activeCookies = extractCookies(travelerRes, activeCookies);
        const travelerBody = await travelerRes.text();
        
        let mvnoRef = "Ubigi"; 
        try {
            const travelerData = JSON.parse(travelerBody);
            if (travelerData.mvnoRef) mvnoRef = travelerData.mvnoRef;
        } catch (e) {}

        // 7. REWARDS (KAMPANYA KODU UYGULA)
        const rewardRes = await fetch("https://ubigi.me/scapi/accounts/me/rewards", {
            method: "POST",
            headers: { ...commonHeaders, "Content-Type": "application/json", "Cookie": activeCookies },
            body: JSON.stringify({ campaignCode: "PLC_WW500MB2D_10POFF" })
        });
        activeCookies = extractCookies(rewardRes, activeCookies);
        const rewardData = await rewardRes.json();
        
        let giftVoucher = null;
        if (rewardData.rewards) {
            giftVoucher = rewardData.rewards.find(r => r.type === 'gift');
        }

        // 8. VOUCHERS (PRODUCT ID İÇİN)
        const vouchersRes = await fetch("https://ubigi.me/scapi/accounts/me/vouchers", {
            method: "GET",
            headers: { ...commonHeaders, "Cookie": activeCookies }
        });
        activeCookies = extractCookies(vouchersRes, activeCookies);
        const vouchersBody = await vouchersRes.text();
        
        let giftProductId = "WW_901O_STACK_ONEOFF_WORLD_500MB_2D_PLC";
        try {
            const vouchersData = JSON.parse(vouchersBody);
            const list = vouchersData.vouchers || vouchersData;
            for (const v of list) {
                if (v.type === 'gift' && v.gift && v.gift.productId) {
                    giftProductId = v.gift.productId;
                }
            }
        } catch (e) {}

        // 9. GIFT REDEEM (SIM OLUŞTURMA)
        if (giftVoucher) {
            const giftRes = await fetch("https://ubigi.me/scapi/accounts/me/gift", {
                method: "POST",
                headers: { ...commonHeaders, "Content-Type": "application/json", "Cookie": activeCookies },
                body: JSON.stringify({ 
                    voucherCode: giftVoucher.id, 
                    productId: giftProductId, 
                    source: "SFC_WEB",
                    mvnoRef: mvnoRef
                })
            });
            activeCookies = extractCookies(giftRes, activeCookies);
        }

        // 10. HESAP DURUMU / SIM HAZIR BEKLEME
        for (let attempt = 1; attempt <= 15; attempt++) {
            await fetch("https://ubigi.me/scapi/accounts/me?refreshSim=true", {
                method: "GET",
                headers: { ...commonHeaders, "Cookie": activeCookies }
            });
            await sleep(4000);
            
            const checkRes = await fetch("https://ubigi.me/scapi/accounts/me", {
                method: "GET",
                headers: { ...commonHeaders, "Cookie": activeCookies }
            });
            activeCookies = extractCookies(checkRes, activeCookies);
            try {
                const d = await checkRes.json();
                if (d.iccid || d.msisdn) break; // Hazır!
            } catch (e) {}
        }

        // 11. ESIM KODUNU ÇEKME
        let esimData = null;
        for (let i = 1; i <= 15; i++) {
            const esimRes = await fetch("https://ubigi.me/scapi/sims/activationCode", {
                method: "GET",
                headers: { ...commonHeaders, "Cookie": activeCookies }
            });
            activeCookies = extractCookies(esimRes, activeCookies);
            
            if (esimRes.status === 200) {
                const body = await esimRes.text();
                if (body.length > 0) {
                    try {
                        const data = JSON.parse(body);
                        if (data.activationCode) {
                            esimData = data;
                            break;
                        }
                    } catch (err) {}
                }
            }
            await sleep(4000);
        }

        if (!esimData) {
            throw new Error("eSIM Aktivasyon Kodu alınamadı");
        }

        // İşlem Tamam! Sonuçları dönüyoruz.
        return {
            success: true,
            email: resmiEmail,
            password: randomPassword,
            activationCode: esimData.activationCode,
            qrCodeData: esimData.qrCode ? esimData.qrCode.dataUrl : null
        };

    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

// --- TELEGRAM BOT MANTIĞI ---

console.log("🤖 Telegram Botu başlatıldı ve mesajları dinliyor...");

// Aktif işlemleri takip etmek için (birden fazla kişinin aynı anda botu kullanmasını yönetmek için)
const activeJobs = new Map();

bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    
    // Yetki Kontrolü
    if (ALLOWED_USER_ID !== 'BURAYA_KENDI_CHAT_IDNIZI_YAZIN' && chatId.toString() !== ALLOWED_USER_ID) {
        return bot.sendMessage(chatId, `🚫 Yetkisiz erişim! Bu bot özeldir ve başkası tarafından kullanılamaz.\nSizin Chat ID'niz: ${chatId}`);
    }

    bot.sendMessage(chatId, "👋 Merhaba! Ben Ubigi eSIM Botuyum.\n\nBir veya birden fazla eSIM üretmek için komutu şu şekilde kullanabilirsiniz:\n\n`/uret <sayı>`\n\nÖrnek: `/uret 1` veya `/uret 3`", { parse_mode: "Markdown" });
});

bot.onText(/\/uret (\d+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    
    // Yetki Kontrolü
    if (ALLOWED_USER_ID !== 'BURAYA_KENDI_CHAT_IDNIZI_YAZIN' && chatId.toString() !== ALLOWED_USER_ID) {
        return bot.sendMessage(chatId, `🚫 Yetkisiz işlem denemesi.`);
    }

    const count = parseInt(match[1]);

    if (count < 1 || count > 10) {
        return bot.sendMessage(chatId, "Lütfen 1 ile 10 arasında bir sayı girin. (Örn: /uret 2)");
    }

    if (activeJobs.has(chatId) && activeJobs.get(chatId)) {
        return bot.sendMessage(chatId, "Şu anda devam eden bir işleminiz var. Lütfen tamamlanmasını bekleyin.");
    }

    activeJobs.set(chatId, true);
    
    // Geçen süreyi takip etmek için işlem başlangıç zamanı
    const startTime = Date.now();
    let loadingMessage = null;

    try {
        loadingMessage = await bot.sendMessage(chatId, `⏳ *${count} adet* eSIM üretimi başlatıldı. Lütfen bekleyin... (Bu işlem her eSIM için yaklaşık 1-2 dakika sürebilir)`, { parse_mode: "Markdown" });

        for (let i = 1; i <= count; i++) {
            // Her bir eSIM için süreci bildir
            await bot.editMessageText(`⚙️ *${i}/${count}* numaralı eSIM üretiliyor... Lütfen bekleyin.`, {
                chat_id: chatId,
                message_id: loadingMessage.message_id,
                parse_mode: "Markdown"
            });

            const result = await generateEsim();

            if (result.success) {
                // QR kodu base64 formatından buffera çevirip gönder
                if (result.qrCodeData) {
                    const base64Data = result.qrCodeData.replace(/^data:image\/png;base64,/, "");
                    const buffer = Buffer.from(base64Data, 'base64');
                    
                    const caption = `✅ *eSIM ${i}/${count} Üretildi!*\n\n` +
                                  `📲 *LPA Aktivasyon Kodu:*\n\`${result.activationCode}\``;
                    
                    await bot.sendPhoto(chatId, buffer, { 
                        caption: caption,
                        parse_mode: "Markdown"
                    });
                } else {
                    // QR kodu yoksa sadece mesaj at
                    const text = `✅ *eSIM ${i}/${count} Üretildi!*\n\n` +
                               `📲 *LPA Aktivasyon Kodu:*\n\`${result.activationCode}\``;
                    
                    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
                }
            } else {
                await bot.sendMessage(chatId, `❌ *${i}/${count}* numaralı eSIM üretimi başarısız oldu:\nHata: ${result.error}`, { parse_mode: "Markdown" });
            }
        }
        
        const totalTime = Math.round((Date.now() - startTime) / 1000);
        await bot.sendMessage(chatId, `🎉 İstenilen *${count} adet* eSIM işlemi tamamlandı! (Toplam süre: ${totalTime} saniye)`, { parse_mode: "Markdown" });

    } catch (err) {
        bot.sendMessage(chatId, "Beklenmeyen bir hata oluştu: " + err.message);
    } finally {
        activeJobs.set(chatId, false);
        // İşlem bitince son loading mesajını temizle (istenirse)
        if (loadingMessage) {
            try {
                await bot.deleteMessage(chatId, loadingMessage.message_id);
            } catch (e) {} // Mesaj zaten silindiyse hata verme
        }
    }
});

// Bilinmeyen bir komut girilirse
bot.on('message', (msg) => {
    const chatId = msg.chat.id;
    if (msg.text && !msg.text.startsWith('/')) {
        bot.sendMessage(chatId, "Lütfen bir komut girin. Yardım için /start yazabilirsiniz.");
    }
});
