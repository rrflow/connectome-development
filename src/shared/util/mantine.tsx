import {
	ActionIcon,
	Alert,
	Anchor,
	Autocomplete,
	Badge,
	Button,
	Checkbox,
	CloseButton,
	Drawer,
	Indicator,
	InputBase,
	type MantineThemeOverride,
	Modal,
	MultiSelect,
	Notification,
	NumberInput,
	Paper,
	PasswordInput,
	rem,
	ScrollArea,
	Select,
	Switch,
	TagsInput,
	Textarea,
	TextInput,
	ThemeIcon,
	Title,
	Tooltip,
} from "@mantine/core";

/**
 * Connectome's Mantine theme.
 *
 * Type, spacing, radii, the two neutral scales (`obsidian`, `slate`), the
 * accent scale (`rrflow`) and the gradient are defined here and nowhere
 * else; the matching CSS custom properties live in
 * `src/shared/assets/styles/theme.scss`. Components use Mantine's built-in
 * variants with Connectome defaults. When ColdLight's generated tokens are
 * adopted, this file maps them into Mantine; nothing else changes.
 */

const ICON_SIZES: Record<string, number> = {
	xs: 0.5,
	sm: 0.75,
	md: 1,
	lg: 1.25,
	xl: 1.5,
};

/** Near-black violet-tinted neutrals, the surface of the dark scheme. */
const OBSIDIAN = [
	"#F5F5F7",
	"#E9E7ED",
	"#DEDCE4",
	"#A29FAC",
	"#888495",
	"#595466",
	"#3D3948",
	"#201D29",
	"#16141F",
	"#0E0C14",
] as const;

/** Cool blue-tinted neutrals for secondary surfaces and text. */
const SLATE = [
	"#F5F6F7",
	"#E7E9ED",
	"#DCDFE4",
	"#9AA1AB",
	"#848B95",
	"#6F7988",
	"#393F48",
	"#1D2229",
	"#14191F",
	"#0C0F14",
] as const;

/** Connectome's accent: a violet scale, the "from" end of the gradient. */
const RRFLOW = [
	"#F1EDFF",
	"#E0D7FF",
	"#C4B3FF",
	"#A58BFF",
	"#8B6CFF",
	"#7C5CF6",
	"#6E4CE8",
	"#5B3CC9",
	"#4A30A6",
	"#3A2683",
] as const;

export const CONNECTOME_GRADIENT = {
	from: "var(--connectome-gradient-from)",
	to: "var(--connectome-gradient-to)",
	deg: 135,
};

export const CONNECTOME_THEME: MantineThemeOverride = {
	fontFamily: "'Inter Variable', Inter, system-ui, sans-serif",
	fontFamilyMonospace: "'JetBrains Mono Variable', 'JetBrains Mono', ui-monospace, monospace",
	primaryColor: "obsidian",
	primaryShade: 6,
	defaultRadius: "xs",
	fontSizes: {
		xs: rem(12),
		sm: rem(13),
		md: rem(14),
		lg: rem(16),
		xl: rem(18),
	},
	headings: {
		fontWeight: "600",
		sizes: {
			h1: { fontSize: rem(32), fontWeight: "700" },
			h2: { fontSize: rem(26), fontWeight: "600" },
			h3: { fontSize: rem(22), fontWeight: "500" },
			h4: { fontSize: rem(18), fontWeight: "500" },
			h5: { fontSize: rem(16), fontWeight: "500" },
			h6: { fontSize: rem(14), fontWeight: "800" },
		},
	},
	spacing: {
		xs: rem(4),
		sm: rem(8),
		md: rem(12),
		lg: rem(16),
		xl: rem(24),
		"2xl": rem(32),
		"3xl": rem(52),
	},
	radius: {
		xs: rem(4),
		sm: rem(8),
		md: rem(12),
		lg: rem(20),
		xl: rem(30),
	},
	colors: {
		obsidian: [...OBSIDIAN],
		slate: [...SLATE],
		rrflow: [...RRFLOW],
		violet: [...RRFLOW],
	},
	defaultGradient: CONNECTOME_GRADIENT,
	components: {
		ActionIcon: ActionIcon.extend({
			defaultProps: {
				radius: "xl",
				size: "lg",
				variant: "subtle",
				color: "obsidian",
			},
		}),
		ThemeIcon: ThemeIcon.extend({
			defaultProps: {
				radius: "xl",
				size: "lg",
				variant: "light",
			},
		}),
		Alert: Alert.extend({
			defaultProps: {
				variant: "light",
			},
		}),
		Anchor: Anchor.extend({
			defaultProps: {
				c: "rrflow.4",
			},
		}),
		Badge: Badge.extend({
			defaultProps: {
				variant: "light",
			},
		}),
		Button: Button.extend({
			defaultProps: {
				radius: "xl",
				variant: "light",
			},
		}),
		CloseButton: CloseButton.extend({
			defaultProps: {
				size: "lg",
				radius: "xl",
				variant: "subtle",
			},
		}),
		Drawer: Drawer.extend({
			defaultProps: {
				withCloseButton: false,
			},
		}),
		Title: Title.extend({
			defaultProps: {
				fz: "xl",
				c: "bright",
			},
		}),
		Checkbox: Checkbox.extend({
			defaultProps: {
				variant: "gradient",
			},
		}),
		Switch: Switch.extend({
			defaultProps: {
				variant: "gradient",
				withThumbIndicator: false,
			},
		}),
		Paper: Paper.extend({
			defaultProps: {
				radius: "xs",
				withBorder: true,
			},
		}),
		ScrollArea: ScrollArea.extend({
			defaultProps: {
				scrollbarSize: 8,
				scrollbars: "y",
				type: "scroll",
			},
		}),
		Tooltip: Tooltip.extend({
			defaultProps: {
				radius: "xs",
			},
		}),
		Modal: Modal.extend({
			defaultProps: {
				size: "lg",
				radius: "sm",
				withCloseButton: false,
			},
		}),
		Autocomplete: Autocomplete.extend({
			defaultProps: {
				spellCheck: false,
				variant: "filled",
				scrollAreaProps: {
					scrollbars: "y",
				},
			},
		}),
		Select: Select.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		MultiSelect: MultiSelect.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		InputBase: InputBase.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		TextInput: TextInput.extend({
			defaultProps: {
				spellCheck: false,
				variant: "filled",
			},
		}),
		NumberInput: NumberInput.extend({
			defaultProps: {
				spellCheck: false,
				variant: "filled",
			},
		}),
		PasswordInput: PasswordInput.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		Textarea: Textarea.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		TagsInput: TagsInput.extend({
			defaultProps: {
				variant: "filled",
			},
		}),
		Notification: Notification.extend({
			defaultProps: {
				variant: "spaced",
			},
		}),
		Indicator: Indicator.extend({
			defaultProps: {
				color: "rrflow",
			},
		}),
	},
};

/**
 * Returns the variable for a Mantine color
 *
 * @param name The name of the color, with optional shade
 * @returns The variable name
 */
export function themeColor(name: string) {
	let value: string;

	if (name === "white" || name === "black") {
		value = name;
	} else if (name.includes(".")) {
		value = name.replace(".", "-");
	} else {
		value = `${name}-6`;
	}

	return `var(--mantine-color-${value})`;
}

/**
 * Parse the icon size into a number
 *
 * @param size The size to parse
 * @returns The size as a number
 */
export function getIconSize(size: string | number | undefined): number {
	if (size === undefined) {
		return 1;
	}

	if (typeof size === "number") {
		return size;
	}

	return ICON_SIZES[size] || 1;
}
