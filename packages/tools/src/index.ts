export * from "./types";
export * from "./fs";
export * from "./shell";
export * from "./web";
export * from "./registry";

import { fsEdit, fsRead, fsWrite } from "./fs";
import { createDefaultRegistry } from "./registry";
import { shellRun } from "./shell";
import { webFetch, webSearch } from "./web";

export const defaultToolRegistry = createDefaultRegistry([fsRead, fsWrite, fsEdit, shellRun, webFetch, webSearch]);
