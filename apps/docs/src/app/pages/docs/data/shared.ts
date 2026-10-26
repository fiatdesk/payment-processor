import { AttributeTooltip, DocSubSection, EndpointSummary } from './types';

export const NODE_INIT = `import { Zoneless } from '@zoneless/node';
const zoneless = new Zoneless('sk_live_z_YOUR_API_KEY', 'https://api.zoneless.com');`;

/** Hover tooltip shown next to expandable attribute types. */
export const EXPAND_TOOLTIP: AttributeTooltip = {
  label: 'Expandable',
  content:
    'This can be <a href="/expanding_objects">expanded</a> into an object with the <code>expand</code> request parameter.',
};

/**
 * Build overview endpoint rows, resolving human-readable titles from the
 * resource subsection sidebar entries (matched by pageId).
 */
export function BuildEndpointSummaries(
  subsection: DocSubSection,
  endpoints: Array<{
    method: 'GET' | 'POST' | 'DELETE';
    path: string;
    pageId: string;
    title?: string;
  }>
): EndpointSummary[] {
  const titleById = new Map(
    (subsection.children ?? []).map((child) => [child.id, child.title])
  );
  return endpoints.map((endpoint) => ({
    method: endpoint.method,
    path: endpoint.path,
    pageId: endpoint.pageId,
    title: endpoint.title ?? titleById.get(endpoint.pageId),
  }));
}
