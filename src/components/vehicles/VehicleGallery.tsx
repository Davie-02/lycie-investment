import { useState } from "react";
import "./VehicleGallery.css";

interface VehicleGalleryProps {
  images: string[];
  altBase: string;
}

export default function VehicleGallery({ images, altBase }: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="vehicle-gallery">
      <div className="vehicle-gallery__main">
        <img src={images[activeIndex]} alt={`${altBase} — photo ${activeIndex + 1}`} />
      </div>

      {images.length > 1 && (
        <div className="vehicle-gallery__thumbs" role="tablist" aria-label="Vehicle photos">
          {images.map((image, index) => (
            <button
              key={image}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              className={
                index === activeIndex
                  ? "vehicle-gallery__thumb vehicle-gallery__thumb--active"
                  : "vehicle-gallery__thumb"
              }
              onClick={() => setActiveIndex(index)}
            >
              <img src={image} alt={`${altBase} thumbnail ${index + 1}`} loading="lazy" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
