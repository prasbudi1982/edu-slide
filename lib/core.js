// lib/core.js - FIXED untuk worker minimal
const WORKER_URL = "https://edu-slide.welybudiprasetya.workers.dev";
const GROQ_MODEL = "openai/gpt-oss-120b";

export async function generatePresentationData(topic, audience, slideCount = 5) {
  const systemPrompt = `Kamu adalah seorang spesialis kurikulum dan pembuat bahan ajar profesional. 
Tugasmu adalah menyusun materi presentasi yang mendalam, terstruktur, komprehensif, dan mudah dipahami.
WAJIB memberikan output JSON murni tanpa sintaks markdown (\`\`\`json).

Struktur JSON wajib:
{
  "title": "Judul Utama Presentasi",
  "subtitle": "Sub-judul / Gambaran Umum",
  "slides": [
    {
      "slide_number": 1,
      "title": "Judul Slide",
      "summary": "Ringkasan konsep utama slide ini",
      "content": [
        "Poin detail 1 beserta penjelasan mendalam",
        "Poin detail 2 beserta penjelasan mendalam",
        "Poin detail 3 beserta contoh/aplikasi"
      ],
      "speaker_notes": "Catatan pengajar/presenter untuk menjelaskan slide ini lebih jauh.",
      "image_prompt": "English visual description for AI image generator depicting the scene or concept clearly, minimal vector art, clean background"
    }
  ]
}`;

  const userPrompt = `Buatkan bahan ajar presentasi yang detail dan mendalam:
- Detail Topik/Instruksi: "${topic}"
- Target Audiens: ${audience}
- Jumlah Slide: ${slideCount} Slide

Instruksi Tambahan:
- Sesuaikan bahasa dan bahasa penyampaian dengan target audiens (${audience}).
- Berikan penjelasan yang rinci pada poin-poin slide, jangan hanya potongan kata.
- Visual prompt gambar WAJIB ditulis dalam Bahasa Inggris deskriptif.`;

  console.log("Mengirim ke Worker:", WORKER_URL);

  const response = await fetch(WORKER_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.5,
      response_format: { type: "json_object" }
    })
  });

  const text = await response.text();
  console.log("Raw response dari Worker:", text.slice(0, 500));

  if (!response.ok) {
    try {
      const errJson = JSON.parse(text);
      throw new Error(errJson.error?.message || errJson.error || text);
    } catch {
      throw new Error(text);
    }
  }

  const data = JSON.parse(text);
  const rawContent = data.choices?.[0]?.message?.content;

  if (!rawContent) throw new Error("Groq tidak mengembalikan content: " + text.slice(0, 500));

  try {
    return JSON.parse(rawContent);
  } catch (err) {
    throw new Error("Gagal parse JSON dari AI: " + err.message + " | Raw: " + rawContent.slice(0, 300));
  }
}
