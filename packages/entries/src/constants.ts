import path from 'upath';

export const DEFAULT_HTML_PATH = path.resolve(__dirname, '../default.html');

export const DEFAULT_ENTRY_MODULE_ID =
  '/@conventional-entries/default-entry.jsx';

// entries module id
export const ENTRIES_MODULE_ID = 'virtual:conventional-entries';
export const RESOLVED_ENTRIES_MODULE_ID = '\0' + ENTRIES_MODULE_ID;

export const HEAD_INJECT_RE = /([ \t]*)<\/head>/i;
export const HEAD_PREPEND_INJECT_RE = /([ \t]*)<head[^>]*>/i;

export const BODY_INJECT_RE = /([ \t]*)<\/body>/i;
export const BODY_PREPEND_INJECT_RE = /([ \t]*)<body[^>]*>/i;
