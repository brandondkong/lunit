import { coverageRows, formatPercent, totalPercent } from "../core/coverage";
import { parseLocation, stripLocation } from "../core/location";
import { classStatus, countStatuses, parseQuery, TestRow, testNames, visible, VisibleClass } from "../core/tree";
import { canLoadSource } from "../studio/loader";
import { Outcome, Session } from "../studio/session";
import { make, padding } from "./make";
import { coverageColor, onThemeChanged, statusColor, statusGlyph, themeColor } from "./theme";

const C = Enum.StudioStyleGuideColor;
const ROW_HEIGHT = 22;
const HEADER_HEIGHT = 32;
const SEARCH_HEIGHT = 28;
const TABS_HEIGHT = 24;
const DETAILS_HEIGHT = 140;
const FONT = Font.fromEnum(Enum.Font.SourceSans);
const CODE_FONT = Font.fromEnum(Enum.Font.Code);

type Tab = "tests" | "coverage";

interface Selection {
	title: string;
	message: string;
	/** Full name of the module to open when the message has no location. */
	modulePath: string;
}

/**
 * The Lunit panel: run buttons, a search box, the test tree, a coverage view
 * and details for the selected test. Rows are rebuilt on every render, which
 * is fast enough for a few hundred tests.
 */
export class App {
	private readonly session = new Session();
	private readonly connections: RBXScriptConnection[] = [];
	private query = "";
	private tab: Tab = "tests";
	private coverageOn = false;
	private busy = false;
	private banner?: { text: string; isError: boolean };
	private selected?: Selection;

	private readonly root: Frame;
	private readonly runButton: TextButton;
	private readonly refreshButton: TextButton;
	private readonly coverageButton: TextButton;
	private readonly status: TextLabel;
	private readonly search: TextBox;
	private readonly testsTab: TextButton;
	private readonly coverageTab: TextButton;
	private readonly content: ScrollingFrame;
	private readonly details: Frame;
	private readonly detailsTitle: TextLabel;
	private readonly detailsText: TextBox;
	private readonly openButton: TextButton;

	public constructor(
		private readonly plugin: Plugin,
		parent: Instance,
	) {
		this.runButton = this.button("Run all", 70);
		this.refreshButton = this.button("Refresh", 64);
		this.coverageButton = this.button("☐ Coverage", 84);
		this.status = make("TextLabel", {
			BackgroundTransparency: 1,
			FontFace: FONT,
			TextSize: 14,
			TextXAlignment: Enum.TextXAlignment.Right,
			TextTruncate: Enum.TextTruncate.AtEnd,
			Size: new UDim2(1, -230, 1, 0),
			LayoutOrder: 4,
		});
		const header = make("Frame", { BackgroundTransparency: 1, Size: new UDim2(1, 0, 0, HEADER_HEIGHT) }, [
			make("UIListLayout", {
				FillDirection: Enum.FillDirection.Horizontal,
				Padding: new UDim(0, 4),
				SortOrder: Enum.SortOrder.LayoutOrder,
				VerticalAlignment: Enum.VerticalAlignment.Center,
			}),
			padding(4),
			this.runButton,
			this.refreshButton,
			this.coverageButton,
			this.status,
		]);
		this.runButton.LayoutOrder = 1;
		this.refreshButton.LayoutOrder = 2;
		this.coverageButton.LayoutOrder = 3;

		this.search = make("TextBox", {
			PlaceholderText: "Search tests, or tag:name",
			Text: "",
			ClearTextOnFocus: false,
			FontFace: FONT,
			TextSize: 14,
			TextXAlignment: Enum.TextXAlignment.Left,
			Size: new UDim2(1, -8, 0, SEARCH_HEIGHT - 6),
			Position: new UDim2(0, 4, 0, HEADER_HEIGHT + 2),
			BorderSizePixel: 1,
		});
		make("UIPadding", { PaddingLeft: new UDim(0, 6) }).Parent = this.search;

		this.testsTab = this.button("Tests", 0);
		this.coverageTab = this.button("Coverage", 0);
		this.testsTab.Size = new UDim2(0.5, -2, 1, 0);
		this.coverageTab.Size = new UDim2(0.5, -2, 1, 0);
		this.coverageTab.Position = new UDim2(0.5, 2, 0, 0);
		const tabs = make(
			"Frame",
			{
				BackgroundTransparency: 1,
				Size: new UDim2(1, -8, 0, TABS_HEIGHT),
				Position: new UDim2(0, 4, 0, HEADER_HEIGHT + SEARCH_HEIGHT),
			},
			[this.testsTab, this.coverageTab],
		);

		const top = HEADER_HEIGHT + SEARCH_HEIGHT + TABS_HEIGHT + 4;
		this.content = make(
			"ScrollingFrame",
			{
				BorderSizePixel: 0,
				Position: new UDim2(0, 0, 0, top),
				Size: new UDim2(1, 0, 1, -top),
				CanvasSize: new UDim2(),
				AutomaticCanvasSize: Enum.AutomaticSize.Y,
				ScrollBarThickness: 8,
			},
			[make("UIListLayout", { SortOrder: Enum.SortOrder.LayoutOrder })],
		);

		this.detailsTitle = make("TextLabel", {
			BackgroundTransparency: 1,
			FontFace: new Font(FONT.Family, Enum.FontWeight.Bold),
			TextSize: 14,
			TextXAlignment: Enum.TextXAlignment.Left,
			TextTruncate: Enum.TextTruncate.AtEnd,
			Size: new UDim2(1, -100, 0, 22),
			Position: new UDim2(0, 6, 0, 2),
		});
		this.openButton = this.button("Open script", 90);
		this.openButton.Position = new UDim2(1, -94, 0, 2);
		this.detailsText = make("TextBox", {
			BackgroundTransparency: 1,
			FontFace: CODE_FONT,
			TextSize: 13,
			TextEditable: false,
			ClearTextOnFocus: false,
			MultiLine: true,
			TextWrapped: true,
			TextXAlignment: Enum.TextXAlignment.Left,
			TextYAlignment: Enum.TextYAlignment.Top,
			Size: new UDim2(1, -12, 1, -30),
			Position: new UDim2(0, 6, 0, 26),
		});
		this.details = make(
			"Frame",
			{
				BorderSizePixel: 1,
				Size: new UDim2(1, 0, 0, DETAILS_HEIGHT),
				Position: new UDim2(0, 0, 1, -DETAILS_HEIGHT),
				Visible: false,
			},
			[this.detailsTitle, this.openButton, this.detailsText],
		);

		this.root = make("Frame", { Size: UDim2.fromScale(1, 1), BorderSizePixel: 0 }, [
			header,
			this.search,
			tabs,
			this.content,
			this.details,
		]);
		this.root.Parent = parent;

		this.connections.push(
			this.runButton.Activated.Connect(() => this.runVisible()),
			this.refreshButton.Activated.Connect(() => this.refresh()),
			this.coverageButton.Activated.Connect(() => {
				this.coverageOn = !this.coverageOn;
				this.render();
			}),
			this.testsTab.Activated.Connect(() => this.setTab("tests")),
			this.coverageTab.Activated.Connect(() => this.setTab("coverage")),
			this.openButton.Activated.Connect(() => this.openSelected()),
			this.search.GetPropertyChangedSignal("Text").Connect(() => {
				this.query = this.search.Text;
				this.render();
			}),
			onThemeChanged(() => this.render()),
		);

		if (!canLoadSource()) {
			this.banner = {
				text: "This Studio does not let plugins compile code, so Lunit cannot load tests.",
				isError: true,
			};
		}
		this.render();
	}

	public destroy() {
		for (const connection of this.connections) connection.Disconnect();
		this.root.Destroy();
	}

	/** Finds the tests again, keeping statuses from earlier runs. */
	public refresh() {
		this.perform("Finding tests…", () => this.session.discover());
	}

	private runVisible() {
		const query = parseQuery(this.query);
		const filtered = query.words.size() > 0 || query.tags.size() > 0;
		const tree = this.session.tree;
		const names = filtered && tree !== undefined ? testNames(visible(tree, query)) : undefined;
		this.perform("Running…", () => this.session.run(names, this.coverageOn));
	}

	private runNames(names: string[]) {
		this.perform("Running…", () => this.session.run(names, this.coverageOn));
	}

	/** Runs a session step off the UI thread, since tests may yield. */
	private perform(label: string, step: () => Outcome) {
		if (this.busy) return;
		this.busy = true;
		this.status.Text = label;
		this.setEnabled(false);
		task.spawn(() => {
			const outcome = step();
			this.busy = false;
			this.setEnabled(true);
			this.banner =
				outcome.error !== undefined
					? { text: outcome.error, isError: true }
					: outcome.warning !== undefined
						? { text: outcome.warning, isError: false }
						: undefined;
			if (this.selected !== undefined) this.reselect();
			this.render();
		});
	}

	private setTab(tab: Tab) {
		this.tab = tab;
		this.render();
	}

	private setEnabled(enabled: boolean) {
		for (const button of [this.runButton, this.refreshButton]) {
			button.Active = enabled;
			button.AutoButtonColor = enabled;
			button.TextTransparency = enabled ? 0 : 0.5;
		}
	}

	// -------------------------------------------------------------------------
	// Rendering
	// -------------------------------------------------------------------------

	private render() {
		this.paint();
		const query = parseQuery(this.query);
		const filtered = query.words.size() > 0 || query.tags.size() > 0;
		this.runButton.Text = filtered ? "Run shown" : "Run all";
		this.coverageButton.Text = `${this.coverageOn ? "☑" : "☐"} Coverage`;
		const coverage = this.session.coverage;
		this.coverageTab.Text =
			coverage !== undefined ? `Coverage ${formatPercent(totalPercent(coverage))}` : "Coverage";
		if (!this.busy) this.status.Text = this.statusText();

		for (const child of this.content.GetChildren()) {
			if (!child.IsA("UIListLayout")) child.Destroy();
		}
		let order = 0;
		const add = (instance: GuiObject) => {
			order += 1;
			instance.LayoutOrder = order;
			instance.Parent = this.content;
		};
		if (this.banner !== undefined) add(this.bannerLabel(this.banner.text, this.banner.isError));
		if (this.tab === "tests") this.renderTests(add, query);
		else this.renderCoverage(add);

		this.details.Visible = this.selected !== undefined;
		const detailsSpace = this.details.Visible ? DETAILS_HEIGHT : 0;
		const top = HEADER_HEIGHT + SEARCH_HEIGHT + TABS_HEIGHT + 4;
		this.content.Size = new UDim2(1, 0, 1, -top - detailsSpace);
		if (this.selected !== undefined) {
			this.detailsTitle.Text = this.selected.title;
			this.detailsText.Text = this.selected.message;
		}
	}

	private statusText(): string {
		const tree = this.session.tree;
		if (tree === undefined) return "";
		const counts = countStatuses(tree);
		const parts: string[] = [];
		if (counts.passed > 0) parts.push(`${counts.passed} passed`);
		if (counts.failed > 0) parts.push(`${counts.failed} failed`);
		if (counts.skipped > 0) parts.push(`${counts.skipped} skipped`);
		if (parts.size() === 0) parts.push(`${counts.pending} tests`);
		const summary = this.session.summary;
		if (summary !== undefined) parts.push(`${math.round(summary.elapsedMs)} ms`);
		return parts.join(" · ");
	}

	private renderTests(add: (instance: GuiObject) => void, query: ReturnType<typeof parseQuery>) {
		const tree = this.session.tree;
		if (tree === undefined) {
			add(this.note("Press Refresh to find tests."));
			return;
		}
		for (const failure of tree.loadFailures) {
			add(
				this.row(0, "failed", `${failure.modulePath} failed to load`, undefined, () =>
					this.select({
						title: failure.modulePath,
						message: failure.message,
						modulePath: failure.modulePath,
					}),
				),
			);
		}
		const shown = visible(tree, query);
		if (shown.size() === 0 && tree.loadFailures.size() === 0) {
			add(
				this.note(
					tree.classes.size() === 0 ? "No *.test or *.spec modules found." : "No tests match the search.",
				),
			);
		}
		for (const entry of shown) this.renderClass(add, entry);
	}

	private renderClass(add: (instance: GuiObject) => void, { cls, tests }: VisibleClass) {
		const arrow = cls.expanded ? "▾" : "▸";
		add(
			this.row(
				0,
				classStatus(cls),
				`${arrow}  ${cls.label}  (${tests.size()})`,
				() => this.runNames(testNames([{ cls, tests }])),
				() => {
					cls.expanded = !cls.expanded;
					this.render();
				},
			),
		);
		if (!cls.expanded) return;
		for (const test of tests) {
			const time =
				test.elapsedMs !== undefined && test.status !== "skipped" ? `  ${math.round(test.elapsedMs)} ms` : "";
			add(
				this.row(
					1,
					test.status,
					`${test.label}${time}`,
					() => this.runNames([`${cls.name}.${test.method}`]),
					() => this.selectTest(cls.label, cls.modulePath, test),
				),
			);
		}
	}

	private renderCoverage(add: (instance: GuiObject) => void) {
		const coverage = this.session.coverage;
		if (coverage === undefined) {
			add(
				this.note(
					this.coverageOn
						? "No coverage data from the last run. Build with tsconfig.coverage.json, sync it, and run again."
						: "Turn on Coverage and run the tests to see which lines ran.",
				),
			);
			return;
		}
		add(
			this.note(
				`Total ${formatPercent(totalPercent(coverage))} (${coverage.linesHit}/${coverage.linesFound} lines). ` +
					"Line numbers are in the TypeScript files.",
			),
		);
		for (const row of coverageRows(coverage)) {
			const frame = make("Frame", {
				BackgroundTransparency: 1,
				Size: new UDim2(1, 0, 0, 0),
				AutomaticSize: Enum.AutomaticSize.Y,
			});
			make("TextLabel", {
				BackgroundTransparency: 1,
				FontFace: FONT,
				TextSize: 14,
				Text: formatPercent(row.percent),
				TextColor3: coverageColor(row.percent),
				TextXAlignment: Enum.TextXAlignment.Right,
				Size: new UDim2(0, 52, 0, ROW_HEIGHT),
				Parent: frame,
			});
			make("TextLabel", {
				BackgroundTransparency: 1,
				FontFace: FONT,
				TextSize: 14,
				Text: `${row.file}  ${row.hit}/${row.found}`,
				TextColor3: themeColor(C.MainText),
				TextXAlignment: Enum.TextXAlignment.Left,
				TextTruncate: Enum.TextTruncate.AtEnd,
				Size: new UDim2(1, -64, 0, ROW_HEIGHT),
				Position: new UDim2(0, 60, 0, 0),
				Parent: frame,
			});
			if (row.missed !== "") {
				make("TextLabel", {
					BackgroundTransparency: 1,
					FontFace: CODE_FONT,
					TextSize: 12,
					Text: `missed: ${row.missed}`,
					TextColor3: themeColor(C.DimmedText),
					TextXAlignment: Enum.TextXAlignment.Left,
					TextWrapped: true,
					AutomaticSize: Enum.AutomaticSize.Y,
					Size: new UDim2(1, -64, 0, 16),
					Position: new UDim2(0, 60, 0, ROW_HEIGHT - 2),
					Parent: frame,
				});
			}
			make("UIPadding", { PaddingBottom: new UDim(0, 4) }).Parent = frame;
			add(frame);
		}
	}

	// -------------------------------------------------------------------------
	// Selection
	// -------------------------------------------------------------------------

	private selectTest(classLabel: string, modulePath: string, test: TestRow) {
		const message =
			test.message ??
			(test.status === "passed" ? "Passed." : test.status === "pending" ? "Not run yet." : "Skipped.");
		this.select({ title: `${classLabel} › ${test.label}`, message, modulePath });
	}

	private select(selection: Selection) {
		this.selected = selection;
		this.render();
	}

	/** After a run, show the new message for the same test, if it still exists. */
	private reselect() {
		const selected = this.selected!;
		for (const cls of this.session.tree?.classes ?? []) {
			for (const test of cls.tests) {
				if (`${cls.label} › ${test.label}` === selected.title) {
					this.selectTest(cls.label, cls.modulePath, test);
					return;
				}
			}
		}
	}

	private openSelected() {
		const selected = this.selected;
		if (selected === undefined) return;
		const location = parseLocation(selected.message);
		const module =
			(location !== undefined ? this.session.moduleForChunk(location.chunk) : undefined) ??
			this.session.moduleForChunk(selected.modulePath);
		if (module === undefined) return;
		this.plugin.OpenScript(module, location?.line ?? 1);
	}

	// -------------------------------------------------------------------------
	// Building blocks
	// -------------------------------------------------------------------------

	private button(text: string, width: number): TextButton {
		return make("TextButton", {
			Text: text,
			FontFace: FONT,
			TextSize: 14,
			Size: new UDim2(0, width, 0, 24),
			BorderSizePixel: 1,
			AutoButtonColor: true,
		});
	}

	private row(
		depth: number,
		status: Parameters<typeof statusColor>[0],
		text: string,
		run: (() => void) | undefined,
		click: () => void,
	): TextButton {
		const row = make("TextButton", {
			Text: "",
			AutoButtonColor: true,
			BorderSizePixel: 0,
			BackgroundColor3: themeColor(C.MainBackground),
			Size: new UDim2(1, 0, 0, ROW_HEIGHT),
		});
		const indent = 6 + depth * 18;
		make("TextLabel", {
			BackgroundTransparency: 1,
			FontFace: FONT,
			TextSize: 14,
			Text: statusGlyph(status),
			TextColor3: statusColor(status),
			Size: new UDim2(0, 14, 1, 0),
			Position: new UDim2(0, indent, 0, 0),
			Parent: row,
		});
		make("TextLabel", {
			BackgroundTransparency: 1,
			FontFace: FONT,
			TextSize: 14,
			Text: text,
			TextColor3: themeColor(C.MainText),
			TextXAlignment: Enum.TextXAlignment.Left,
			TextTruncate: Enum.TextTruncate.AtEnd,
			Size: new UDim2(1, -(indent + 18 + 30), 1, 0),
			Position: new UDim2(0, indent + 18, 0, 0),
			Parent: row,
		});
		if (run !== undefined) {
			const runButton = make("TextButton", {
				Text: "▶",
				FontFace: FONT,
				TextSize: 12,
				BackgroundTransparency: 1,
				TextColor3: themeColor(C.DimmedText),
				Size: new UDim2(0, 24, 1, 0),
				Position: new UDim2(1, -28, 0, 0),
				Parent: row,
			});
			runButton.Activated.Connect(() => {
				if (!this.busy) run();
			});
		}
		row.Activated.Connect(click);
		return row;
	}

	private note(text: string): TextLabel {
		return make(
			"TextLabel",
			{
				BackgroundTransparency: 1,
				FontFace: FONT,
				TextSize: 14,
				Text: text,
				TextColor3: themeColor(C.DimmedText),
				TextWrapped: true,
				TextXAlignment: Enum.TextXAlignment.Left,
				AutomaticSize: Enum.AutomaticSize.Y,
				Size: new UDim2(1, 0, 0, ROW_HEIGHT),
			},
			[padding(6)],
		);
	}

	private bannerLabel(text: string, isError: boolean): TextLabel {
		const label = this.note(text);
		label.TextColor3 = isError ? statusColor("failed") : statusColor("skipped");
		return label;
	}

	/** Re-applies theme colors to the fixed parts of the panel. */
	private paint() {
		this.root.BackgroundColor3 = themeColor(C.MainBackground);
		this.content.BackgroundColor3 = themeColor(C.MainBackground);
		this.content.ScrollBarImageColor3 = themeColor(C.ScrollBar);
		this.details.BackgroundColor3 = themeColor(C.MainBackground);
		this.details.BorderColor3 = themeColor(C.Border);
		this.status.TextColor3 = themeColor(C.DimmedText);
		this.detailsTitle.TextColor3 = themeColor(C.MainText);
		this.detailsText.TextColor3 = themeColor(C.MainText);
		this.search.BackgroundColor3 = themeColor(C.InputFieldBackground);
		this.search.BorderColor3 = themeColor(C.InputFieldBorder);
		this.search.TextColor3 = themeColor(C.MainText);
		this.search.PlaceholderColor3 = themeColor(C.DimmedText);
		for (const button of [this.runButton, this.refreshButton, this.coverageButton, this.openButton]) {
			button.BackgroundColor3 = themeColor(C.Button);
			button.BorderColor3 = themeColor(C.ButtonBorder);
			button.TextColor3 = themeColor(C.ButtonText);
		}
		for (const [tab, button] of [
			["tests", this.testsTab],
			["coverage", this.coverageTab],
		] as const) {
			const active = this.tab === tab;
			button.BackgroundColor3 = themeColor(C.Button, active ? Enum.StudioStyleGuideModifier.Selected : undefined);
			button.BorderColor3 = themeColor(C.ButtonBorder);
			button.TextColor3 = themeColor(
				C.ButtonText,
				active ? Enum.StudioStyleGuideModifier.Selected : Enum.StudioStyleGuideModifier.Default,
			);
		}
	}
}
