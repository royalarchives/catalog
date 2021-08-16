module.exports = async (library, options) => {
  const file = library.getObject(options.id)
  if (!file) {
    console.error('invalid file id', options)
    throw new Error('invalid-file')
  }
  return file
}
