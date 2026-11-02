import { DatabaseView } from "./View";

// Depends on the signed-in (client-side) session, so there is no static shell to validate.
export const instant = false;

export default function DatabasePage() {
  return <DatabaseView />;
}
