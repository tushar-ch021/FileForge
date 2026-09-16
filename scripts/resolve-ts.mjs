export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    if (err.code === "ERR_MODULE_NOT_FOUND") {
      try {
        return await nextResolve(specifier + ".ts", context);
      } catch {
        return nextResolve(specifier + ".js", context);
      }
    }
    throw err;
  }
}
