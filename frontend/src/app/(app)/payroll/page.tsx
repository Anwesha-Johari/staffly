import { PayrollView } from "./View";

// Depends on the signed-in (client-side) session, so there is no static shell to validate.
export const instant = false;

export default function PayrollPage() {
  return <PayrollView />;
}
