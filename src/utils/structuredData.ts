import type { SiteContent } from "@/types/siteContent";
import type { Vehicle } from "@/types/vehicle";
import { toUsd } from "@/utils/price";

/**
 * Structured data ("JSON-LD") that tells Google exactly what a page is — a local business, a car for
 * sale with its price — so results can show richer listings. Mirrors what the API embeds for crawlers
 * (server/src/seo/seo.service.ts); this copy serves browsers that run the site normally, including
 * Google's own JavaScript-rendering crawler.
 */

/** Makes a stored photo address (maybe "/uploads/…") into a full web address. */
export function absolute(origin: string, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  return /^https?:\/\//i.test(path) ? path : `${origin}${path.startsWith("/") ? "" : "/"}${path}`;
}

export function organizationLd(content: SiteContent, origin: string): Record<string, unknown> {
  const { contact, seo, social } = content;
  const sameAs = Object.values(social).filter((link): link is string => Boolean(link && /^https?:\/\//i.test(link)));
  return {
    "@context": "https://schema.org",
    "@type": "AutoDealer",
    name: seo.siteName,
    url: origin,
    description: seo.defaultDescription,
    ...(absolute(origin, seo.ogImage) ? { image: absolute(origin, seo.ogImage) } : {}),
    ...(contact.phone ? { telephone: contact.phone } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    ...(contact.address ? { address: { "@type": "PostalAddress", streetAddress: contact.address, addressCountry: "MW" } } : {}),
    areaServed: { "@type": "Country", name: "Malawi" },
    ...(sameAs.length ? { sameAs } : {}),
  };
}

export function vehicleLd(vehicle: Vehicle, content: SiteContent, origin: string, rate: number | null): Record<string, unknown> {
  const name = `${vehicle.make} ${vehicle.model} ${vehicle.year}`;
  const url = `${origin}/vehicles/${vehicle.slug}`;
  const usd = toUsd(vehicle.price, vehicle.currency, rate);
  const availability =
    vehicle.status === "sold" ? "https://schema.org/SoldOut" : vehicle.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock";
  const images = vehicle.images.map((image) => absolute(origin, image)).filter((image): image is string => Boolean(image));
  return {
    "@context": "https://schema.org",
    "@type": "Car",
    name,
    brand: { "@type": "Brand", name: vehicle.make },
    model: vehicle.model,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: { "@type": "QuantitativeValue", value: vehicle.mileageKm, unitCode: "KMT" },
    fuelType: vehicle.fuelType,
    vehicleTransmission: vehicle.transmission,
    bodyType: vehicle.bodyType,
    description: vehicle.description,
    ...(images.length ? { image: images } : {}),
    url,
    ...(usd !== null
      ? { offers: { "@type": "Offer", price: Math.round(usd), priceCurrency: "USD", availability, url, seller: { "@type": "Organization", name: content.seo.siteName } } }
      : {}),
  };
}
