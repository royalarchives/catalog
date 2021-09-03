module.exports = async (catalog, options) => {
  return catalog.getObjects(catalog.files, options)
}
