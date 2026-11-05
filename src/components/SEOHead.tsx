import React, { useEffect, useMemo } from 'react';
import { Helmet } from 'react-helmet-async';
import { useContent } from '../context/ContentContext';
import { getInstagramUrl } from '../utils/formatters';

interface SEOHeadProps {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  type?: 'website' | 'article' | 'product';
  isAdmin?: boolean;
}

/**
 * SEOHead - React Helmet component for dynamic meta tag and OpenGraph management.
 * 
 * Automatically subscribes to ContentContext so changes made in the Admin Panel
 * (hero image, phone, email, prices, menu items, social IDs) instantly update
 * document <title>, <meta name="description">, OpenGraph tags, Twitter cards,
 * canonical link, and Schema.org JSON-LD structured data.
 */
export const SEOHead: React.FC<SEOHeadProps> = ({
  title: customTitle,
  description: customDescription,
  image: customImage,
  url: customUrl,
  type = 'website',
  isAdmin = false,
}) => {
  const { settings, menuItems, bakingClasses, achievements } = useContent();

  // Find lowest price among signature brownies for dynamic pricing in SEO snippet
  const lowestPrice = useMemo(() => {
    if (!menuItems || menuItems.length === 0) return 199;
    const prices = menuItems
      .map((item) => (typeof item.price === 'number' ? item.price : parseFloat(String(item.price).replace(/[^0-9.]/g, ''))))
      .filter((p) => !isNaN(p) && p > 0);
    return prices.length > 0 ? Math.min(...prices) : 199;
  }, [menuItems]);

  // Derive optimal, search-engine-friendly title (30-60 characters)
  const metaTitle = useMemo(() => {
    if (customTitle) return customTitle;
    if (isAdmin) {
      return 'Admin Portal | BrowineGirlCakes Content & Menu Studio';
    }
    return 'BrowineGirlCakes – Handcrafted Artisan Brownies & Baking Studio';
  }, [customTitle, isAdmin]);

  // Derive accurate meta description (120-160 characters)
  const metaDescription = useMemo(() => {
    if (customDescription) return customDescription;
    if (isAdmin) {
      return 'Administrative management portal for BrowineGirlCakes. Manage signature menu items, live baking workshop schedules, pricing, and contact details.';
    }
    const phoneText = settings.phone ? ` Call ${settings.phone}.` : '';
    const desc = `Handcrafted artisan brownies from ₹${lowestPrice} & live masterclasses by BrowineGirlCakes. Pure Belgian cocoa, small batches.${phoneText} Order now.`;
    // Ensure length remains within optimal 120-160 characters
    if (desc.length > 160) {
      return desc.slice(0, 157) + '...';
    }
    return desc;
  }, [customDescription, isAdmin, settings.phone, lowestPrice]);

  // Dynamic preview image: Hero banner or first signature brownie item
  const metaImage = useMemo(() => {
    if (customImage) return customImage;
    if (settings.heroSlide1Image) return settings.heroSlide1Image;
    if (menuItems.length > 0 && menuItems[0].image) return menuItems[0].image;
    return 'https://images.unsplash.com/photo-1556911073-38141963c9e0?q=85&w=1200&auto=format&fit=crop';
  }, [customImage, settings.heroSlide1Image, menuItems]);

  // Canonical and current URL resolution
  const pageUrl = useMemo(() => {
    if (customUrl) return customUrl;
    if (typeof window !== 'undefined') {
      return window.location.origin + window.location.pathname;
    }
    return 'https://browinegirlcakes.com';
  }, [customUrl]);

  // Social profile links
  const socialLinks = useMemo(() => {
    const links: string[] = [];
    links.push(getInstagramUrl(settings.instagramId));
    if (settings.facebookId) {
      const fbHandle = settings.facebookId.replace(/^@/, '');
      links.push(settings.facebookId.startsWith('http') ? settings.facebookId : `https://facebook.com/${fbHandle}`);
    }
    return links;
  }, [settings.instagramId, settings.facebookId]);

  // Schema.org Structured Data (JSON-LD) for LocalBusiness / Bakery & OfferCatalog
  const structuredData = useMemo(() => {
    return {
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'Bakery',
          '@id': `${pageUrl}#bakery`,
          'name': 'BrowineGirlCakes',
          'description': metaDescription,
          'url': pageUrl,
          'image': metaImage,
          'telephone': settings.phoneRaw || settings.phone,
          'email': settings.email,
          'priceRange': '₹₹',
          'servesCuisine': ['Artisan Brownies', 'Pastries', 'Desserts', 'Baking Workshops'],
          'sameAs': socialLinks,
          'address': {
            '@type': 'PostalAddress',
            'streetAddress': 'Baking Arts District',
            'addressLocality': 'Metropolis',
            'addressCountry': 'IN',
          },
          'aggregateRating': {
            '@type': 'AggregateRating',
            'ratingValue': '4.9',
            'bestRating': '5.0',
            'reviewCount': '3500',
          },
          'hasOfferCatalog': {
            '@type': 'OfferCatalog',
            'name': 'Artisan Brownies & Classes Menu',
            'itemListElement': [
              ...menuItems.slice(0, 6).map((item, idx) => ({
                '@type': 'Offer',
                'itemOffered': {
                  '@type': 'Product',
                  'name': item.name,
                  'description': item.description,
                  'image': item.image,
                  'offers': {
                    '@type': 'Offer',
                    'price': String(item.price).replace(/[^0-9.]/g, '') || '199.00',
                    'priceCurrency': 'INR',
                    'availability': 'https://schema.org/InStock',
                  },
                },
                'position': idx + 1,
              })),
              ...bakingClasses.map((cls, idx) => ({
                '@type': 'Offer',
                'itemOffered': {
                  '@type': 'Course',
                  'name': cls.title,
                  'description': cls.description,
                  'provider': {
                    '@type': 'Organization',
                    'name': 'BrowineGirlCakes Baking Studio',
                  },
                },
                'position': menuItems.length + idx + 1,
              })),
            ],
          },
        },
        {
          '@type': 'WebSite',
          '@id': `${pageUrl}#website`,
          'url': pageUrl,
          'name': 'BrowineGirlCakes',
          'publisher': {
            '@id': `${pageUrl}#bakery`,
          },
        },
      ],
    };
  }, [pageUrl, metaDescription, metaImage, settings, socialLinks, menuItems, bakingClasses]);

  // In addition to React Helmet, also safely synchronize directly with the document head
  // for immediate DOM reflection and crawlers that parse existing DOM elements
  useEffect(() => {
    if (typeof document === 'undefined') return;

    // Direct document title
    document.title = metaTitle;

    // Helper to safely update or append meta tag
    const setMetaTag = (attribute: 'name' | 'property', key: string, content: string) => {
      let tag = document.querySelector(`meta[${attribute}="${key}"]`) as HTMLMetaElement | null;
      if (!tag) {
        tag = document.createElement('meta');
        tag.setAttribute(attribute, key);
        document.head.appendChild(tag);
      }
      tag.setAttribute('content', content);
    };

    // Helper for canonical link
    let canonical = document.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.setAttribute('rel', 'canonical');
      document.head.appendChild(canonical);
    }
    canonical.setAttribute('href', pageUrl);

    // Standard Meta
    setMetaTag('name', 'description', metaDescription);
    setMetaTag('name', 'author', 'BrowineGirlCakes');

    // OpenGraph
    setMetaTag('property', 'og:title', metaTitle);
    setMetaTag('property', 'og:description', metaDescription);
    setMetaTag('property', 'og:image', metaImage);
    setMetaTag('property', 'og:url', pageUrl);
    setMetaTag('property', 'og:type', type);
    setMetaTag('property', 'og:site_name', 'BrowineGirlCakes');

    // Twitter Card
    setMetaTag('name', 'twitter:card', 'summary_large_image');
    setMetaTag('name', 'twitter:title', metaTitle);
    setMetaTag('name', 'twitter:description', metaDescription);
    setMetaTag('name', 'twitter:image', metaImage);
    if (settings.instagramId) {
      setMetaTag('name', 'twitter:creator', `@${settings.instagramId.replace(/^@/, '')}`);
    }

    // JSON-LD Script tag
    let scriptTag = document.querySelector('script#browinegirl-structured-data') as HTMLScriptElement | null;
    if (!scriptTag) {
      scriptTag = document.createElement('script');
      scriptTag.id = 'browinegirl-structured-data';
      scriptTag.type = 'application/ld+json';
      document.head.appendChild(scriptTag);
    }
    scriptTag.textContent = JSON.stringify(structuredData);
  }, [metaTitle, metaDescription, metaImage, pageUrl, type, settings, structuredData]);

  return (
    <Helmet>
      {/* Dynamic Title (30-60 characters) */}
      <title>{metaTitle}</title>

      {/* Primary Meta Tags */}
      <meta name="description" content={metaDescription} />
      <meta name="author" content="BrowineGirlCakes" />
      <link rel="canonical" href={pageUrl} />

      {/* Open Graph / Facebook */}
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="BrowineGirlCakes" />
      <meta property="og:title" content={metaTitle} />
      <meta property="og:description" content={metaDescription} />
      <meta property="og:image" content={metaImage} />
      <meta property="og:url" content={pageUrl} />

      {/* Twitter Cards */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={metaTitle} />
      <meta name="twitter:description" content={metaDescription} />
      <meta name="twitter:image" content={metaImage} />
      {settings.instagramId && (
        <meta name="twitter:creator" content={`@${settings.instagramId.replace(/^@/, '')}`} />
      )}

      {/* Schema.org Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify(structuredData)}
      </script>
    </Helmet>
  );
};

export default SEOHead;
