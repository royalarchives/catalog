module.exports = async (catalog, options) => {
  const file = catalog.getObject(options.id)
  if (!file) {
    console.error('invalid file id', options)
    throw new Error('invalid-file')
  }
  return file
}
