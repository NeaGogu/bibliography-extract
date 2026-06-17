import { ItemView, Menu, WorkspaceLeaf, setIcon } from 'obsidian';
import type { ParsedReference } from './types';

export const VIEW_TYPE_REFERENCES = 'bibliography-references';

export class ReferencesView extends ItemView {
	private tableContainer!: HTMLElement;
	private searchInput!: HTMLInputElement;
	private allRefs: ParsedReference[] = [];

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

		const searchBar = contentEl.createDiv({ cls: 'bibliography-search-bar' });
		const iconEl = searchBar.createSpan({ cls: 'bibliography-search-icon' });
		setIcon(iconEl, 'search');
		this.searchInput = searchBar.createEl('input', {
			cls: 'bibliography-search-input',
			attr: { type: 'text', placeholder: 'Search references…' },
		});

		this.searchInput.addEventListener('input', () => this.filterRefs());
		this.searchInput.addEventListener('keydown', (evt) => {
			if (evt.key === 'Escape') {
				this.searchInput.value = '';
				this.searchInput.blur();
				this.filterRefs();
			}
		});

		// Press "/" to focus search when this view is the active one
		this.registerDomEvent(activeDocument, 'keydown', (evt: KeyboardEvent) => {
			if (evt.key !== '/') return;
			if (activeDocument.activeElement === this.searchInput) return;
			const active = activeDocument.activeElement;
			if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || (active as HTMLElement).isContentEditable)) return;
			if (this.app.workspace.getActiveViewOfType(ReferencesView) === this) {
				evt.preventDefault();
				this.searchInput.focus();
			}
		});

		this.tableContainer = contentEl.createDiv({ cls: 'bibliography-table-container' });
		this.renderEmpty();
	}

	async onClose(): Promise<void> {
		this.contentEl.empty();
	}

	renderEmpty(): void {
		this.allRefs = [];
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-empty',
			text: 'Open a PDF and run "Extract references from PDF".',
		});
	}

	renderLoading(): void {
		this.allRefs = [];
		this.searchInput.value = '';
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-loading',
			text: 'Extracting references…',
		});
	}

	renderError(message: string): void {
		this.allRefs = [];
		this.tableContainer.empty();
		this.tableContainer.createDiv({
			cls: 'bibliography-error',
			text: message,
		});
	}

	renderReferences(refs: ParsedReference[]): void {
		this.allRefs = refs;
		this.searchInput.value = '';
		this.filterRefs();
	}

	private filterRefs(): void {
		const query = this.searchInput.value;
		const filtered = this.allRefs.filter((ref) => fuzzyMatch(query, `[${ref.num}] ${ref.text}`));
		this.renderTable(filtered);
	}

	private renderTable(refs: ParsedReference[]): void {
		this.tableContainer.empty();

		if (this.allRefs.length === 0) {
			this.tableContainer.createDiv({
				cls: 'bibliography-empty',
				text: 'No references found in this PDF.',
			});
			return;
		}

		if (refs.length === 0) {
			this.tableContainer.createDiv({
				cls: 'bibliography-empty',
				text: 'No matching references.',
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

function fuzzyMatch(query: string, text: string): boolean {
	if (!query) return true;
	const q = query.toLowerCase();
	const t = text.toLowerCase();
	let qi = 0;
	for (let i = 0; i < t.length && qi < q.length; i++) {
		if (t[i] === q[qi]) qi++;
	}
	return qi === q.length;
}
