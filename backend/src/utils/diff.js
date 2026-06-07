function computeDiff(oldObj, newObj) {
  if (!oldObj || !newObj) return [];
  const diffs = [];
  const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

  for (const key of allKeys) {
    const from = oldObj[key];
    const to = newObj[key];
    if (JSON.stringify(from) !== JSON.stringify(to)) {
      diffs.push({ field: key, from: from ?? null, to: to ?? null });
    }
  }
  return diffs;
}

module.exports = { computeDiff };
