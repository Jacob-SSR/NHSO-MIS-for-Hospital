import { serveDataFile } from "@/lib/data-file";

export function GET() {
  return serveDataFile("mis.json");
}
