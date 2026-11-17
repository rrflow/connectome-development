import { matchPath, useAbsoluteLocation } from "../app/routing";

export function useGlowOffset() {
	const [location] = useAbsoluteLocation();

	switch (true) {
		case matchPath("/overview", location) !== null:
			return 50;
		case matchPath("/c/:connection/dashboard", location) !== null:
			return 125;
		case matchPath("/c/:connection/:view", location) !== null:
			return 500;
		default:
			return 125;
	}
}
