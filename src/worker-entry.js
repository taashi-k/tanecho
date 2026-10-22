// Bundled into worker.js at deploy time. The result has no imports, so it runs from the saved copy offline.
import { WebWorkerMLCEngineHandler } from "@mlc-ai/web-llm";

const handler = new WebWorkerMLCEngineHandler();
self.onmessage = event => handler.onmessage(event);
