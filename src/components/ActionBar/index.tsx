import { adapter } from "~/adapter";
import { DatabaseServing } from "./serving";

export function ActionBar() {
	return <>{adapter.isServeSupported && <DatabaseServing />}</>;
}
