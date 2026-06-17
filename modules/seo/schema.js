/**
 * Schema.org 结构化数据生成
 * Article, BreadcrumbList, Organization, WebSite, Product
 */

import CONFIG from '../shared/config.js';

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: CONFIG.seo.siteName,
    url: CONFIG.baseUrl,
    description: CONFIG.seo.tagline,
    inLanguage: 'en-US',
    potentialAction: {
      '@type': 'SearchAction',
      target: `${CONFIG.baseUrl}/search/?q={search_term_string}`,
      'query-input': 'required name=search_term_string',
    },
  };
}

export function articleSchema(article, url) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: (article._generated || article.createdAt || '').slice(0, 10),
    dateModified: (article._published || article.updatedAt || '').slice(0, 10),
    author: { '@type': 'Organization', name: CONFIG.seo.defaultAuthor },
    publisher: { '@type': 'Organization', name: CONFIG.seo.siteName, url: CONFIG.baseUrl },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };
}

export function breadcrumbSchema(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem', position: i + 1, name: item.label, item: item.url || undefined,
    })),
  };
}

export function organizationSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: CONFIG.seo.siteName,
    url: CONFIG.baseUrl,
    description: CONFIG.seo.tagline,
  };
}

export default { websiteSchema, articleSchema, breadcrumbSchema, organizationSchema };
