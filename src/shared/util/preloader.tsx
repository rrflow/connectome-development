/**
 * Warm the caches of images the first screen needs. Connectome's first
 * screen draws its glow and wordmark with CSS, so nothing is preloaded today;
 * the hook stays so startup keeps one place to add preloads.
 */
export function preloadImages() {}
