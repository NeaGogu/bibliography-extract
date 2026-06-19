import { App, PluginSettingTab, Setting } from 'obsidian';
import type BibliographyExtractPlugin from './main';

export interface BibliographySettings {
	autoOpenOnPdfFocus: boolean;
}

export const DEFAULT_SETTINGS: BibliographySettings = {
	autoOpenOnPdfFocus: true,
};

export class BibliographySettingTab extends PluginSettingTab {
	private plugin: BibliographyExtractPlugin;

	constructor(app: App, plugin: BibliographyExtractPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl)
			.setName('Auto-open on PDF focus')
			.setDesc('Automatically open the references panel when switching to a PDF.')
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.autoOpenOnPdfFocus)
					.onChange(async (value) => {
						this.plugin.settings.autoOpenOnPdfFocus = value;
						await this.plugin.saveSettings();
					}),
			);
	}
}
