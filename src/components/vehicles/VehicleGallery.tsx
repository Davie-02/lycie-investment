import { useState } from "react";
import Img from "@/components/common/Img";
import ImageSlider from "@/components/common/ImageSlider";
import "./VehicleGallery.css";

interface VehicleGalleryProps {
  images: string[];
  altBase: string;
}

/**
 * The big photo on a vehicle's page, with a strip of thumbnails under it.
 * The big photo is a swipeable slider; the thumbnails and the slider stay in
 * sync — tap a thumbnail and the slider scrolls there, swipe the slider and
 * the matching thumbnail lights up.
 */
export default function VehicleGallery({ images, altBase }: VehicleGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <div className="vehicle-gallery">
      <div className="vehicle-gallery__main">
        <ImageSlider
          images={images}
          alt={altBase}
          sizes="(min-width: 1000px) 720px, 100vw"
          priority
          activeIndex={activeIndex}
          onIndexChange={setActiveIndex}
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
