import type { Status } from "../core/tree";

const studio = settings().Studio;

export function themeColor(
	color: Enum.StudioStyleGuideColor,
	modifier: Enum.StudioStyleGuideModifier = Enum.StudioStyleGuideModifier.Default,
): Color3 {
	return studio.Theme.GetColor(color, modifier);
}

export function onThemeChanged(callback: () => void): RBXScriptConnection {
	return studio.ThemeChanged.Connect(callback);
}

const STATUS_COLORS: Record<Exclude<Status, "pending">, Color3> = {
	passed: Color3.fromRGB(76, 186, 108),
	failed: Color3.fromRGB(226, 86, 86),
	skipped: Color3.fromRGB(214, 168, 56),
};

export function statusColor(status: Status): Color3 {
	return status === "pending" ? themeColor(Enum.StudioStyleGuideColor.DimmedText) : STATUS_COLORS[status];
}

export function statusGlyph(status: Status): string {
	return status === "pending" ? "○" : "●";
}

/** Green at 100%, yellow from 70%, red below. */
export function coverageColor(percent: number): Color3 {
	if (percent >= 100) return STATUS_COLORS.passed;
	if (percent >= 70) return STATUS_COLORS.skipped;
	return STATUS_COLORS.failed;
}
