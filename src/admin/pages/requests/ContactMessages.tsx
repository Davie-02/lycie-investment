/** Customer Care → Contact messages: what people sent through the contact form. */
import AdminRequests from "../AdminRequests";

export default function ContactMessages() {
  return <AdminRequests only={["contact"]} title="Contact messages" />;
}
