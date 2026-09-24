/**
 * The "Undo" bar that appears after every admin change the server can reverse
 * (vehicles, content, bookings, requests, settings, admin accounts…).
 *
 * adminApi fires UNDOABLE_EVENT with the activity id from the response; this
 * shows "Archived 3 vehicles · Undo" for 15 seconds. Ctrl/⌘+Z does the same
 * while the bar is showing (except when typing in a field, where it keeps its
 * normal meaning). If part of the change has been edited again since, the
 * server refuses and the bar offers "Undo anyway". Older actions can be undone
 * from Activity.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ApiError } from "@/services/http";
import { UNDOABLE_EVENT, undoAdminAction, type UndoableDetail } from "../adminApi";
import "./UndoToast.css";

const VISIBLE_MS = 15_000;

type State =
  | { kind: "hidden" }
  | { kind: "offer"; item: UndoableDetail }
  | { kind: "working"; item: UndoableDetail }
  | { kind: "conflict"; item: UndoableDetail; message: string }
  | { kind: "done"; text: string; notes: string[]; redo: UndoableDetail | null }
  | { kind: "error"; message: string };

function isTyping(target: EventTarget | null): boolean {
  const element = target as HTMLElement | null;
  return Boolean(element && (element.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(element.tagName)));
}

export default function UndoToast() {
  const [state, setState] = useState<State>({ kind: "hidden" });
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // While an undo is running, the "undoable" event its own response fires is the redo, not a new change.
  const undoing = useRef(false);
  const redo = useRef<UndoableDetail | null>(null);

  const hideLater = useCallback((ms: number) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setState({ kind: "hidden" }), ms);
  }, []);

  useEffect(() => {
    function onUndoable(event: Event) {
      const item = (event as CustomEvent<UndoableDetail>).detail;
      if (undoing.current) {
        redo.current = item;
        return;
      }
      setState({ kind: "offer", item });
      hideLater(VISIBLE_MS);
    }
    window.addEventListener(UNDOABLE_EVENT, onUndoable);
    return () => {
      window.removeEventListener(UNDOABLE_EVENT, onUndoable);
      clearTimeout(timer.current);
    };
  }, [hideLater]);

  const runUndo = useCallback(
    async (item: UndoableDetail, force: boolean) => {
      clearTimeout(timer.current);
      setState({ kind: "working", item });
      undoing.current = true;
      redo.current = null;
      try {
        const result = await undoAdminAction(item.id, force);
        setState({ kind: "done", text: `Undone: ${result.action.replace(/^(Undid|Redid): /, "")}`, notes: result.notes, redo: redo.current });
        hideLater(result.notes.length ? 15_000 : VISIBLE_MS);
      } catch (error) {
        if (error instanceof ApiError && error.status === 409) {
          setState({ kind: "conflict", item, message: error.message });
        } else {
          setState({ kind: "error", message: error instanceof Error ? error.message : "Couldn't undo that." });
          hideLater(10_000);
        }
      } finally {
        undoing.current = false;
      }
    },
    [hideLater]
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (state.kind !== "offer" || isTyping(event.target)) return;
      if ((event.ctrlKey || event.metaKey) && !event.shiftKey && event.key.toLowerCase() === "z") {
        event.preventDefault();
        void runUndo(state.item, false);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [state, runUndo]);

  if (state.kind === "hidden") return null;
  const close = () => setState({ kind: "hidden" });

  return (
    <div className="undo-toast" role="status" aria-live="polite">
      {state.kind === "offer" && (
        <>
          <span className="undo-toast__text">{state.item.action}</span>
          <button type="button" className="undo-toast__action" onClick={() => void runUndo(state.item, false)}>
            Undo
          </button>
        </>
      )}
      {state.kind === "working" && <span className="undo-toast__text">Undoing…</span>}
      {state.kind === "conflict" && (
        <>
          <span className="undo-toast__text">{state.message}</span>
          <button type="button" className="undo-toast__action" onClick={() => void runUndo(state.item, true)}>
            Undo anyway
          </button>
        </>
      )}
      {state.kind === "done" && (
        <>
          <span className="undo-toast__text">
            {state.text}
            {state.notes.map((note) => (
              <span key={note} className="undo-toast__note">
                {note}
              </span>
            ))}
          </span>
          {state.redo && (
            <button type="button" className="undo-toast__action" onClick={() => state.redo && void runUndo(state.redo, false)}>
              Redo
            </button>
          )}
        </>
      )}
      {state.kind === "error" && (
        <span className="undo-toast__text">
          {state.message} <Link to="/admin/activity">See activity</Link>
        </span>
      )}
      <button type="button" className="undo-toast__close" aria-label="Dismiss" onClick={close}>
        ×
      </button>
    </div>
  );
}
