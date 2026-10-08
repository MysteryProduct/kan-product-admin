/**
 * Copies only the listed fields, leaving out any that are undefined. Used to
 * build request bodies for API routes that reject unknown fields, so a form
 * state or list row passed in whole never reaches the request (an empty string
 * or null is a value and is kept).
 */
export function pickDefined<T extends object, K extends keyof T>(
    source: T,
    keys: readonly K[],
): Pick<T, K> {
    const picked = {} as Pick<T, K>;
    for (const key of keys) {
        if (source[key] !== undefined) picked[key] = source[key];
    }
    return picked;
}
