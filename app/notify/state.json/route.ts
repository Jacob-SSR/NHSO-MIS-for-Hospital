import { serveDataFile } from "@/lib/data-file";

export function GET() {
  return serveDataFile("notify-state.json");
}
