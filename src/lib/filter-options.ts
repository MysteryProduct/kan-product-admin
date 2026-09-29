/**
 * Turns names loaded from the database into DataTable filter options. The
 * APIs filter by name, and the DataTable compares filter values in lower
 * case, so names that differ only by case would be one option. Names are not
 * unique in the database: keep one each.
 */
export const toNameOptions = (names: string[]) => {
	const byKey = new Map<string, string>();
	for (const name of names) {
		const key = name.toLowerCase();
		if (!byKey.has(key)) byKey.set(key, name);
	}
	return Array.from(byKey.values(), (name) => ({ label: name, value: name }));
};
