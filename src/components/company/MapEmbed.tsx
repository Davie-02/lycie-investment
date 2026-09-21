import { mapsDirectionsUrl, mapsEmbedUrl, mapsSearchUrl } from "@/utils/contactLinks";
import "./company.css";

interface MapEmbedProps {
  /** Address, place name or "lat,lng" — what the map should show. */
  query: string;
  /** Accessible name for the map frame (screen readers announce it). */
  title?: string;
}

/**
 * An interactive Google map (drag, zoom, switch to satellite) with links to
 * open it in the Maps app and to get directions.
 *
 * Uses Google's keyless embed address, so there is no API key to create, pay
 * for or leak. The frame loads lazily — it isn't fetched until scrolled near —
 * so it never slows down the rest of the page.
 */
export default function MapEmbed({ query, title = "Map showing our location" }: MapEmbedProps) {
  return (
    <div className="map-embed">
      <div className="map-embed__frame">
        <iframe
          title={title}
          src={mapsEmbedUrl(query)}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>
      <p className="map-embed__links">
        <a href={mapsSearchUrl(query)} target="_blank" rel="noopener noreferrer">
          Open in Google Maps
        </a>
        <a href={mapsDirectionsUrl(query)} target="_blank" rel="noopener noreferrer">
          Get directions
        </a>
      </p>
    </div>
  );
}
