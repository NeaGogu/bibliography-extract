import { ItemView, Menu, WorkspaceLeaf } from 'obsidian';
import type { ParsedReference } from './types';

export const VIEW_TYPE_REFERENCES = 'bibliography-references';

export class ReferencesView extends ItemView {
	private tableContainer!: HTMLElement;

	constructor(leaf: WorkspaceLeaf) {
		super(leaf);
	}

	getViewType(): string {
		return VIEW_TYPE_REFERENCES;
	}

	getDisplayText(): string {
		return 'References';
	}

	getIcon(): string {
		return 'book-open';
	}

	async onOpen(): Promise<void> {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.addClass('bibliography-references-view');
		this.tableContainer = contentEl.createDiv({ cls: 'bibliography-table-container' });
		this.renderEmpty();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	renderEmpty(): void {
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-empty',
			text: 'Open a PDF and run "Extract references from PDF".',
		});
	}

	renderLoading(): void {
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-loading',
			text: 'Extracting references…',
		});
	}

	renderError(message: string): void {
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-error',
			text: message,
		});
	}

	renderReferences(refs: ParsedReference[]): void {
		this.tableContainer.empty();

		if (refs.length === 0) {
			this.tableContainer.createDiv({
				cls: 'bibliography-empty',
				text: 'No references found in this PDF.',
			});
			return;
		}

		const table = this.tableContainer.createEl('table', { cls: 'bibliography-table' });
		const thead = table.createEl('thead');
		const headerRow = thead.createEl('tr');
		headerRow.createEl('th', { text: '#' });
		headerRow.createEl('th', { text: 'Reference' });

		const tbody = table.createEl('tbody');
		for (const ref of refs) {
			const row = tbody.createEl('tr');
			row.createEl('td', { cls: 'bibliography-num', text: String(ref.num) });
			row.createEl('td', { cls: 'bibliography-text', text: ref.text });
			row.addEventListener('click', () => {
				const query = encodeURIComponent(ref.text);
				window.open(`https://scholar.google.com/scholar?q=${query}`, '_blank');
			});
			row.addEventListener('contextmenu', (evt) => {
				const menu = new Menu();
				menu.addItem((item) =>
					item
						.setTitle('Copy reference text')
						.setIcon('copy')
						.onClick(() => navigator.clipboard.writeText(ref.text)),
				);
				menu.showAtMouseEvent(evt);
			});
		}
	}
}
