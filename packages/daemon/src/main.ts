import { mkdirSync } from "node:fs";
import { openStore, otoclawDir } from "./store";
import { startServer } from "./server";

mkdirSync(otoclawDir(), { recursive: true });

const db = openStore();
const daemon = startServer(db);

console.log(`otoclaw daemon listening on ws://127.0.0.1:${daemon.port}/ws`);

function shutdown(): void {
	daemon.stop();
	db.close();
	process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
