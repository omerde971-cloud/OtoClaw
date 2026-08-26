import { Database } from "bun:sqlite";
import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { Session, Verdict } from "@otoclaw/shared";

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
	db.run(`
    CREATE TABLE IF NOT EXISTS verdicts (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      task_id TEXT,
      label TEXT NOT NULL,
      score REAL NOT NULL,
      notes TEXT NOT NULL,
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

/** taskId maps to Verdict.targetId — the step/task the verdict judged. */
export function saveVerdict(db: Database, sessionId: string, verdict: Verdict): void {
	db.run(
		"INSERT INTO verdicts (id, session_id, task_id, label, score, notes, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
		[verdict.id, sessionId, verdict.targetId, verdict.label, verdict.score, JSON.stringify(verdict.notes), verdict.createdAt],
	);
}

export function listVerdicts(db: Database, sessionId: string): Verdict[] {
	const rows = db
		.query(
			"SELECT id, task_id AS targetId, label, score, notes, created_at AS createdAt FROM verdicts WHERE session_id = ? ORDER BY created_at ASC",
		)
		.all(sessionId) as Array<{ id: string; targetId: string; label: "good" | "bad"; score: number; notes: string; createdAt: string }>;
	return rows.map((row) => ({ ...row, notes: JSON.parse(row.notes) as string[] }));
}
