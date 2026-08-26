export * from "./types";
export * from "./fs";
export * from "./shell";
export * from "./web";
export * from "./browser-test";
export * from "./github";
export * from "./youtube";
export * from "./registry";

import { browserTest } from "./browser-test";
import { fsEdit, fsRead, fsWrite } from "./fs";
import { createDefaultRegistry } from "./registry";
import { shellRun } from "./shell";
import { webFetch, webSearch } from "./web";

export const defaultToolRegistry = createDefaultRegistry([
	fsRead,
	fsWrite,
	fsEdit,
	shellRun,
	webFetch,
	webSearch,
	browserTest,
]);
