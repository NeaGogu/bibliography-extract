import { loadPdfJs } from 'obsidian';
import type { ParsedReference } from './types';

interface PdfTextItem {
	str: string;
	transform: number[];
	width: number;
}

function joinTextItems(items: PdfTextItem[]): string {
	if (items.length === 0) return '';
	let result = items[0]!.str;
	for (let i = 1; i < items.length; i++) {
		const prev = items[i - 1]!;
		const curr = items[i]!;
		// [scaleX, skewX, skewY, scaleY, translateX, translateY]
		// 6-element array representing a 2D affine transformation matrix in the form
		/*
Or in matrix notation:

  | scaleX  skewX  translateX |
  | skewY   scaleY translateY |
  | 0       0      1          |

  The elements you care about most:

  ┌───────┬─────────────────────────────────────────────────────────────────┐
  │ Index │                             Meaning                             │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [0]   │ Horizontal scale — effectively the font size for unrotated text │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [1]   │ Horizontal skew (0 for normal text)                             │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [2]   │ Vertical skew (0 for normal text)                               │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [3]   │ Vertical scale                                                  │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [4]   │ X position on the page (left edge of the text item)             │
  ├───────┼─────────────────────────────────────────────────────────────────┤
  │ [5]   │ Y position on the page (baseline of the text item)              │
  └───────┴─────────────────────────────────────────────────────────────────┘

		*/
		const prevX = prev.transform[4] ?? 0;
		const prevY = prev.transform[5] ?? 0;
		const currX = curr.transform[4] ?? 0;
		const currY = curr.transform[5] ?? 0;
		const gap = currX - (prevX + prev.width);
		const fontSize = Math.abs(prev.transform[0] ?? 1);
		// Different line → always a word break
		// Same line, gap > 15% of font size → word space; otherwise adjacent glyphs
		if (Math.abs(currY - prevY) > 2 || gap > fontSize * 0.15) {
			result += ' ';
		}
		result += curr.str;
	}
	return result;
}

export async function extractReferences(buffer: ArrayBuffer): Promise<ParsedReference[]> {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
	const pdfjs = await loadPdfJs();
	console.log('[BibliographyExtract] pdfjs loaded:', pdfjs);
	// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
	const pdf = await pdfjs.getDocument({ data: buffer }).promise;
	const numPages = pdf.numPages as number;
	console.log('[BibliographyExtract] PDF loaded, pages:', numPages);

	let fullText = '';
	for (let i = 1; i <= numPages; i++) {
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const page = await pdf.getPage(i);
		// eslint-disable-next-line @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
		const content = await page.getTextContent();
		console.log("aaaa: ", content.items);
		const pageText = joinTextItems(content.items as PdfTextItem[]);
		if (i >= numPages - 2) {
			console.log(`[BibliographyExtract] Page ${i} text (last pages):`, pageText.slice(0, 500));
		}
		if (i == 15) {
			console.log(`[BibliographyExtract] Page ${i} text (sample page):`, pageText);
		}
		fullText += pageText + '\n';
	}

	console.log('[BibliographyExtract] Total text length:', fullText.length);
	console.log('[BibliographyExtract] Last 1000 chars:', fullText.slice(-1000));

	return parseReferencesFromText(fullText);
}

function parseReferencesFromText(text: string): ParsedReference[] {
	const sectionStart = text.search(/\breferences\b/i);
	console.log('[BibliographyExtract] "References" section found at index:', sectionStart);
	if (sectionStart === -1) return [];

	const refsSection = text.slice(sectionStart);
	console.log('[BibliographyExtract] refs section (first 500 chars):', refsSection.slice(0, 500));

	const pattern = /\[(\d+)\]/g;
	const splits: Array<{ num: number; start: number }> = [];

	let match: RegExpExecArray | null;
	while ((match = pattern.exec(refsSection)) !== null) {
		splits.push({ num: parseInt(match[1]!, 10), start: match.index });
	}
	console.log('[BibliographyExtract] [N] split points found:', splits.length, splits.slice(0, 5));

	const refs: ParsedReference[] = [];
	for (let i = 0; i < splits.length; i++) {
		const current = splits[i]!;
		const next = splits[i + 1];
		const end = next ? next.start : refsSection.length;
		const rawText = refsSection.slice(current.start, end).trim();
		const refText = rawText.replace(/^\[\d+\]\s*/, '').trim();
		if (refText.length > 0) {
			refs.push({ num: current.num, text: refText });
		}
	}

	console.log('[BibliographyExtract] Parsed references count:', refs.length);
	return refs;
}
