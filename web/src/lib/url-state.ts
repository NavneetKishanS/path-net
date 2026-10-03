import { parseAsString, parseAsStringLiteral } from 'nuqs'
import { DEFAULT_ROLE, ROLES } from './roles'

/** URL-synced state. Every view is shareable as a link. */
export const roleParam = parseAsStringLiteral(ROLES).withDefault(DEFAULT_ROLE)
export const queryParam = parseAsString.withDefault('')
/** The Patient Group Leader's own condition. */
export const focusParam = parseAsString
/** Selected node in the explorer. */
export const nodeParam = parseAsString
/** Edge whose evidence is open in the drawer. */
export const edgeParam = parseAsString
