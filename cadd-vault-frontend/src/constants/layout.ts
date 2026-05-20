/**
 * Shared layout constants. Keeping the header height in one place prevents
 * the virtual scroll containers and the sidebars from drifting out of sync.
 */

/** Height of the fixed application header (MUI AppBar), in pixels. */
export const HEADER_HEIGHT = 64;

/** CSS height for full-viewport panels rendered below the header. */
export const CONTENT_HEIGHT = `calc(100vh - ${HEADER_HEIGHT}px)`;
