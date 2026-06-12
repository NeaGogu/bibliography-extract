import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import { VIEW_TYPE_REFERENCES, ReferencesView } from './ReferencesView';
import { extractReferences } from './pdfParser';
import type { ParsedReference } from './types';

export default class BibliographyExtractPlugin extends Plugin {
	private refCache = new Map<string, ParsedReference[]>();
	async onload(): Promise<void> {
		this.registerView(VIEW_TYPE_REFERENCES, (leaf) => new ReferencesView(leaf));

		this.addCommand({
			id: 'extract-references',
			name: 'Extract references from PDF',
			checkCallback: (checking: boolean) => {
				const pdfFile = this.getActivePdfFile();
				if (!pdfFile) return false;
				if (!checking) void this.runExtraction(pdfFile);
				return true;
			},
		});

		this.addRibbonIcon('book-open', 'Extract references from PDF', () => {
			const pdfFile = this.getActivePdfFile();
			if (!pdfFile) {
				new Notice('Open a PDF file first.');
				return;
			}
			void this.runExtraction(pdfFile);
		});

		this.registerEvent(
			this.app.workspace.on('active-leaf-change', (leaf: WorkspaceLeaf | null) => {
				if (!leaf) return;
				const file = this.getLeafPdfFile(leaf);
				if (file) void this.runExtraction(file);
			}),
		);
	}

	onunload(): void {
		this.app.workspace.detachLeavesOfType(VIEW_TYPE_REFERENCES);
	}

	private getActivePdfFile(): TFile | null {
		const leaf = this.app.workspace.activeLeaf;
		if (!leaf) return null;
		return this.getLeafPdfFile(leaf);
	}

	private getLeafPdfFile(leaf: WorkspaceLeaf): TFile | null {
		if (leaf.view.getViewType() !== 'pdf') return null;
		const file = (leaf.view as unknown as { file: TFile | null }).file;
		return file ?? null;
	}

	private async ensureReferencesView(): Promise<ReferencesView | null> {
		const existing = this.app.workspace.getLeavesOfType(VIEW_TYPE_REFERENCES);
		if (existing.length > 0) {
			const leaf = existing[0]!;
			await this.app.workspace.revealLeaf(leaf);
			return leaf.view instanceof ReferencesView ? leaf.view : null;
		}
		const leaf = await this.app.workspace.ensureSideLeaf(
			VIEW_TYPE_REFERENCES,
			'right',
			{ reveal: true },
		);
		return leaf.view instanceof ReferencesView ? leaf.view : null;
	}

	async runExtraction(file: TFile): Promise<void> {
		const view = await this.ensureReferencesView();
		if (!view) return;

		const cached = this.refCache.get(file.path);
		if (cached) {
			view.renderReferences(cached);
			return;
		}

		view.renderLoading();
		try {
			const buffer = await this.app.vault.readBinary(file);
			const refs = await extractReferences(buffer);
			this.refCache.set(file.path, refs);
			view.renderReferences(refs);
		} catch (err) {
			console.error('Bibliography Extract: extraction failed', err);
			view.renderError('Failed to extract references. See console for details.');
			new Notice('Bibliography Extract: extraction failed.');
		}
	}
}
