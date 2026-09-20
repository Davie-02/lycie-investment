import { useState, type FormEvent } from "react";
import FormField from "@/components/forms/FormField";
import FormStatusBanner from "@/components/forms/FormStatusBanner";
import { adminApi } from "../adminApi";
import { ApiError } from "@/services/http";
import type { Faq } from "@/types/faq";
import AiWriteButton from "./AiWriteButton";

interface FaqFormProps {
  faq: Faq | null;
  onSaved: () => void;
  onCancel: () => void;
}

export default function FaqForm({ faq, onSaved, onCancel }: FaqFormProps) {
  const [question, setQuestion] = useState(faq?.question ?? "");
  const [answer, setAnswer] = useState(faq?.answer ?? "");
  const [category, setCategory] = useState(faq?.category ?? "");
  const [sortOrder, setSortOrder] = useState(String(faq?.sortOrder ?? 0));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!question.trim() || !answer.trim()) {
      setError("Question and answer are required.");
      return;
    }
    setError(null);
    setIsSaving(true);

    const payload = {
      question,
      answer,
      category: category || null,
      sortOrder: Number(sortOrder) || 0,
    };

    try {
      if (faq) {
        await adminApi.patch(`/faq/${faq.id}`, payload);
      } else {
        await adminApi.post("/faq", payload);
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save FAQ.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} noValidate>
      <h2>{faq ? "Edit FAQ" : "Add an FAQ"}</h2>

      {error && <FormStatusBanner status="error" successMessage="" errorMessage={error} />}

      <div className="form-grid form-grid--2col">
        <FormField
          id="faq-category"
          label="Category (optional — groups related FAQs)"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="e.g. Buying, Hiring, Import"
        />
        <FormField
          id="faq-sortOrder"
          label="Sort Order (lower shows first)"
          type="number"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value)}
        />

        <FormField
          id="faq-question"
          label="Question"
          required
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          wrapperClassName="form-grid__full"
        />
        <FormField
          id="faq-answer"
          label="Answer"
          as="textarea"
          required
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          wrapperClassName="form-grid__full"
          footer={
            <AiWriteButton
              kind="faq-answer"
              current={answer}
              hint={question ? `Answer this: ${question}` : ""}
              facts={() => (question ? `Question: ${question}` : "")}
              defaultTone="professional"
              maxChars={700}
              onApply={setAnswer}
            />
          }
        />
      </div>

      <div className="form-actions">
        <button type="submit" className="btn btn-primary" disabled={isSaving}>
          {isSaving ? "Saving…" : faq ? "Save Changes" : "Add FAQ"}
        </button>
        <button type="button" className="btn-ghost" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
