import { App } from "./ui/app";

const toolbar = plugin.CreateToolbar("Lunit");
const button = toolbar.CreateButton("Lunit", "Find, run and inspect Lunit tests", "", "Tests");

const widget = plugin.CreateDockWidgetPluginGuiAsync(
	"LunitTests",
	new DockWidgetPluginGuiInfo(Enum.InitialDockState.Right, false, false, 360, 520, 260, 240),
);
// PluginGui.Title is missing from @rbxts/types.
(widget as unknown as { Title: string }).Title = "Lunit";
widget.Name = "Lunit";

let app: App | undefined;

function open() {
	if (app === undefined) {
		app = new App(plugin, widget);
		app.refresh();
	}
}

button.Click.Connect(() => {
	widget.Enabled = !widget.Enabled;
});

widget.GetPropertyChangedSignal("Enabled").Connect(() => {
	button.SetActive(widget.Enabled);
	if (widget.Enabled) open();
});

if (widget.Enabled) {
	button.SetActive(true);
	open();
}

plugin.Unloading.Connect(() => {
	app?.destroy();
	app = undefined;
});
