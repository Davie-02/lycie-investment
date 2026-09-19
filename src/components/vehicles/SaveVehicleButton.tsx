import { useNavigate } from "react-router-dom";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useSavedVehicles } from "@/context/SavedVehiclesContext";
import "./SaveVehicleButton.css";

interface SaveVehicleButtonProps {
  vehicleId: string;
  className?: string;
}

export default function SaveVehicleButton({ vehicleId, className }: SaveVehicleButtonProps) {
  const { isAuthenticated } = useCustomerAuth();
  const { isSaved, isPending, toggle } = useSavedVehicles();
  const navigate = useNavigate();
  const saved = isSaved(vehicleId);

  function handleClick(event: React.MouseEvent) {
    event.preventDefault();
    event.stopPropagation();

    if (!isAuthenticated) {
      navigate("/account/login");
      return;
    }
    void toggle(vehicleId);
  }

  return (
    <button
      type="button"
      className={`save-vehicle-btn${saved ? " save-vehicle-btn--saved" : ""}${className ? ` ${className}` : ""}`}
      onClick={handleClick}
      disabled={isPending(vehicleId)}
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved vehicles" : "Save this vehicle"}
      title={saved ? "Remove from saved vehicles" : "Save this vehicle"}
    >
      <svg viewBox="0 0 24 24" className="save-vehicle-btn__icon" aria-hidden="true">
        <path d="M12 20.5s-7.5-4.6-10.2-9.3C.1 8.1 1.4 4.5 4.8 3.6c2.2-.6 4.3.3 5.6 2.1l1.6 2 1.6-2c1.3-1.8 3.4-2.7 5.6-2.1 3.4.9 4.7 4.5 3 7.6C19.5 15.9 12 20.5 12 20.5z" />
      </svg>
    </button>
  );
}
