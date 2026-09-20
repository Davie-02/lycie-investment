import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAsyncData } from "@/hooks/useAsyncData";
import { getFeaturedVehicles } from "@/services/vehicles.service";
import { formatCurrency } from "@/utils/format";
import Img from "@/components/common/Img";
import SaveVehicleButton from "@/components/vehicles/SaveVehicleButton";
import "./VehicleCarousel.css";

const AUTO_ADVANCE_MS = 6000;
const SWIPE_THRESHOLD_PX = 50;

/**
 * The landing page's showcase of available vehicles — the site's main
 * visual "first impression". Auto-advances on a timer, but:
 *   - pauses on hover/focus (so nobody fights the carousel to read a price)
 *   - never auto-advances at all for prefers-reduced-motion (checked once,
 *     since users don't toggle this setting mid-visit)
 *   - is fully operable via the arrow buttons and keyboard, so pausing
 *     the automatic motion never removes the ability to browse
 */
export default function VehicleCarousel() {
  const { data: vehicles, isLoading, error } = useAsyncData(() => getFeaturedVehicles(6), [], ["vehicles"]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const prefersReducedMotion = useRef(
    typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  const count = vehicles?.length ?? 0;
  const touchStartX = useRef<number | null>(null);

  const goTo = useCallback(
    (index: number) => {
      if (count === 0) return;
      setActiveIndex(((index % count) + count) % count);
    },
    [count]
  );

  useEffect(() => {
    if (isPaused || prefersReducedMotion.current || count <= 1) return;
    const timer = setInterval(() => goTo(activeIndex + 1), AUTO_ADVANCE_MS);
    return () => clearInterval(timer);
  }, [activeIndex, isPaused, count, goTo]);

  if (isLoading || error || !vehicles || vehicles.length === 0) {
    // Not worth its own error message — the homepage still works fine
    // without this section (e.g. a brand-new install with no vehicles
    // yet), it just quietly doesn't render.
    return null;
  }

  const vehicle = vehicles[activeIndex];

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
    setIsPaused(true);
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    const startX = touchStartX.current;
    touchStartX.current = null;
    setIsPaused(false);
    if (startX === null) return;

    const deltaX = event.changedTouches[0].clientX - startX;
    if (Math.abs(deltaX) < SWIPE_THRESHOLD_PX) return;
    goTo(deltaX < 0 ? activeIndex + 1 : activeIndex - 1);
  };

  return (
    <section
      className="vehicle-carousel"
      aria-roledescription="carousel"
      aria-label="Featured vehicles"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onFocus={() => setIsPaused(true)}
      onBlur={() => setIsPaused(false)}
    >
      <div
        className="vehicle-carousel__slide"
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <div className="vehicle-carousel__stage">
          {vehicles.map((v, index) => {
            // Only the current photo and its neighbours are in the page, so the
            // browser isn't downloading every slide before it's needed.
            const distance = Math.abs(index - activeIndex);
            const isNear = distance <= 1 || distance === count - 1;
            const isActive = index === activeIndex;
            return (
              <div
                key={v.id}
                className={isActive ? "vehicle-carousel__bg vehicle-carousel__bg--active" : "vehicle-carousel__bg"}
                aria-hidden={!isActive}
              >
                {isNear && v.images[0] && (
                  <>
                    {/* Blurred copy fills any empty space, so the real photo can be shown WHOLE. */}
                    <Img src={v.images[0]} alt="" sizes="100vw" className="vehicle-carousel__backdrop" />
                    <Img
                      src={v.images[0]}
                      alt={isActive ? `${v.make} ${v.model}` : ""}
                      sizes="(min-width: 1200px) 1200px, 100vw"
                      priority={isActive && index === 0}
                      className="vehicle-carousel__photo"
                    />
                  </>
                )}
              </div>
            );
          })}
        </div>
        <div className="vehicle-carousel__scrim" />
        <SaveVehicleButton vehicleId={vehicle.id} className="vehicle-carousel__save" />
        <div className="container vehicle-carousel__content" key={vehicle.id}>
          <span className="vehicle-carousel__eyebrow">Featured &amp; Available Now</span>
          <h2>
            {vehicle.make} {vehicle.model}
          </h2>
          <p className="vehicle-carousel__meta mono">
            {vehicle.year} · {vehicle.transmission} · {vehicle.fuelType}
          </p>
          <p className="vehicle-carousel__price mono">
            {formatCurrency(vehicle.price, vehicle.currency)}
          </p>
          <div className="vehicle-carousel__actions">
            <Link to={`/vehicles/${vehicle.slug}`} className="btn btn-primary">
              View This Vehicle
            </Link>
            <Link to="/vehicles" className="btn btn-secondary vehicle-carousel__secondary">
              Browse All Vehicles
            </Link>
          </div>
        </div>

        {count > 1 && (
          <>
            <button
              type="button"
              className="vehicle-carousel__arrow vehicle-carousel__arrow--prev"
              onClick={() => goTo(activeIndex - 1)}
              aria-label="Previous vehicle"
            >
              ‹
            </button>
            <button
              type="button"
              className="vehicle-carousel__arrow vehicle-carousel__arrow--next"
              onClick={() => goTo(activeIndex + 1)}
              aria-label="Next vehicle"
            >
              ›
            </button>
          </>
        )}
      </div>

      {count > 1 && (
        <div className="vehicle-carousel__dots" role="tablist" aria-label="Choose a vehicle to feature">
          {vehicles.map((v, index) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={index === activeIndex}
              aria-label={`Show ${v.make} ${v.model}`}
              className={
                index === activeIndex
                  ? "vehicle-carousel__dot vehicle-carousel__dot--active"
                  : "vehicle-carousel__dot"
              }
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
