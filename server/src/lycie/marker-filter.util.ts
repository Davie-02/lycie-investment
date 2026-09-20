/**
 * The model marks knowledge gaps with [[NO_INFO]] and vehicle cards with
 * [[vehicle:slug]]. Those are instructions for our code, not words for the
 * customer, so they must never flash on screen while the answer streams in.
 *
 * Text is released as soon as it's safe; anything that might be the start of
 * a marker ("[", "[[veh…") is held back until we know what it is.
 */
export class MarkerFilter {
  private held = "";
  /** Longest a possible marker is held before we decide it was ordinary text. */
  private static readonly MAX_HELD = 64;

  push(chunk: string): string {
    let text = (this.held + chunk).replace(/\[\[[^\]]*\]\]/g, "");
    this.held = "";

    const open = text.lastIndexOf("[[");
    if (open !== -1) {
      this.held = text.slice(open);
      text = text.slice(0, open);
    } else if (text.endsWith("[")) {
      this.held = "[";
      text = text.slice(0, -1);
    }

    if (this.held.length > MarkerFilter.MAX_HELD) {
      text += this.held;
      this.held = "";
    }
    return text;
  }

  /** Whatever was still held when the answer ended (an unfinished marker is dropped). */
  end(): string {
    const rest = this.held.startsWith("[[") ? "" : this.held;
    this.held = "";
    return rest;
  }
}
