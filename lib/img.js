// lib/img.js
/**
 * Menghasilkan URL gambar langsung dari Pollinations AI yang stabil & bebas error.
 * @param {string} promptText - deskripsi visual dari AI
 * @param {number} width - lebar gambar (default: 1024)
 * @param {number} height - tinggi gambar (default: 768)
 * @returns {string} URL gambar Pollinations yang valid
 */
export function generateImageUrl(promptText, width = 1024, height = 768) {
  // 1. Prompt default jika kosong
  let basePrompt = promptText && promptText.trim().length > 0 
    ? promptText 
    : "educational presentation slide illustration, minimal vector style, high quality";

  // 2. Sanitasi String: Hapus karakter khusus, kutip, breakline, dan simbol tak terlindungi
  basePrompt = basePrompt
    .replace(/[\r\n]+/g, " ")
    .replace(/["'\\/]/g, "")
    .replace(/[^\w\s,.-]/gi, "")
    .trim();

  // Tambahkan tag gaya visual agar konsisten
  const fullPrompt = `${basePrompt}, clean educational vector illustration, simple background`;

  // 3. Encode URI Component untuk keamanan query parameter URL
  const encodedPrompt = encodeURIComponent(fullPrompt);

  // 4. Seed acak untuk variasi visual
  const seed = Math.floor(Math.random() * 899999) + 100000;

  // 5. URL Endpoint Resmi Pollinations Image Generator
  return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&seed=${seed}&nologo=true&enhance=false`;
}