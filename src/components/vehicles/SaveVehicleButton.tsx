import LikeButton from "@/components/common/LikeButton";
import { useCustomerAuth } from "@/context/CustomerAuthContext";
import { useSavedVehicles } from "@/context/SavedVehiclesContext";

interface SaveVehicleButtonProps {
  vehicleId: string;
  className?: string;
}

/**
 * Anyone can like a vehicle without signing in. Customers who ARE signed in
 * also get it added to (or removed from) "Saved vehicles" in their account,
 * so their shortlist follows them across devices.
 */
export default function SaveVehicleButton({ vehicleId, className }: SaveVehicleButtonProps) {
  const { isAuthenticated } = useCustomerAuth();
  const { isSaved, toggle } = useSavedVehicles();

  return (
    <LikeButton
      kind="vehicle"
      targetId={vehicleId}
      noun="vehicle"
      className={className}
      onChange={(liked) => {
        if (isAuthenticated && liked !== isSaved(vehicleId)) void toggle(vehicleId);
      }}
    />
  );
}
