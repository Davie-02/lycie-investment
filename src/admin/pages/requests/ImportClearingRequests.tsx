/** Imports & Clearing → Requests: new import and clearing requests from the website. */
import AdminRequests from "../AdminRequests";

export default function ImportClearingRequests() {
  return <AdminRequests only={["import", "clearing"]} title="Import & clearing requests" />;
}
