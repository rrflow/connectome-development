/**
 * Connectome's icon set.
 *
 * Every icon the interface draws is named here and resolves to a 24×24 SVG
 * path from Material Design Icons (`@mdi/js`, Apache-2.0, listed in the
 * application's Licenses tab). Components render them with `~/components/Icon`.
 * Nothing else may import an icon library directly: one name per concept,
 * one place to change it.
 */
import {
	mdiAccessPoint,
	mdiAccount,
	mdiAccountPlus,
	mdiAlert,
	mdiAlertCircle,
	mdiApi,
	mdiAppleKeyboardCommand,
	mdiAppleKeyboardControl,
	mdiAppleKeyboardOption,
	mdiAppleKeyboardShift,
	mdiArrowCollapse,
	mdiArrowExpand,
	mdiArrowLeft,
	mdiArrowLeftBold,
	mdiArrowLeftBottom,
	mdiArrowRightTop,
	mdiArrowTopRight,
	mdiAutoFix,
	mdiBackupRestore,
	mdiBookOpenVariant,
	mdiBrain,
	mdiBroadcast,
	mdiBroadcastOff,
	mdiBug,
	mdiBullhorn,
	mdiCancel,
	mdiChartLine,
	mdiChat,
	mdiCheck,
	mdiChevronDown,
	mdiChevronLeft,
	mdiChevronRight,
	mdiChevronUp,
	mdiCircle,
	mdiCircleOutline,
	mdiClockOutline,
	mdiClose,
	mdiCodeBraces,
	mdiCodeJson,
	mdiCodeTags,
	mdiCog,
	mdiCommentOutline,
	mdiConsole,
	mdiContentCopy,
	mdiCubeOutline,
	mdiCurrencyUsd,
	mdiCursorDefault,
	mdiDatabase,
	mdiDatabaseLock,
	mdiDelete,
	mdiDotsVertical,
	mdiDownload,
	mdiEye,
	mdiEyeOff,
	mdiFileOutline,
	mdiFilterVariant,
	mdiFlag,
	mdiFolderLock,
	mdiFolderOpen,
	mdiFolderOutline,
	mdiFormatListBulleted,
	mdiFormatListNumbered,
	mdiFormatText,
	mdiFullscreen,
	mdiFunctionVariant,
	mdiGraphql,
	mdiHammer,
	mdiHelpCircleOutline,
	mdiHistory,
	mdiHomePlus,
	mdiImage,
	mdiKeyVariant,
	mdiMagnify,
	mdiMagnifyMinusOutline,
	mdiMagnifyPlusOutline,
	mdiMapMarker,
	mdiMemory,
	mdiNewspaperVariantOutline,
	mdiOpenInNew,
	mdiPause,
	mdiPencil,
	mdiPin,
	mdiPinOff,
	mdiPlay,
	mdiPlus,
	mdiPower,
	mdiRefresh,
	mdiRelationManyToMany,
	mdiRestore,
	mdiRoutes,
	mdiScaleBalance,
	mdiServer,
	mdiServerSecurity,
	mdiSetMerge,
	mdiShieldAccount,
	mdiShieldKey,
	mdiStar,
	mdiStarPlus,
	mdiStop,
	mdiSwapHorizontal,
	mdiTable,
	mdiTableLarge,
	mdiTableSearch,
	mdiTag,
	mdiTarget,
	mdiTestTube,
	mdiTextBox,
	mdiTextBoxMinus,
	mdiTextBoxPlus,
	mdiTrashCan,
	mdiTune,
	mdiUpload,
	mdiVariable,
	mdiVectorSquareEdit,
	mdiWrench,
	mdiXml,
} from "@mdi/js";

// Navigation and layout
export const iconArrowLeft = mdiArrowLeft;
export const iconArrowLeftFat = mdiArrowLeftBold;
export const iconArrowUpRight = mdiArrowTopRight;
export const iconChevronDown = mdiChevronDown;
export const iconChevronLeft = mdiChevronLeft;
export const iconChevronRight = mdiChevronRight;
export const iconChevronUp = mdiChevronUp;
export const iconClose = mdiClose;
export const iconCog = mdiCog;
export const iconDotsVertical = mdiDotsVertical;
export const iconFullscreen = mdiFullscreen;
export const iconMaximize = mdiArrowExpand;
export const iconMinimize = mdiArrowCollapse;
export const iconOpen = mdiOpenInNew;
export const iconOpenFolder = mdiFolderOpen;
export const iconPin = mdiPin;
export const iconPinOff = mdiPinOff;
export const iconRoutes = mdiRoutes;
export const iconSearch = mdiMagnify;
export const iconMagnifyMinus = mdiMagnifyMinusOutline;
export const iconMagnifyPlus = mdiMagnifyPlusOutline;
export const iconTune = mdiTune;

// Actions
export const iconAutoFix = mdiAutoFix;
export const iconCancel = mdiCancel;
export const iconCheck = mdiCheck;
export const iconCopy = mdiContentCopy;
export const iconDelete = mdiDelete;
export const iconDownload = mdiDownload;
export const iconEye = mdiEye;
export const iconEyeOff = mdiEyeOff;
export const iconEdit = mdiPencil;
export const iconPause = mdiPause;
export const iconPlay = mdiPlay;
export const iconPlus = mdiPlus;
export const iconPower = mdiPower;
export const iconRefresh = mdiRefresh;
export const iconReset = mdiRestore;
export const iconRestore = mdiBackupRestore;
export const iconStop = mdiStop;
export const iconTransfer = mdiSwapHorizontal;
export const iconTrash = mdiTrashCan;
export const iconUpload = mdiUpload;

// Status and feedback
export const iconBroadcastOff = mdiBroadcastOff;
export const iconBroadcastOn = mdiBroadcast;
export const iconBug = mdiBug;
export const iconCircle = mdiCircleOutline;
export const iconCircleFilled = mdiCircle;
export const iconClock = mdiClockOutline;
export const iconErrorCircle = mdiAlertCircle;
export const iconFlag = mdiFlag;
export const iconHelp = mdiHelpCircleOutline;
export const iconHistory = mdiHistory;
export const iconLive = mdiAccessPoint;
export const iconMarker = mdiMapMarker;
export const iconStar = mdiStar;
export const iconStarPlus = mdiStarPlus;
export const iconTarget = mdiTarget;
export const iconWarning = mdiAlert;

// Data model
export const iconCombined = mdiSetMerge;
export const iconDataTable = mdiTableLarge;
export const iconDatabase = mdiDatabase;
export const iconDatabaseSecure = mdiDatabaseLock;
export const iconDesigner = mdiVectorSquareEdit;
export const iconExplorer = mdiTableSearch;
export const iconFile = mdiFileOutline;
export const iconFilter = mdiFilterVariant;
export const iconFolderSecure = mdiFolderLock;
export const iconFunction = mdiFunctionVariant;
export const iconIndex = mdiFormatListNumbered;
export const iconJSON = mdiCodeJson;
export const iconList = mdiFormatListBulleted;
export const iconModel = mdiCubeOutline;
export const iconModuleML = mdiBrain;
export const iconNamespace = mdiFolderOutline;
export const iconQuery = mdiCodeTags;
export const iconRelation = mdiRelationManyToMany;
export const iconRelationIn = mdiArrowLeftBottom;
export const iconRelationOut = mdiArrowRightTop;
export const iconTable = mdiTable;
export const iconTag = mdiTag;
export const iconText = mdiFormatText;
export const iconTextBox = mdiTextBox;
export const iconTextBoxMinus = mdiTextBoxMinus;
export const iconTextBoxPlus = mdiTextBoxPlus;
export const iconVariable = mdiVariable;
export const iconXml = mdiXml;
export const iconBraces = mdiCodeBraces;
export const iconGraphql = mdiGraphql;

// Runtime, estate and security
export const iconAPI = mdiApi;
export const iconAccount = mdiAccount;
export const iconAccountPlus = mdiAccountPlus;
export const iconAccountSecure = mdiShieldAccount;
export const iconAuth = mdiShieldKey;
export const iconConsole = mdiConsole;
export const iconKey = mdiKeyVariant;
export const iconMemory = mdiMemory;
export const iconSandbox = mdiTestTube;
export const iconServer = mdiServer;
export const iconServerSecure = mdiServerSecurity;

// Communication and content
export const iconBalance = mdiScaleBalance;
export const iconBook = mdiBookOpenVariant;
export const iconBullhorn = mdiBullhorn;
export const iconChart = mdiChartLine;
export const iconChat = mdiChat;
export const iconComment = mdiCommentOutline;
export const iconDollar = mdiCurrencyUsd;
export const iconHammer = mdiHammer;
export const iconHomePlus = mdiHomePlus;
export const iconImage = mdiImage;
export const iconNewspaper = mdiNewspaperVariantOutline;
export const iconWrench = mdiWrench;

// Keyboard
export const iconCommand = mdiAppleKeyboardCommand;
export const iconCursor = mdiCursorDefault;
export const iconKeyboardControl = mdiAppleKeyboardControl;
export const iconKeyboardOption = mdiAppleKeyboardOption;
export const iconKeyboardShift = mdiAppleKeyboardShift;
