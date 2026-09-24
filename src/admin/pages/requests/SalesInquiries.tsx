/** Sales → Inquiries: questions about vehicles for sale. */
import AdminRequests from "../AdminRequests";

export default function SalesInquiries() {
  return <AdminRequests only={["inquiries"]} title="Vehicle inquiries" />;
}
