import { type AnchorHTMLAttributes, type MouseEvent, useEffect } from "react";
import { useAbsoluteLocation } from "~/hooks/app/routing";

export interface AppLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
	/** The in-app address to open. */
	href: string;
}

/** A link to an address inside the app, opened without reloading the window. */
export function AppLink({ href, onClick, children, ...other }: AppLinkProps) {
	const [, navigate] = useAbsoluteLocation();

	const open = (event: MouseEvent<HTMLAnchorElement>) => {
		onClick?.(event);
		if (event.defaultPrevented || event.button !== 0) return;
		if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
		event.preventDefault();
		navigate(href);
	};

	return (
		<a
			href={href}
			onClick={open}
			{...other}
		>
			{children}
		</a>
	);
}

/** Replaces the current address with another one inside the app. */
export function AppRedirect({ to }: { to: string }) {
	const [, navigate] = useAbsoluteLocation();

	useEffect(() => {
		navigate(to, { replace: true });
	}, [to]);

	return null;
}
