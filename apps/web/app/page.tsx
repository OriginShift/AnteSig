import { WorkbenchShell } from "../src/components/workbench-shell";
import { isClear402Enabled } from "../src/server/clear402-config";

export default function HomePage() {
  return <WorkbenchShell clear402Enabled={isClear402Enabled()} />;
}
