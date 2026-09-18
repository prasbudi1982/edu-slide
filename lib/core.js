// lib/core.js - FINAL + penanganan semua error Groq dengan pesan rapi untuk UI

import { Cache } from './cache.js';

const WORKER_URL = "https://edu-slide.welybudiprasetya.workers.dev";
const MODEL = "openai/gpt-oss-120b";

function toUserFriendlyError(err, res, text) {
  const raw = (text || err?.message || '').toLowerCase();
  const status = res?.status || 0;

  // Network / fetch gagal
  if (err?.name === 'TypeError' && err.message.includes('fetch')) {
    return {
      title: "Koneksi Gagal",
      message: "Tidak dapat terhubung ke Worker Groq. Periksa koneksi internet atau Worker sedang offline.",
      detail: `${WORKER_URL} tidak merespon`,
      code: "NETWORK_ERROR"
    };
  }

  // Groq key belum di-set
  if (raw.includes("groq_api_key") || raw.includes("not set") || raw.includes("api key")) {
    return {
      title: "Konfigurasi Worker Belum Lengkap",
      message: "GROQ_API_KEY belum diatur di Cloudflare Worker.",
      detail: "Buka dash.cloudflare.com → Workers → edu-slide → Settings → Variables → Tambah Secret GROQ_API_KEY",
      code: "GROQ_KEY_MISSING"
    };
  }

  // Rate limit
  if (status === 429 || raw.includes("rate limit") || raw.includes("too many requests")) {
    return {
      title: "Batas Penggunaan Tercapai",
      message: "Groq membatasi request terlalu cepat. Coba lagi dalam 30-60 detik.",
      detail: text?.slice(0, 300) || "429 Too Many Requests",
      code: "RATE_LIMIT"
    };
  }

  // Timeout / overload
  if (raw.includes("timeout") || raw.includes("overloaded") || status === 503 || status === 504) {
    return {
      title: "Server Sibuk",
      message: "Model Groq sedang sibuk atau timeout. Coba generate ulang.",
      detail: text?.slice(0, 300) || "Server overload",
      code: "SERVER_BUSY"
    };
  }

  // Worker error 500
  if (status >= 500) {
    return {
      title: "Worker Error",
      message: "Terjadi kesalahan di sisi Worker Groq.",
      detail: text?.slice(0, 400) || `Status ${status}`,
      code: `WORKER_${status}`
    };
  }

  // Bad request / model salah
  if (status === 400 || raw.includes("invalid") || raw.includes("model")) {
    return {
      title: "Permintaan Tidak Valid",
      message: "Model atau format request tidak valid.",
      detail: text?.slice(0, 400),
      code: "BAD_REQUEST"
    };
  }

  // JSON parse gagal (Groq return bukan JSON)
  if (raw.includes("bukan json") || raw.includes("unexpected token") || raw.includes("json")) {
    return {
      title: "Format Respons Salah",
      message: "Groq mengembalikan format yang tidak sesuai. Coba generate ulang.",
      detail: text?.slice(0, 400),
      code: "INVALID_JSON"
    };
  }

  // Content kosong
  if (raw.includes("tidak return content") || raw.includes("no content")) {
    return {
      title: "Respons Kosong",
      message: "Groq tidak mengembalikan materi. Coba topik lebih spesifik.",
      detail: text?.slice(0, 400),
      code: "EMPTY_CONTENT"
    };
  }

  // Fallback
  return {
    title: "Gagal Generate",
    message: err?.message ? err.message.slice(0, 200) : "Terjadi kesalahan tidak diketahui.",
    detail: text ? text.slice(0, 400) : err?.stack?.slice(0, 400) || "",
    code: `ERROR_${status || 'UNKNOWN'}`
  };
}

export async function generatePresentationData(topic, audience, slideCount = 5) {
  Cache.clear();

  const systemPrompt = `Kamu adalah spesialis kurikulum. Buat bahan ajar presentasi mendalam, terstruktur.
WAJIB output JSON murni tanpa markdown, tanpa penjelasan di luar JSON.
Format:
{
  "title": "Judul Utama",
  "subtitle": "Sub-judul",
  "slides": [
    {
      "slide_number": 1,
      "title": "Judul Slide",
      "summary": "Ringkasan singkat",
      "content": ["Poin detail 1", "Poin detail 2", "Poin detail 3"],
      "speaker_notes": "Catatan pengajar",
      "image_prompt": "English visual description max 15 words"
    }
  ]
}`;

  const userPrompt = `Buatkan bahan ajar:
- Topik: "${topic}"
- Audiens: ${audience}
- Jumlah Slide: ${slideCount}
- Bahasa sesuai audiens, penjelasan rinci, image_prompt Inggris max 15 kata simple.`;

  const payload = {
    model: MODEL,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ],
    temperature: 0.5,
    response_format: { type: "json_object" }
  };

  let res, text;
  try {
    res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    text = await res.text();
  } catch (fetchErr) {
    const friendly = toUserFriendlyError(fetchErr, null, null);
    const err = new Error(friendly.message);
    err.ui = friendly;
    throw err;
  }

  if (!res.ok) {
    const friendly = toUserFriendlyError(new Error(text), res, text);
    const err = new Error(friendly.message);
    err.ui = friendly;
    err.status = res.status;
    throw err;
  }

  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    const friendly = toUserFriendlyError(e, res, text);
    friendly.title = "Respons Worker Bukan JSON";
    const err = new Error(friendly.message);
    err.ui = friendly;
    throw err;
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) {
    const friendly = toUserFriendlyError(new Error("no content"), res, JSON.stringify(data).slice(0, 500));
    const err = new Error(friendly.message);
    err.ui = friendly;
    throw err;
  }

  let presentationData;
  try {
    presentationData = JSON.parse(content);
  } catch (e) {
    try {
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      presentationData = JSON.parse(cleaned);
    } catch (e2) {
      const friendly = toUserFriendlyError(e2, res, content);
      const err = new Error(friendly.message);
      err.ui = friendly;
      throw err;
    }
  }

  if (!presentationData.slides || presentationData.slides.length === 0) {
    const friendly = {
      title: "Data Tidak Lengkap",
      message: "Groq mengembalikan data tanpa slide.",
      detail: JSON.stringify(presentationData).slice(0, 400),
      code: "NO_SLIDES"
    };
    const err = new Error(friendly.message);
    err.ui = friendly;
    throw err;
  }

  Cache.save(presentationData);
  return presentationData;
}

export function loadFromCache() {
  return Cache.load();
}

export function getSlideFromCache(index) {
  return Cache.getSlide(index);
}

export { Cache };
