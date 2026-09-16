// lib/slide.js
import { generateImageUrl } from './img.js';

/**
 * Merender slide presentasi ke dalam DOM element.
 * @param {Object} presentationData - Data JSON dari core.js
 * @param {HTMLElement} containerElement - Elemen tempat slide dirender
 */
export function renderSlides(presentationData, containerElement) {
  containerElement.innerHTML = '';
  const slides = presentationData.slides || [];

  slides.forEach((slide, index) => {
    const slideCard = document.createElement('div');
    slideCard.className = `slide-item ${index === 0 ? 'block' : 'hidden'} bg-slate-900 rounded-2xl border border-slate-800 shadow-2xl overflow-hidden transition-all duration-300`;
    slideCard.dataset.slideIndex = index;

    const imgUrl = generateImageUrl(slide.image_prompt);

    const bulletListHtml = (slide.content || []).map(item => `
      <li class="flex items-start space-x-3 text-slate-200 text-sm md:text-base leading-relaxed">
        <span class="text-emerald-400 mt-1 flex-shrink-0">✦</span>
        <span>${item}</span>
      </li>
    `).join('');

    slideCard.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
        <!-- Bagian Konten Teks Slide -->
        <div class="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
              <span class="text-xs font-mono font-bold text-emerald-400 bg-emerald-950/80 px-3 py-1 rounded-full border border-emerald-800">
                SLIDE ${slide.slide_number || index + 1} / ${slides.length}
              </span>
              <span class="text-xs text-slate-400 font-medium">${presentationData.title || ''}</span>
            </div>

            <h2 class="text-2xl md:text-3xl font-extrabold text-white leading-tight">
              ${slide.title}
            </h2>

            ${slide.summary ? `<p class="text-sm text-slate-400 italic border-l-2 border-emerald-500 pl-3">${slide.summary}</p>` : ''}

            <ul class="space-y-3 pt-2">
              ${bulletListHtml}
            </ul>
          </div>

          <!-- Catatan Pengajar / Speaker Notes -->
          ${slide.speaker_notes ? `
            <div class="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-400 space-y-1">
              <span class="font-bold text-amber-400 uppercase tracking-wider block">💡 Catatan Pengajar:</span>
              <p>${slide.speaker_notes}</p>
            </div>
          ` : ''}
        </div>

        <!-- Bagian Gambar Ilustrasi Pollinations -->
        <div class="lg:col-span-5 bg-slate-950 relative flex items-center justify-center min-h-[300px] lg:min-h-full border-t lg:border-t-0 lg:border-l border-slate-800 overflow-hidden">
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 text-xs gap-2 p-6 text-center z-10" id="loader-${index}">
            <div class="w-6 h-6 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
            <span>Memuat Ilustrasi Pollinations...</span>
          </div>

          <img 
            id="img-${index}"
            src="${imgUrl}" 
            alt="${slide.title}" 
            class="w-full h-full object-cover relative z-20 transition-opacity duration-500 opacity-0"
          />
        </div>
      </div>
    `;

    containerElement.appendChild(slideCard);

    // Attach Event Handler via JavaScript langsung (mencegah error escaping HTML attribute)
    const imgElement = slideCard.querySelector(`#img-${index}`);
    const loaderElement = slideCard.querySelector(`#loader-${index}`);

    if (imgElement && loaderElement) {
      imgElement.onload = () => {
        imgElement.classList.remove('opacity-0');
        loaderElement.style.display = 'none';
      };

      imgElement.onerror = () => {
        imgElement.style.display = 'none';
        loaderElement.className = 'absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950 z-20 space-y-3';
        loaderElement.innerHTML = `
          <div class="w-12 h-12 rounded-full bg-rose-950/80 border border-rose-800/80 flex items-center justify-center text-rose-400 font-bold text-lg shadow-lg">
            ⚠️
          </div>
          <div class="space-y-1">
            <p class="text-xs font-bold text-rose-400 tracking-wide uppercase">Gambar Gagal Dimuat</p>
            <p class="text-[11px] text-slate-400 max-w-[200px] leading-relaxed">
              Koneksi terputus atau server Pollinations tidak merespons.
            </p>
          </div>
        `;
      };
    }
  });
}