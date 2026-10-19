import { Language, LanguageSupport } from "@codemirror/language";
import { rrflowqlLanguageData, rrflowqlPresentationParser } from "./parser";

/** RRFlow-authored editor support; semantic parsing remains owned by RRD. */
export const rrflowqlLanguage = new Language(
	rrflowqlLanguageData,
	rrflowqlPresentationParser,
	[],
	"RRFlowQL",
);

export function rrflowql(): LanguageSupport {
	return new LanguageSupport(rrflowqlLanguage);
}
