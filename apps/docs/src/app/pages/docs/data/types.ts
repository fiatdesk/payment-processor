import type { CodeTab } from '../../../components/code-snippet/code-snippet';

// ============================================
// Sidebar Types
// ============================================
export interface DocSection {
  id: string;
  title: string;
  children?: DocSubSection[];
}

export interface DocSubSection {
  id: string;
  title: string;
  children?: DocItem[];
}

export interface DocItem {
  id: string;
  title: string;
}

// ============================================
// Page Content Types
// ============================================
export interface DocPage {
  id: string;
  title: string;
  description: string;
  stripeDocsUrl?: string;
  endpoints?: EndpointSummary[];
  /** Events shown in the overview panel Events tab (object pages). */
  events?: Attribute[];
  sections: DocPageSection[];
}

export interface EndpointSummary {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  /** Human-readable title (e.g. "Create a subscription") shown on object overview panels. */
  title?: string;
  /** Target page id within the same resource group (e.g. "create"). */
  pageId?: string;
}

export interface DocPageSection {
  id?: string;
  left: LeftContentBlock[];
  right?: RightContentBlock[];
}

// ============================================
// Left Column Content Blocks
// ============================================
export type LeftContentBlock =
  | HeadingBlock
  | ParagraphBlock
  | ListBlock
  | CalloutBlock
  | AttributesBlock;

export interface HeadingBlock {
  type: 'heading';
  level: 2 | 3;
  text: string;
}

export interface ParagraphBlock {
  type: 'paragraph';
  text: string;
  html?: boolean;
}

export interface ListBlock {
  type: 'list';
  items: ListItem[];
}

export interface ListItem {
  text: string;
  html?: boolean;
}

export interface CalloutBlock {
  type: 'callout';
  variant: 'info' | 'warning';
  title: string;
  text: string;
  html?: boolean;
}

export interface EnumValue {
  value: string;
  description?: string;
}

// A hover tooltip shown next to an attribute's type (e.g. "Expandable").
// `content` supports HTML so it can include links and inline <code>.
export interface AttributeTooltip {
  label: string;
  content: string;
}

export interface Attribute {
  name: string;
  type: string;
  description: string;
  nullable?: boolean;
  required?: boolean;
  requiredText?: string;
  expandable?: boolean;
  tooltip?: AttributeTooltip;
  enumValues?: (string | EnumValue)[];
  enumNote?: string;
  children?: Attribute[];
}

export interface AttributesBlock {
  type: 'attributes';
  title?: string;
  attributes: Attribute[];
  moreAttributes?: Attribute[];
}

// ============================================
// Right Column Content Blocks
// ============================================
export type RightContentBlock = CodeBlock | ObjectBlock | ImageBlock;

export interface CodeBlock {
  type: 'code';
  title?: string;
  endpoint?: { method: 'GET' | 'POST' | 'DELETE'; path: string };
  tabs: CodeTab[];
}

export interface ObjectBlock {
  type: 'object';
  title: string;
  code: string;
}

/** Screenshot or diagram in the right column. */
export interface ImageBlock {
  type: 'image';
  /** Public path, e.g. `/assets/images/screenshots/quickstart-1.webp` */
  src: string;
  alt: string;
  caption?: string;
  /**
   * When true, shows a dashed placeholder with the target `src` path
   * instead of loading the image. Set to false (or omit) once the file exists.
   */
  placeholder?: boolean;
}
