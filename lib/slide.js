// lib/slide.js - Auto Theme (light/dark) + no blink + ⏳ di Next

import { generateImageElement } from './img.js';

let isImageLoading = false;
let currentSlideIndex = 0;

export function renderSlides(presentationData, containerElement, imageCache = new Map()) {
  containerElement.innerHTML = '';
  const slides = presentationData.slides || [];
  if (slides.length === 0) {
    containerElement.innerHTML = '<p class="text-slate-400 dark:text-slate-500 text-center py-10">Tidak ada slide dari cache</p>';
    return;
  }

  slides.forEach((slide, index) => {
    const slideCard = document.createElement('div');
    slideCard.className = `slide-item ${index === 0 ? 'block' : 'hidden'} bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-none overflow-hidden`;
    slideCard.dataset.slideIndex = index;

    const bulletListHtml = (slide.content || []).map(item => `
      <li class="flex items-start space-x-3 text-slate-700 dark:text-slate-200 text-sm md:text-base leading-relaxed">
        <span class="text-emerald-500 dark:text-emerald-400 mt-1 flex-shrink-0">✦</span>
        <span>${item}</span>
      </li>
    `).join('');

    slideCard.innerHTML = `
      <div class="grid grid-cols-1 lg:grid-cols-12 min-h-[520px]">
        <div class="lg:col-span-7 p-6 md:p-8 flex flex-col justify-between space-y-6">
          <div class="space-y-4">
            <div class="flex justify-between items-center">
             <span class="text-xs text-slate-400 dark:text-slate-500 font-medium">${presentationData.title || ''}</span>
            </div>
            <h2 class="text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white leading-tight">${slide.title}</h2>
            ${slide.summary ? `<p class="text-sm text-slate-500 dark:text-slate-400 italic border-l-2 border-emerald-500 pl-3">${slide.summary}</p>` : ''}
            <ul class="space-y-3 pt-2">${bulletListHtml}</ul>
          </div>
          ${slide.speaker_notes ? `
            <div class="bg-slate-50 dark:bg-slate-950 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-400 space-y-1">
              <span class="font-bold text-amber-600 dark:text-amber-400 uppercase tracking-wider block">💡 Catatan Pengajar:</span>
              <p>${slide.speaker_notes}</p>
            </div>
          ` : ''}
        </div>

        <div class="lg:col-span-5 bg-slate-50 dark:bg-slate-950 relative flex items-center justify-center min-h-[300px] lg:min-h-full border-t lg:border-t-0 lg:border-l border-slate-200 dark:border-slate-800 overflow-hidden">
          <div class="absolute inset-0 flex flex-col items-center justify-center text-slate-500 dark:text-slate-400 text-xs gap-2 p-6 text-center z-10" id="loader-${index}">
            <div class="w-6 h-6 border-2 border-slate-300 dark:border-slate-600 border-t-slate-900 dark:border-t-white rounded-full animate-spin"></div>
            <span id="loader-text-${index}">Generate via WSRV.NL...</span>
            <span class="text-[10px] font-mono text-slate-400 dark:text-slate-500">Slide ${index+1} • ${slide.image_prompt?.length||0} chars • WSRV oke</span>
            <span class="text-[9px] text-amber-600 dark:text-amber-400">Next dimatikan sampai image siap</span>
          </div>
          <img id="img-${index}" alt="${slide.title}" class="w-full h-full object-cover relative z-20 opacity-0" />
          <div id="error-${index}" class="hidden absolute inset-0 z-30 bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center p-6 text-center gap-3">
            <p class="text-xs text-rose-600 dark:text-rose-400">Gagal load</p>
            <button class="retry-btn bg-emerald-600 px-4 py-1.5 rounded-full text-xs font-bold text-white">🔄 Retry</button>
          </div>
        </div>
      </div>
    `;

    containerElement.appendChild(slideCard);
  });

  if (slides.length > 0) {
    generateSlideImage(0, slides[0], containerElement, imageCache);
  }
}

export async function generateSlideImage(index, slide, containerElement, imageCache) {
  const imgElement = containerElement.querySelector(`#img-${index}`);
  const loaderElement = containerElement.querySelector(`#loader-${index}`);
  const errorElement = containerElement.querySelector(`#error-${index}`);
  const loaderText = containerElement.querySelector(`#loader-text-${index}`);

  if (!imgElement || !loaderElement) return;

  isImageLoading = true;
  updateNavLock();

  try {
    if (loaderText) loaderText.textContent = `Generate via WSRV (${slide.image_prompt?.length||0} chars)...`;

    if (imageCache.has(slide.image_prompt)) {
      imgElement.src = imageCache.get(slide.image_prompt);
      const show = () => {
        imgElement.classList.remove('opacity-0');
        loaderElement.style.display = 'none';
        isImageLoading = false;
        updateNavLock();
      };
      if (imgElement.complete) { show(); } else { imgElement.onload = show; }
      return;
    }

    const generatedImg = await generateImageElement(slide.image_prompt, 768, 512);
    imgElement.src = generatedImg.src;
    imageCache.set(slide.image_prompt, generatedImg.src);

    const show = () => {
      imgElement.classList.remove('opacity-0');
      loaderElement.style.display = 'none';
      if (errorElement) errorElement.classList.add('hidden');
      isImageLoading = false;
      updateNavLock();
    };
    imgElement.onload = show;
    if (imgElement.complete && imgElement.src) { show(); }

  } catch (err) {
    isImageLoading = false;
    updateNavLock();
    if (loaderElement) loaderElement.style.display = 'none';
    if (errorElement) {
      errorElement.classList.remove('hidden');
      errorElement.querySelector('p').textContent = `Gagal: ${err.message.slice(0,100)}`;
      errorElement.querySelector('.retry-btn').onclick = () => {
        errorElement.classList.add('hidden');
        loaderElement.style.display = 'flex';
        generateSlideImage(index, slide, containerElement, imageCache);
      };
    }
  }
}

function updateNavLock() {
  const btnPrev = document.getElementById('btnPrev');
  const btnNext = document.getElementById('btnNext');
  const status = document.getElementById('navStatus');
  if (isImageLoading) {
    if (btnPrev) btnPrev.disabled = true;
    if (btnNext) {
      btnNext.disabled = true;
      btnNext.innerHTML = "⏳";
    }
  } else {
    if (btnPrev) btnPrev.disabled = currentSlideIndex === 0;
    if (btnNext) {
      btnNext.disabled = false;
      btnNext.innerHTML = "▶";
    }
    if (status) {
      status.textContent = "✅  Image OK";
      status.className = "text-[10px] font-mono px-2 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800";
    }
  }
}

export function setCurrentIndex(index) {
  currentSlideIndex = index;
}

export function getIsLoading() {
  return isImageLoading;
}
