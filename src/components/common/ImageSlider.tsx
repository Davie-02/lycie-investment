import { useCallback, useEffect, useRef, useState, type KeyboardEvent } from "react";
import Img from "./Img";
import "./ImageSlider.css";

interface ImageSliderProps {
  images: string[];
  /** Describes the subject; each slide is announced as "<alt> — photo 2 of 5". */
  alt: string;
  /** Hint for the browser about how wide the image is drawn (see Img). */
  sizes?: string;
  /** First slide loads immediately instead of lazily (use for above-the-fold sliders). */
  priority?: boolean;
  /** Controlled mode: which slide to show. Leave out and the slider manages itself. */
  activeIndex?: number;
  /** Called whenever the visible slide changes (by swipe, arrow, dot or keyboard). */
  onIndexChange?: (index: number) => void;
  className?: string;
}

/**
 * A swipeable photo slider for every place that shows several pictures of one
 * thing (vehicle cards, hire vehicle cards, the vehicle gallery).
 *
 * It is built on the browser's own scrolling with "snap points", so:
 *  - phones swipe with native, momentum-smooth touch scrolling;
 *  - desktops get arrow buttons, dots, the keyboard's ← → keys, and
 *    trackpad/shift-wheel scrolling;
 *  - no JavaScript animation runs while dragging, so it stays smooth on cheap phones.
 *
 * (The homepage's top carousel is different on purpose: an auto-playing
 * crossfade. This one is for browsing the photos yourself.)
 *
 * With one image it renders just the picture — no arrows or dots.
 */
export default function ImageSlider({ images, alt, sizes, priority = false, activeIndex, onIndexChange, className }: ImageSliderProps) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const count = images.length;

  /** Scrolls the track so slide `target` is in view. */
  const goTo = useCallback(
    (target: number, smooth = true) => {
      const element = track.current;
      if (!element) return;
      const clamped = Math.max(0, Math.min(count - 1, target));
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
      element.scrollTo({ left: clamped * element.clientWidth, behavior: smooth && !reduceMotion ? "smooth" : "auto" });
    },
    [count]
  );

  // Works out which slide is showing from how far the track has scrolled. Runs
  // at most once per animation frame so a fast swipe doesn't flood React.
  const frame = useRef<number | null>(null);
  function handleScroll() {
    if (frame.current !== null) return;
    frame.current = requestAnimationFrame(() => {
      frame.current = null;
      const element = track.current;
      if (!element || element.clientWidth === 0) return;
      const next = Math.round(element.scrollLeft / element.clientWidth);
      setIndex((current) => {
        if (current === next) return current;
        onIndexChange?.(next);
        return next;
      });
    });
  }

  // Controlled mode: when the parent changes the wanted slide (e.g. a thumbnail click), scroll to it.
  useEffect(() => {
    if (activeIndex !== undefined && activeIndex !== index) goTo(activeIndex);
    // Only react to the parent's request, not to our own scrolling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeIndex]);

  useEffect(
    () => () => {
      if (frame.current !== null) cancelAnimationFrame(frame.current);
    },
    []
  );

  // If the box is resized (rotating a phone) keep the same photo in view instead of landing between two.
  // The current index is read through a ref and the observer is created once: recreating it on every
  // slide change made it fire immediately and snap the track back mid-scroll, cancelling the animation.
  const indexRef = useRef(0);
  indexRef.current = index;
  const lastWidth = useRef(0);
  useEffect(() => {
    const element = track.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      const width = element.clientWidth;
      // The first callback just reports the starting size; only a genuine change needs re-aligning.
      if (lastWidth.current !== 0 && width !== lastWidth.current) goTo(indexRef.current, false);
      lastWidth.current = width;
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [goTo]);

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goTo(index + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goTo(index - 1);
    }
  }

  if (count === 0) return null;

  // A single picture needs no slider machinery.
  if (count === 1) {
    return (
      <div className={className ? `image-slider image-slider--single ${className}` : "image-slider image-slider--single"}>
        <div className="image-slider__slide">
          <Img src={images[0]} alt={alt} sizes={sizes} priority={priority} />
        </div>
      </div>
    );
  }

  return (
    <div
      className={className ? `image-slider ${className}` : "image-slider"}
      role="region"
      aria-roledescription="carousel"
      aria-label={`${alt} photos`}
    >
      <div className="image-slider__track" ref={track} onScroll={handleScroll} onKeyDown={handleKeyDown} tabIndex={0}>
        {images.map((image, i) => (
          <div className="image-slider__slide" key={`${image}-${i}`} role="group" aria-roledescription="slide" aria-label={`Photo ${i + 1} of ${count}`}>
            {/* Only the first photo (and only when asked) loads eagerly; the rest wait until scrolled near. */}
            <Img src={image} alt={`${alt} — photo ${i + 1} of ${count}`} sizes={sizes} priority={priority && i === 0} />
          </div>
        ))}
      </div>

      <button type="button" className="image-slider__arrow image-slider__arrow--prev" onClick={() => goTo(index - 1)} disabled={index === 0} aria-label="Previous photo">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m15 5-7 7 7 7" />
        </svg>
      </button>
      <button type="button" className="image-slider__arrow image-slider__arrow--next" onClick={() => goTo(index + 1)} disabled={index === count - 1} aria-label="Next photo">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>

      <div className="image-slider__dots" role="tablist" aria-label="Choose photo">
        {images.map((_, i) => (
          <button
            type="button"
            role="tab"
            key={i}
            className={i === index ? "image-slider__dot image-slider__dot--active" : "image-slider__dot"}
            aria-selected={i === index}
            aria-label={`Show photo ${i + 1}`}
            onClick={() => goTo(i)}
          />
        ))}
      </div>
    </div>
  );
}
