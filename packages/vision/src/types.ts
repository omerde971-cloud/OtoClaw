export interface CaptureInput {
	sessionId: string;
	region?: { x: number; y: number; w: number; h: number };
}

export interface CaptureResult {
	frameId: string;
	path: string;
}

export interface DescribeInput {
	sessionId: string;
	frameId: string;
	prompt?: string;
}

export interface DescribeResult {
	text: string;
}

export async function capture(_input: CaptureInput): Promise<CaptureResult> {
	throw new Error("not implemented — Phase 4d");
}

export async function describe(_input: DescribeInput): Promise<DescribeResult> {
	throw new Error("not implemented — Phase 4d");
}
