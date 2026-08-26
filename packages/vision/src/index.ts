export const PACKAGE_NAME = "@otoclaw/vision" as const;

export type { CaptureInput, CaptureResult, DescribeInput, DescribeResult } from "./types";
export { capture, NoopScreenCaptureProvider } from "./capture";
export type { ScreenCaptureProvider } from "./capture";
export { describe } from "./describe";
export type { ResolveProvider } from "./describe";
