import { useState } from "react";
import Img from "@/components/common/Img";
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
        <Img
          src={images[activeIndex]}
          alt={`${altBase} — photo ${activeIndex + 1}`}
          sizes="(min-width: 1000px) 720px, 100vw"
          priority
        />
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
              <Img src={image} alt={`${altBase} thumbnail ${index + 1}`} sizes="120px" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
