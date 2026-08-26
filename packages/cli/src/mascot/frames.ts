/**
 * Hand-authored ASCII frame sequences (no Kitty/sixel/image protocols — plain text
 * so it works in any terminal). Each entry is a full animation loop; the ticker in
 * MascotView.tsx cycles through them to fake fluid motion, not a static swap.
 */
export const THINKING_FRAMES: string[] = [
	"  (o.o)  \n  /|-|\\  \n   / \\   ",
	"  (o.-)  \n  /|-|\\  \n   / \\   ",
	"  (-.-)  \n  /|-|\\  \n   / \\   ",
	"  (o.-)  \n  /|-|\\  \n   / \\   ",
];

export const CODING_FRAMES: string[] = [
	"  (o.o)  \n  /|=|\\  \n  <_ _>  ",
	"  (o.o)  \n  /|-|\\  \n  <_/_>  ",
	"  (^.^)  \n  /|=|\\  \n  <\\_ >  ",
	"  (o.o)  \n  /|-|\\  \n  <_ \\>  ",
];

/** Everything else in the 10-state vocabulary falls back to a neutral idle look for now. */
export const IDLE_FRAMES: string[] = ["  (o.o)  \n  /| |\\  \n   / \\   "];
