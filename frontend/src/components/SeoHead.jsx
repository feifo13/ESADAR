import { useEffect, useMemo, useRef } from 'react';

const DEFAULT_SHARE_TITLE = 'ESADAR | Tienda de ropa';
const DEFAULT_SITE_NAME = 'ESADAR';
const DEFAULT_OG_LOCALE = 'es_UY';
const DEFAULT_SOCIAL_IMAGE_PATH = '/social-share-isotipo.png';

function getDefaultSocialImageUrl() {
  if (typeof window === 'undefined') return DEFAULT_SOCIAL_IMAGE_PATH;
  try {
    return new URL(DEFAULT_SOCIAL_IMAGE_PATH, window.location.origin).href;
  } catch {
    return DEFAULT_SOCIAL_IMAGE_PATH;
  }
}

function upsertMetaTag(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('meta');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value == null || value === '') {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, value);
  });

  return element;
}

function upsertLinkTag(selector, attributes) {
  let element = document.head.querySelector(selector);
  if (!element) {
    element = document.createElement('link');
    document.head.appendChild(element);
  }

  Object.entries(attributes).forEach(([key, value]) => {
    if (value == null || value === '') {
      element.removeAttribute(key);
      return;
    }
    element.setAttribute(key, value);
  });

  return element;
}

export default function SeoHead({
  title,
  description,
  canonical,
  image,
  url,
  type = 'website',
  noindex = false,
  jsonLd = [],
  ogTitle,
  ogDescription,
  twitterTitle,
  twitterDescription,
  siteName = DEFAULT_SITE_NAME,
  locale = DEFAULT_OG_LOCALE,
}) {
  const ownerRef = useRef(`seo-head-${Math.random().toString(36).slice(2)}`);

  const normalizedJsonLd = useMemo(() => {
    const list = Array.isArray(jsonLd) ? jsonLd : jsonLd ? [jsonLd] : [];
    return list.filter(Boolean);
  }, [jsonLd]);

  useEffect(() => {
    const normalizedOgTitle = ogTitle || DEFAULT_SHARE_TITLE;
    const normalizedOgDescription = ogDescription || description || '';
    const normalizedTwitterTitle = twitterTitle || normalizedOgTitle;
    const normalizedTwitterDescription = twitterDescription || normalizedOgDescription;
    const normalizedImage = image || getDefaultSocialImageUrl();

    if (title) {
      document.title = title;
    }

    upsertMetaTag('meta[name="description"]', {
      name: 'description',
      content: description || '',
    });

    upsertMetaTag('meta[name="robots"]', {
      name: 'robots',
      content: noindex ? 'noindex,nofollow' : 'index,follow',
    });

    upsertLinkTag('link[rel="canonical"]', {
      rel: 'canonical',
      href: canonical || url || '',
    });

    upsertMetaTag('meta[property="og:title"]', {
      property: 'og:title',
      content: normalizedOgTitle,
    });
    upsertMetaTag('meta[property="og:description"]', {
      property: 'og:description',
      content: normalizedOgDescription,
    });
    upsertMetaTag('meta[property="og:image"]', {
      property: 'og:image',
      content: normalizedImage,
    });
    upsertMetaTag('meta[property="og:image:secure_url"]', {
      property: 'og:image:secure_url',
      content: normalizedImage,
    });
    upsertMetaTag('meta[property="og:image:width"]', {
      property: 'og:image:width',
      content: normalizedImage ? '1200' : '',
    });
    upsertMetaTag('meta[property="og:image:height"]', {
      property: 'og:image:height',
      content: normalizedImage ? '630' : '',
    });
    upsertMetaTag('meta[property="og:image:alt"]', {
      property: 'og:image:alt',
      content: normalizedImage ? 'Isotipo de ESADAR' : '',
    });
    upsertMetaTag('meta[property="og:url"]', {
      property: 'og:url',
      content: canonical || url || '',
    });
    upsertMetaTag('meta[property="og:type"]', {
      property: 'og:type',
      content: type,
    });
    upsertMetaTag('meta[property="og:site_name"]', {
      property: 'og:site_name',
      content: siteName || DEFAULT_SITE_NAME,
    });
    upsertMetaTag('meta[property="og:locale"]', {
      property: 'og:locale',
      content: locale || DEFAULT_OG_LOCALE,
    });

    upsertMetaTag('meta[name="twitter:card"]', {
      name: 'twitter:card',
      content: normalizedImage ? 'summary_large_image' : 'summary',
    });
    upsertMetaTag('meta[name="twitter:title"]', {
      name: 'twitter:title',
      content: normalizedTwitterTitle,
    });
    upsertMetaTag('meta[name="twitter:description"]', {
      name: 'twitter:description',
      content: normalizedTwitterDescription,
    });
    upsertMetaTag('meta[name="twitter:image"]', {
      name: 'twitter:image',
      content: normalizedImage,
    });

    const owner = ownerRef.current;
    const previousScripts = [...document.head.querySelectorAll(`script[data-seo-owner="${owner}"]`)];
    previousScripts.forEach((node) => node.remove());

    normalizedJsonLd.forEach((item, index) => {
      const script = document.createElement('script');
      script.type = 'application/ld+json';
      script.id = item.id || `seo-jsonld-${index}`;
      script.dataset.seoOwner = owner;
      script.textContent = JSON.stringify(item.data || item);
      document.head.appendChild(script);
    });

    return () => {
      [...document.head.querySelectorAll(`script[data-seo-owner="${owner}"]`)].forEach((node) => node.remove());
    };
  }, [
    canonical,
    description,
    image,
    noindex,
    normalizedJsonLd,
    ogDescription,
    ogTitle,
    title,
    twitterDescription,
    siteName,
    locale,
    twitterTitle,
    type,
    url,
  ]);

  return null;
}
