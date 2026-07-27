import {
  getRhPulseClientResolution,
  getRhPulseMetadata,
  type RhPulseCallMetadataRecord,
  type RhPulseResolutionMetadataRecord
} from '../../shared/rhPulseRouting';

export function applyRhPulseDocumentMetadata(
  callRecord?: RhPulseCallMetadataRecord | null,
  resolutionRecord?: RhPulseResolutionMetadataRecord | null
) {
  const resolution = getRhPulseClientResolution(window.location, window.__RH_PULSE_CONTEXT__);
  const metadata = getRhPulseMetadata(resolution, callRecord, resolutionRecord);
  if (!metadata) return;
  document.title = metadata.title;
  setMeta('name', 'description', metadata.description);
  setMeta('name', 'theme-color', metadata.themeColor);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:title', metadata.ogTitle);
  setMeta('property', 'og:description', metadata.ogDescription);
  setMeta('property', 'og:url', metadata.ogUrl);
  setMeta('name', 'twitter:card', metadata.twitterCard);
  setMeta('name', 'twitter:title', metadata.twitterTitle);
  setMeta('name', 'twitter:description', metadata.twitterDescription);
  document.head
    .querySelectorAll('meta[property^="og:image"], meta[name="twitter:image"]')
    .forEach((element) => element.remove());
  if (metadata.ogImageUrl) {
    setMeta('property', 'og:image', metadata.ogImageUrl);
    setMeta('property', 'og:image:width', String(metadata.ogImageWidth ?? 1_200));
    setMeta('property', 'og:image:height', String(metadata.ogImageHeight ?? 630));
    setMeta('property', 'og:image:alt', metadata.ogImageAlt ?? 'RH Pulse public receipt artifact');
    setMeta('name', 'twitter:image', metadata.twitterImageUrl ?? metadata.ogImageUrl);
  }
  let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.append(canonical);
  }
  canonical.href = metadata.canonicalUrl;
  let structured = document.head.querySelector<HTMLScriptElement>(
    'script[type="application/ld+json"]'
  );
  if (!structured) {
    structured = document.createElement('script');
    structured.type = 'application/ld+json';
    document.head.append(structured);
  }
  structured.textContent = JSON.stringify(metadata.structuredData);
}

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let tag = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!tag) {
    tag = document.createElement('meta');
    tag.setAttribute(attribute, key);
    document.head.append(tag);
  }
  tag.content = content;
}
