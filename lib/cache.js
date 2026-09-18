// lib/cache.js - FIX: file ini hilang, bikin core.js error "Failed to resolve"
// Cache disimpan sampai generate berikutnya (sesuai request)

const CACHE_KEY = "eduslide_presentation_cache";

export class Cache {
  static save(data) {
    try {
      const payload = {
        data,
        savedAt: new Date().toISOString(),
        version: 1
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
      console.log(`[Cache] Saved ${data.slides?.length || 0} slides: ${data.title}`);
      return true;
    } catch (e) {
      console.error("[Cache] Save failed:", e);
      return false;
    }
  }

  static load() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      console.log(`[Cache] Loaded ${parsed.data?.slides?.length || 0} slides from ${parsed.savedAt}`);
      return parsed.data;
    } catch (e) {
      console.error("[Cache] Load failed:", e);
      return null;
    }
  }

  static clear() {
    try {
      localStorage.removeItem(CACHE_KEY);
      console.log("[Cache] Cleared");
    } catch (e) {
      console.error("[Cache] Clear failed:", e);
    }
  }

  static getSlide(index) {
    const data = this.load();
    if (!data || !data.slides) return null;
    return data.slides[index] || null;
  }

  static hasCache() {
    return !!localStorage.getItem(CACHE_KEY);
  }

  static getInfo() {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const parsed = JSON.parse(raw);
      return {
        title: parsed.data?.title,
        count: parsed.data?.slides?.length || 0,
        savedAt: parsed.savedAt
      };
    } catch {
      return null;
    }
  }
}

// Legacy export untuk kompatibilitas
export default Cache;
