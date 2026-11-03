// Copies the ZXing barcode-reader WASM into public/ under a versioned name,
// so the phone-camera scanner works offline and never depends on a CDN.
import { copyFileSync, mkdirSync, readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("node_modules/zxing-wasm/package.json", "utf8"));
mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/zxing-wasm/dist/reader/zxing_reader.wasm", `public/vendor/zxing_reader-${version}.wasm`);
