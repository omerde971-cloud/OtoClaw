import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Session } from "@otoclaw/shared";

export function otoclawDir(): string {
	return join(homedir(), ".otoclaw");
}

export function openStore(
	dbPath: string = join(otoclawDir(), "sessions.db"),
): Database {
	if (!existsSync(otoclawDir())) {
		mkdirSync(otoclawDir(), { recursive: true });
	}
	const db = new Database(dbPath, { create: true });
	db.run(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      cwd TEXT NOT NULL,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
	return db;
}

export function createSession(
	db: Database,
	cwd: string,
	mode: "manual" | "auto",
): Session {
	const session: Session = {
		id: crypto.randomUUID(),
		cwd,
		mode,
		createdAt: new Date().toISOString(),
	};
	db.run(
		"INSERT INTO sessions (id, cwd, mode, created_at) VALUES (?, ?, ?, ?)",
		[session.id, session.cwd, session.mode, session.createdAt],
	);
	return session;
}

export function getSession(db: Database, id: string): Session | null {
	const row = db
		.query(
			"SELECT id, cwd, mode, created_at AS createdAt FROM sessions WHERE id = ?",
		)
		.get(id) as Session | null;
	return row ?? null;
}
