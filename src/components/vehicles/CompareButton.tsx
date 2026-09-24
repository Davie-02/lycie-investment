/**
 * "Add to compare" on a vehicle page. Once two or more vehicles are picked, it
 * also links to the side-by-side comparison (pages/Compare).
 */
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { COMPARE_EVENT, MAX_COMPARE, addToCompare, compareUrl, getCompareList, removeFromCompare } from "@/utils/compareList";

export default function CompareButton({ slug }: { slug: string }) {
  const [list, setList] = useState<string[]>(getCompareList);

  useEffect(() => {
    const sync = () => setList(getCompareList());
    window.addEventListener(COMPARE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(COMPARE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const selected = list.includes(slug);

  return (
    <p className="compare-button">
      <button
        type="button"
        className="btn btn-secondary"
        aria-pressed={selected}
        onClick={() => setList(selected ? removeFromCompare(slug) : addToCompare(slug))}
      >
        {selected ? "✓ Added to compare" : "Add to compare"}
      </button>
      {list.length >= 2 && (
        <Link className="compare-button__link" to={compareUrl(list)}>
          Compare {list.length} vehicles →
        </Link>
      )}
      {list.length < 2 && selected && <span className="text-muted"> Add up to {MAX_COMPARE - list.length} more to compare.</span>}
    </p>
  );
}
