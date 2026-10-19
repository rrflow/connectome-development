/** RRFlow-owned presentation primitives for the authored Connectome client. */
import {
	ActionIcon,
	Box,
	type BoxProps,
	CopyButton,
	createTheme,
	type MantineSize,
} from "@mantine/core";
import * as mdi from "@mdi/js";
import clsx from "clsx";
import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { highlightCode } from "./highlight";

export type EditorStateSnapshot = {
	doc: string;
	[key: string]: unknown;
};

const ICON_SIZES: Record<MantineSize, number> = { xs: 0.5, sm: 0.75, md: 1, lg: 1.25, xl: 1.5 };

export interface IconProps
	extends BoxProps,
		Omit<ComponentPropsWithoutRef<"svg">, keyof BoxProps | "color" | "children"> {
	path: string;
	title?: string;
	size?: MantineSize | number;
	color?: string;
	flip?: "horizontal" | "vertical" | "both";
	spin?: boolean | number;
}

export function Icon({
	path,
	size = 1,
	color,
	c,
	flip,
	spin,
	className,
	title,
	style,
	...other
}: IconProps) {
	const scale = typeof size === "number" ? size : ICON_SIZES[size];
	const transform = flip
		? `scale(${flip === "horizontal" || flip === "both" ? -1 : 1}, ${flip === "vertical" || flip === "both" ? -1 : 1})`
		: undefined;

	return (
		<Box
			component="svg"
			viewBox="0 0 24 24"
			w={24 * scale}
			h={24 * scale}
			c={c ?? color}
			fill="currentColor"
			aria-hidden={title ? undefined : true}
			role={title ? "img" : undefined}
			aria-label={title}
			className={clsx("rrflow-icon", spin && "rrflow-icon-spinning", className)}
			style={[
				{ animationDuration: typeof spin === "number" ? `${spin}s` : undefined },
				...(Array.isArray(style) ? style : [style]),
			]}
			{...other}
		>
			{title && <title>{title}</title>}
			<path
				d={path}
				style={{ transform, transformOrigin: "12px 12px" }}
			/>
		</Box>
	);
}

export interface SpacerProps extends BoxProps {
	grow?: boolean | number;
}

export function Spacer({ grow = 1, style, ...other }: SpacerProps) {
	return (
		<Box
			style={[
				{ flexGrow: Number(grow), minWidth: 0 },
				...(Array.isArray(style) ? style : [style]),
			]}
			{...other}
		/>
	);
}

export interface CodeBlockProps extends BoxProps {
	value: string;
	lang?: string;
	title?: string;
}

/** Text remains selectable and copyable without loading an editor or a remote renderer. */
export function CodeBlock({ value, lang, title, className, ...other }: CodeBlockProps) {
	return (
		<Box
			className={clsx("rrflow-code-block", className)}
			{...other}
		>
			{title && <Box className="rrflow-code-title">{title}</Box>}
			<CopyButton value={value}>
				{({ copied, copy }) => (
					<ActionIcon
						className="rrflow-code-copy"
						variant="subtle"
						color={copied ? "green" : "gray"}
						onClick={copy}
						aria-label={copied ? "Copied code" : "Copy code"}
						title={copied ? "Copied" : "Copy"}
					>
						<Icon
							path={copied ? mdi.mdiCheck : mdi.mdiContentCopy}
							size="sm"
						/>
					</ActionIcon>
				)}
			</CopyButton>
			<pre>
				<code className={lang ? `language-${lang}` : undefined}>
					{highlightCode(value, lang)}
				</code>
			</pre>
		</Box>
	);
}

export interface MarkdownProps extends BoxProps {
	content: string;
}

/** Markdown is parsed as React nodes; embedded HTML is never executed. */
export function Markdown({ content, className, ...other }: MarkdownProps) {
	return (
		<Box
			className={clsx("rrflow-markdown", className)}
			{...other}
		>
			<ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
		</Box>
	);
}

export const MANTINE_THEME = createTheme({
	primaryColor: "violet",
	defaultRadius: "sm",
	fontFamily: 'Inter, "Segoe UI", sans-serif',
	fontFamilyMonospace: '"JetBrains Mono", "Cascadia Code", Consolas, monospace',
	headings: { fontFamily: 'Inter, "Segoe UI", sans-serif', fontWeight: "600" },
	defaultGradient: { from: "violet.6", to: "pink.6", deg: 135 },
	colors: {
		bright: [
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
			"var(--rrflow-color-bright)",
		],
		obsidian: [
			"#f5f3f8",
			"#e8e4ef",
			"#c9c2d7",
			"#aaa0bd",
			"#877b9d",
			"#665975",
			"#493d58",
			"#2d2438",
			"#201829",
			"#15111f",
		],
	},
});

// Material Design icons are an explicit third-party asset dependency, separate from RRFlow code.
export const iconAPI = mdi.mdiApi;
export const iconAccount = mdi.mdiAccount;
export const iconAccountPlus = mdi.mdiAccountPlus;
export const iconAccountSecure = mdi.mdiAccountLock;
export const iconArrowDownFat = mdi.mdiArrowDownBold;
export const iconArrowLeft = mdi.mdiArrowLeft;
export const iconArrowLeftFat = mdi.mdiArrowLeftBold;
export const iconArrowUpRight = mdi.mdiArrowTopRight;
export const iconAuth = mdi.mdiShieldLock;
export const iconAutoFix = mdi.mdiAutoFix;
export const iconBalance = mdi.mdiScaleBalance;
export const iconBook = mdi.mdiBookOpenVariant;
export const iconBraces = mdi.mdiCodeBraces;
export const iconBroadcastOff = mdi.mdiBroadcastOff;
export const iconBroadcastOn = mdi.mdiBroadcast;
export const iconBug = mdi.mdiBug;
export const iconBullhorn = mdi.mdiBullhorn;
export const iconCancel = mdi.mdiCancel;
export const iconChart = mdi.mdiChartLine;
export const iconChat = mdi.mdiChat;
export const iconCheck = mdi.mdiCheck;
export const iconChevronDown = mdi.mdiChevronDown;
export const iconChevronLeft = mdi.mdiChevronLeft;
export const iconChevronRight = mdi.mdiChevronRight;
export const iconChevronUp = mdi.mdiChevronUp;
export const iconChevronY = mdi.mdiUnfoldMoreHorizontal;
export const iconCircle = mdi.mdiCircleOutline;
export const iconCircleFilled = mdi.mdiCircle;
export const iconClock = mdi.mdiClockOutline;
export const iconClose = mdi.mdiClose;
export const iconCloud = mdi.mdiCloudOutline;
export const iconCog = mdi.mdiCog;
export const iconCombined = mdi.mdiVectorCombine;
export const iconCommand = mdi.mdiAppleKeyboardCommand;
export const iconComment = mdi.mdiCommentTextOutline;
export const iconConsole = mdi.mdiConsole;
export const iconCopy = mdi.mdiContentCopy;
export const iconCreditCard = mdi.mdiCreditCardOutline;
export const iconCursor = mdi.mdiCursorDefault;
export const iconDataTable = mdi.mdiTableLarge;
export const iconDatabase = mdi.mdiDatabase;
export const iconDatabaseSecure = mdi.mdiDatabaseLock;
export const iconDelete = mdi.mdiDeleteOutline;
export const iconDesigner = mdi.mdiVectorBezier;
export const iconDollar = mdi.mdiCurrencyUsd;
export const iconDotsVertical = mdi.mdiDotsVertical;
export const iconDownload = mdi.mdiDownload;
export const iconEdit = mdi.mdiPencil;
export const iconErrorCircle = mdi.mdiAlertCircle;
export const iconExitToAp = mdi.mdiLogout;
export const iconExplorer = mdi.mdiTableSearch;
export const iconEye = mdi.mdiEye;
export const iconEyeOff = mdi.mdiEyeOff;
export const iconFile = mdi.mdiFileOutline;
export const iconFilter = mdi.mdiFilterVariant;
export const iconFlag = mdi.mdiFlagOutline;
export const iconFolderSecure = mdi.mdiFolderLock;
export const iconFullscreen = mdi.mdiFullscreen;
export const iconFunction = mdi.mdiFunction;
export const iconGraphql = mdi.mdiGraphql;
export const iconHammer = mdi.mdiHammer;
export const iconHelp = mdi.mdiHelpCircleOutline;
export const iconHistory = mdi.mdiHistory;
export const iconHomePlus = mdi.mdiHomePlus;
export const iconImage = mdi.mdiImageOutline;
export const iconIndex = mdi.mdiFormatListNumbered;
export const iconInfo = mdi.mdiInformationOutline;
export const iconJSON = mdi.mdiCodeJson;
export const iconKey = mdi.mdiKey;
export const iconKeyboardControl = mdi.mdiAppleKeyboardControl;
export const iconKeyboardOption = mdi.mdiAppleKeyboardOption;
export const iconKeyboardShift = mdi.mdiAppleKeyboardShift;
export const iconList = mdi.mdiFormatListBulleted;
export const iconLive = mdi.mdiAccessPoint;
export const iconMagnifyMinus = mdi.mdiMagnifyMinusOutline;
export const iconMagnifyPlus = mdi.mdiMagnifyPlusOutline;
export const iconMarker = mdi.mdiMapMarker;
export const iconMaximize = mdi.mdiWindowMaximize;
export const iconMemory = mdi.mdiMemory;
export const iconMinimize = mdi.mdiWindowMinimize;
export const iconModel = mdi.mdiCubeOutline;
export const iconModuleML = mdi.mdiBrain;
export const iconNamespace = mdi.mdiFolderMultipleOutline;
export const iconNewspaper = mdi.mdiNewspaper;
export const iconOpen = mdi.mdiOpenInNew;
export const iconOpenFolder = mdi.mdiFolderOpen;
export const iconOrganization = mdi.mdiDomain;
export const iconPackageClosed = mdi.mdiPackageVariantClosed;
export const iconPause = mdi.mdiPause;
export const iconPin = mdi.mdiPinOutline;
export const iconPinOff = mdi.mdiPinOffOutline;
export const iconPlay = mdi.mdiPlay;
export const iconPlus = mdi.mdiPlus;
export const iconPower = mdi.mdiPower;
export const iconProgressClock = mdi.mdiProgressClock;
export const iconQuery = mdi.mdiCodeBraces;
export const iconReferral = mdi.mdiAccountGroup;
export const iconRefresh = mdi.mdiRefresh;
export const iconRelation = mdi.mdiGraph;
export const iconRelationIn = mdi.mdiArrowBottomLeft;
export const iconRelationOut = mdi.mdiArrowTopRight;
export const iconReset = mdi.mdiRestore;
export const iconRestore = mdi.mdiWindowRestore;
export const iconRoutes = mdi.mdiRoutes;
export const iconSandbox = mdi.mdiFlaskOutline;
export const iconSearch = mdi.mdiMagnify;
export const iconServer = mdi.mdiServer;
export const iconServerSecure = mdi.mdiServerSecurity;
export const iconSidekick = mdi.mdiRobotOutline;
export const iconStar = mdi.mdiStarOutline;
export const iconStarPlus = mdi.mdiStarPlusOutline;
export const iconStop = mdi.mdiStop;
export const iconTable = mdi.mdiTable;
export const iconTag = mdi.mdiTagOutline;
export const iconTarget = mdi.mdiTarget;
export const iconText = mdi.mdiText;
export const iconTextBox = mdi.mdiTextBoxOutline;
export const iconTextBoxMinus = mdi.mdiTextBoxMinusOutline;
export const iconTextBoxPlus = mdi.mdiTextBoxPlusOutline;
export const iconTransfer = mdi.mdiSwapHorizontal;
export const iconTrash = mdi.mdiTrashCanOutline;
export const iconTune = mdi.mdiTune;
export const iconUpload = mdi.mdiUpload;
export const iconVariable = mdi.mdiVariable;
export const iconWarning = mdi.mdiAlertOutline;
export const iconWrench = mdi.mdiWrench;
export const iconXml = mdi.mdiXml;

/** Original RRFlow pictograms, embedded so desktop and cloud share offline assets. */
function pictogram(body: string) {
	return `data:image/svg+xml,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96"><defs><linearGradient id="rrflow" x2="1" y2="1"><stop stop-color="#8b5cf6"/><stop offset="1" stop-color="#ec4899"/></linearGradient></defs><rect x="4" y="4" width="88" height="88" rx="24" fill="#201829"/><g stroke="url(#rrflow)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none">${body}</g></svg>`)}`;
}

export const pictoBrain = pictogram(
	'<path d="M48 25v46M48 30c-15-17-32 4-21 15-14 13 4 31 16 20M48 30c15-17 32 4 21 15 14 13-4 31-16 20M27 45l12 3M69 45l-12 3M36 31l3 7M60 31l-3 7M35 59l5-4M61 59l-5-4"/>',
);
export const pictoRRFlowCloud = pictogram(
	'<path d="M27 64h42a12 12 0 0 0 1-24 22 22 0 0 0-42-5 15 15 0 0 0-1 29Z"/><path d="M38 49l10-9 10 9M48 40v29"/>',
);
export const pictoSidekick = pictogram(
	'<rect x="25" y="33" width="46" height="36" rx="11"/><path d="M48 23v10M33 52h3M60 52h3M39 61h18M19 45v14M77 45v14"/>',
);
export const pictoBadgeAccess = pictogram(
	'<path d="M48 21l25 10v17c0 14-11 23-25 29-14-6-25-15-25-29V31Z"/><path d="M36 49l8 8 17-19"/>',
);
export const pictoChatHeart = pictogram(
	'<path d="M24 28h48v34H44L28 74V62h-4Z"/><path d="M48 53l-11-9a7 7 0 0 1 11-9 7 7 0 0 1 11 9Z"/>',
);
export const pictoHealthChat = pictogram(
	'<path d="M24 28h48v34H44L28 74V62h-4Z"/><path d="M39 45h18M48 36v18"/>',
);
export const pictoDocument = pictogram(
	'<path d="M29 20h26l14 15v41H29Z"/><path d="M55 20v16h14M38 48h22M38 58h22M38 68h13"/>',
);
export const pictoFullTextSearch = pictogram(
	'<circle cx="43" cy="42" r="19"/><path d="M57 57l18 18M34 36h18M34 43h18M34 50h11"/>',
);
export const pictoGitHub = pictogram(
	'<circle cx="33" cy="28" r="7"/><circle cx="63" cy="32" r="7"/><circle cx="33" cy="68" r="7"/><path d="M33 35v26M63 39v7c0 10-30 4-30 15"/>',
);
export const pictoDiscord = pictogram(
	'<path d="M21 31h41v29H39L27 70V60h-6Z"/><path d="M62 39h13v31H61L49 79V68M32 42h19M32 50h13"/>',
);
export const pictoHandsOn = pictogram(
	'<path d="M28 50V30a5 5 0 0 1 10 0v17-24a5 5 0 0 1 10 0v24-21a5 5 0 0 1 10 0v23-15a5 5 0 0 1 10 0v25c0 15-8 21-20 21H40c-6 0-9-4-12-9L17 54a5 5 0 0 1 8-6l9 9"/>',
);
export const pictoPlay = pictogram(
	'<circle cx="48" cy="48" r="28"/><path d="M41 34l21 14-21 14Z"/>',
);
export const pictoUniversity = pictogram(
	'<path d="M18 36l30-15 30 15-30 15Z"/><path d="M29 43v22c13 9 25 9 38 0V43M78 37v27"/>',
);
