interface FormStatusBannerProps {
  status: "success" | "error";
  successMessage: string;
  errorMessage: string | null;
}

export default function FormStatusBanner({ status, successMessage, errorMessage }: FormStatusBannerProps) {
  if (status === "success") {
    return (
      <div className="form-status form-status--success" role="status">
        {successMessage}
      </div>
    );
  }

  return (
    <div className="form-status form-status--error" role="alert">
      {errorMessage ?? "Something went wrong. Please try again."}
    </div>
  );
}
