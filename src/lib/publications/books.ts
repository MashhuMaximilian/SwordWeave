import source from './books.json';

export type BookBlock =
  | { type: 'heading'; level: number; text: string; id: string }
  | { type: 'paragraph'; text: string }
  | { type: 'table'; rows: string[][] }
  | { type: 'list'; ordered: boolean; items: string[] }
  | { type: 'aside'; paragraphs: string[] }
  | { type: 'figure'; name: string }
  | { type: 'index' };
export type BookHeading = Extract<BookBlock, { type: 'heading' }>;
export interface CoreBook {
  slug: string; short: string; title: string; subtitle: string; description: string;
  accent: string; version: string; words: number; lightPdf: string; darkPdf: string;
  blocks: BookBlock[]; headings: BookHeading[];
}
export const CORE_BOOKS = source as CoreBook[];
