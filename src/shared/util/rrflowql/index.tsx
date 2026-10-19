import type { RRFlowQL } from "./contract";
import { NativeRRFlowQL } from "./native";

export function createRRFlowQL(): RRFlowQL {
	return new NativeRRFlowQL();
}
