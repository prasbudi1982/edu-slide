// lib/img.js - FINAL 1 WORKER ONLY - polli-img.welybudiprasetya.workers.dev
// Worker ini sudah lengkap: WSRV -> Perchance -> Direct di dalam /image
// Client tetap ada fallback tambahan: Direct WSRV.NL -> Direct Pollinations -> Canvas

const IMG_WORKER = "https://polli-img.welybudiprasetya.workers.dev";
const MAX_PROMPT = 400;
let lastCall = 0;
let queue = Promise.resolve();

function sanitizePrompt(raw) {
  if (!raw) return "educational illustration";
  let clean = raw.replace(/[\r\n]+/g, " ").replace(/\s+/g, " ").trim();
  clean = clean.replace(/[^a-zA-Z0-9\s,.\-_]/g, " ").replace(/\s+/g, " ").trim();
  if (clean.length > MAX_PROMPT) {
    let cut = clean.slice(0, MAX_PROMPT);
    const lastSpace = cut.lastIndexOf(" ");
    if (lastSpace > MAX_PROMPT * 0.7) cut = cut.slice(0, lastSpace);
    clean = cut;
  }
  const suffix = ", educational, clean background, flat design";
  if ((clean + suffix).length > MAX_PROMPT) clean = clean.slice(0, MAX_PROMPT - suffix.length - 1);
  return clean + suffix;
}

async function waitRateLimit() {
  const now = Date.now();
  const elapsed = now - lastCall;
  const RATE = 5500;
  if (elapsed < RATE && lastCall !== 0) await new Promise(r => setTimeout(r, RATE - elapsed));
  lastCall = Date.now();
}

async function loadImageDirect(url, name) {
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.src = url + (url.includes('?') ? '&' : '?') + `t=${Date.now()}`;

  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      img.src = "";
      reject(new Error(`Timeout 20s via ${name}`));
    }, 20000);
    img.onload = () => {
      clearTimeout(timeout);
      if (img.naturalWidth < 50) {
        reject(new Error(`Invalid ${img.naturalWidth}x${img.naturalHeight} via ${name}`));
      } else {
        resolve();
      }
    };
    img.onerror = () => {
      clearTimeout(timeout);
      reject(new Error(`Load error via ${name}`));
    };
  });
  return img;
}

// Perchance via 1 worker yang sama (polli-img)
async function generatePerchanceViaWorker(prompt, w, h) {
  const keyRes = await fetch(`${IMG_WORKER}/perchance/verifyUser`, { method: "POST" });
  const keyText = await keyRes.text();
  const keyMatch = keyText.match(/([a-f0-9]{64})/i);
  if (!keyMatch) throw new Error("Perchance no userKey");
  const userKey = keyMatch[1];

  const resolution = w >= h ? "768x512" : "512x768";
  const params = new URLSearchParams({ prompt, resolution, seed: "-1", userKey });
  const genRes = await fetch(`${IMG_WORKER}/perchance/generate?${params.toString()}`);
  const genData = await genRes.json();
  const imageId = genData.imageId || genData.id;
  if (!imageId) throw new Error("Perchance no imageId");

  const dlUrl = `${IMG_WORKER}/perchance/download?imageId=${encodeURIComponent(imageId)}&userKey=${encodeURIComponent(userKey)}`;
  const img = await loadImageDirect(dlUrl, "PERCHANCE via polli-img");
  img._usedProxy = "perchance";
  return img;
}

export async function generateImageElement(promptText, width = 768, height = 512) {
  const base = (promptText || "educational illustration").trim();

  const task = async () => {
    await waitRateLimit();
    const finalPrompt = sanitizePrompt(base);
    const seed = Math.floor(Math.random() * 9999999);
    const model = "turbo";

    // URL untuk 1 worker yang sudah lengkap fallback
    const workerImageUrl = `${IMG_WORKER}/image?prompt=${encodeURIComponent(finalPrompt)}&width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true`;

    // Fallback direct (tanpa worker)
    const directPollUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(finalPrompt)}?width=${width}&height=${height}&seed=${seed}&model=${model}&nologo=true&enhance=false&private=true&referrer=eduslide&safe=true`;
    const wsrvDirectUrl = `https://wsrv.nl/?url=${encodeURIComponent(directPollUrl)}&w=${width}&h=${height}&output=jpg`;

    for (let attempt = 0; attempt < 2; attempt++) {
      
      // LAPIS 1: WSRV via polli-img worker /image (di dalam worker sudah WSRV -> Perchance -> Direct)
      try {
        console.log(`[img] Lapis 1 WSRV via 1 Worker attempt ${attempt+1}: "${finalPrompt.slice(0,50)}..."`);
        const img = await loadImageDirect(workerImageUrl, `1 WORKER WSRV (${IMG_WORKER}/image)`);
        console.log(`[img] ✅ SUCCESS via 1 Worker WSRV ${img.naturalWidth}x${img.naturalHeight}`);
        img._finalPrompt = finalPrompt;
        img._usedProxy = "wsrv";
        return img;
      } catch (e) {
        console.warn(`[img] Lapis 1 WSRV Worker gagal: ${e.message}`);
      }

      // LAPIS 2: Perchance via worker yang sama (explicit)
      try {
        console.log(`[img] Lapis 2 Perchance via 1 Worker attempt ${attempt+1}`);
        const img = await generatePerchanceViaWorker(finalPrompt, width, height);
        console.log(`[img] ✅ SUCCESS Perchance ${img.naturalWidth}x${img.naturalHeight}`);
        img._finalPrompt = finalPrompt;
        return img;
      } catch (e) {
        console.warn(`[img] Lapis 2 Perchance gagal: ${e.message}`);
      }

      // LAPIS 3: Direct
      const directUrls = [
        { url: wsrvDirectUrl, name: "WSRV.NL DIRECT" },
        { url: directPollUrl, name: "POLLINATIONS DIRECT" },
      ];
      for (const { url, name } of directUrls) {
        try {
          console.log(`[img] Lapis 3 ${name} attempt ${attempt+1}`);
          const img = await loadImageDirect(url, name);
          console.log(`[img] ✅ SUCCESS ${name} ${img.naturalWidth}x${img.naturalHeight}`);
          img._finalPrompt = finalPrompt;
          img._usedProxy = name.toLowerCase().includes("wsrv") ? "wsrv-direct" : "direct";
          return img;
        } catch (e) {
          console.warn(`[img] ${name} gagal: ${e.message}`);
        }
      }

      if (attempt === 0) {
        await new Promise(r => setTimeout(r, 2500));
        await waitRateLimit();
      }
    }

    throw new Error("All proxies failed");
  };

  const resultPromise = queue.then(() => task()).catch(() => task());
  queue = resultPromise.then(() => {}).catch(() => {});

  try {
    return await resultPromise;
  } catch (e) {
    console.warn(`[img] Lapis 4 Canvas fallback: ${e.message}`);
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createLinearGradient(0,0,width,height);
    grad.addColorStop(0,'#0f172a'); grad.addColorStop(1,'#1e293b');
    ctx.fillStyle=grad; ctx.fillRect(0,0,width,height);
    ctx.fillStyle='#fff'; ctx.font='bold 12px sans-serif'; ctx.textAlign='center';
    ctx.fillText(base.slice(0,40),width/2,height/2,width*0.8);
    ctx.fillStyle='#f87171'; ctx.font='10px sans-serif';
    ctx.fillText(e.message.slice(0,60),width/2,height/2+20,width*0.9);
    const ph=new Image(); ph.src=canvas.toDataURL('image/png'); ph._usedProxy='canvas';
    await new Promise(r=>{ if(ph.complete) r(); else ph.onload=r; });
    return ph;
  }
}

export async function generateImageUrl(promptText, width = 768, height = 512) {
  const el = await generateImageElement(promptText, width, height);
  return el.src;
}
