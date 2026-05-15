import esadarLogotipo from './esadar-logotipo.webp';
import esadarLogotipo320 from './esadar-logotipo-320.webp';
import esadarLogotipo440 from './esadar-logotipo-440.webp';
import esadarIsotipo from './esadar-isotipo-384.webp';
import esadarIsotipo64 from './esadar-isotipo-64.webp';
import esadarIsotipo128 from './esadar-isotipo-128.webp';
import esadarIsotipo384 from './esadar-isotipo-384.webp';
import esadarArticleFallback from '../article-image-fallback.webp';

export const BRAND_ASSETS = {
  // Logotipo: palabra ESADAR completa. Usar en header, emails, portada, banners y piezas de marca.
  logo: esadarLogotipo,
  logotipo: esadarLogotipo,
  logotipo320: esadarLogotipo320,
  logotipo440: esadarLogotipo440,

  // Isotipo: E sola. Usar en favicon, loaders, fallback, marca de agua e iconos compactos.
  isotipo: esadarIsotipo,
  isotipo64: esadarIsotipo64,
  isotipo128: esadarIsotipo128,
  isotipo384: esadarIsotipo384,
  articleFallback: esadarArticleFallback,
};

export default BRAND_ASSETS;
