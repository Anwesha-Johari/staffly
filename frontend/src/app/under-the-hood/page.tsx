import { Dashboard } from "@/components/Dashboard";
import { loadSchema } from "@/lib/schema";

async function getSchema() {
  "use cache";
  return loadSchema();
}

export default async function Home() {
  const schema = await getSchema();
  return <Dashboard schema={schema} />;
}
