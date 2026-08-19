import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import { NOTICE_TYPE_LABELS, type Notice, type NoticeType, type NoticeDisplayMode } from "@/types/notice";

interface NoticeFormProps {
  notice: Notice | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function NoticeForm({ notice, onSaved, onCancel }: NoticeFormProps) {
  const [title, setTitle] = useState(notice?.title ?? "");
  const [message, setMessage] = useState(notice?.message ?? "");
  const [type, setType] = useState<NoticeType>(notice?.type ?? "info");
  const [displayAs, setDisplayAs] = useState<NoticeDisplayMode>(notice?.displayAs ?? "banner");
  const [isActive, setIsActive] = useState(notice?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!message.trim()) {
      setError("Message is required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const payload = { title: title || null, message, type, displayAs, isActive };

    try {
      if (notice) {
        await adminApi.patch(`/notices/${notice.id}`, payload);
      } else {
        await adminApi.post("/notices", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save notice.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{notice ? "Edit Notice" : "Add a Notice"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="notice-title"
          label="Title (optional)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        <FormField
          id="notice-type"
          label="Type (determines color)"
          as="select"
          value={type}
          onChange={(e) => setType(e.target.value as NoticeType)}
        >
          {Object.entries(NOTICE_TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </FormField>

        <FormField
          id="notice-displayAs"
          label="Show as"
          as="select"
          value={displayAs}
          onChange={(e) => setDisplayAs(e.target.value as NoticeDisplayMode)}
        >
          <option value="banner">Banner (top of every page)</option>
          <option value="popup">Popup (shown once per visitor session)</option>
        </FormField>

        <FormField
          id="notice-isActive"
          label="Status"
          as="select"
          value={isActive ? "true" : "false"}
          onChange={(e) => setIsActive(e.target.value === "true")}
        >
          <option value="true">On — visible on the site</option>
          <option value="false">Off — hidden</option>
        </FormField>

        <FormField
          id="notice-message"
          label="Message"
          as="textarea"
          required
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          wrapperClassName="form-grid__full"
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : notice ? "Save Changes" : "Add Notice"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
