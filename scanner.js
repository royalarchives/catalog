const fs = require('fs').promises
const path = require('path')
const util = require('util')
const zlib = require('zlib')
const gzipAsync = util.promisify(zlib.gzip)
const existsAsync = async (filePath) => {
  try {
    const stat = await fs.stat(filePath)
    return stat !== undefined && stat !== null
  } catch (error) {
    return false
  }
}

module.exports = {
  scan
}

if (process.argv[1] === __filename) {
  commandLineStart()
}

async function commandLineStart () {
  const libraryPaths = []
  const moduleNames = []
  let index = 2
  while (true) {
    if (!process.argv[index]) {
      break
    }
    try {
      require.resolve(process.argv[index])
      moduleNames.push(process.argv[index])
    } catch (error) {
      break
    }
    index++
  }
  while (true) {
    if (!process.argv[index]) {
      break
    }
    const exists = await existsAsync(process.argv[index])
    if (!exists) {
      break
    }
    libraryPaths.push(process.argv[index])
    index++
  }
  await scan(moduleNames, libraryPaths)
  console.log('[indexer]', 'finished scanning')
  return process.exit(0)
}

async function scan (moduleNames, libraryPaths) {
  if (!Array.isArray(libraryPaths)) {
    libraryPaths = [libraryPaths]
  }
  if (moduleNames && !Array.isArray(moduleNames)) {
    moduleNames = [moduleNames]
  }
  const Library = require('./library.js')
  const startTime = process.hrtime()
  const library = await Library.load(moduleNames, libraryPaths)
  for (const libraryPath of libraryPaths) {
    await scanLibrary(library, libraryPath)
    if (moduleNames) {
      for (const moduleName of moduleNames) {
        const module = require(moduleName)
        if (module.scan) {
          console.log('[indexer]', 'module scanning library', moduleName)
          await module.scan(library, libraryPath)
        }
      }
    }
  }
  if (process.env.GZIP && process.env.GZIP !== 'false') {
    console.log('[indexer]', 'compressing data')
    const compressedData = await gzipAsync(JSON.stringify(library))
    const libraryDataPath = path.join(process.env.DATA_PATH, 'library.json.gzip')
    console.log('[indexer]', 'writing compressed data', compressedData.length)
    await fs.writeFile(libraryDataPath, compressedData)
  } else {
    const buffer = Buffer.from(JSON.stringify(library, null, '  '))
    const libraryDataPath = path.join(process.env.DATA_PATH, 'library.json')
    console.log('[indexer]', 'writing uncompressed data', buffer.length)
    await fs.writeFile(libraryDataPath, buffer)
  }
  const stopTime = process.hrtime(startTime)
  console.info('[indexer', 'total scan time:', stopTime[0] + 's', stopTime[1] / 1000000 + 'ms')
}

async function scanLibrary (library, libraryPath) {
  const startTime = process.hrtime()
  console.log('[indexer]', 'scanning library', libraryPath)
  if (!library.files) {
    library.files = []
    library.tree = {
      type: 'folder',
      id: 'folder_/library',
      folder: 'library',
      contents: []
    }
  }
  console.log('[indexer]', 'indexing files')
  const folder = {
    id: `folder_${libraryPath}`,
    type: 'folder',
    path: libraryPath,
    contents: []
  }
  library.tree.contents.push(folder)
  await indexFolder(library, folder.contents, libraryPath, libraryPath)
  const stopTime = process.hrtime(startTime)
  console.log('[indexer]', 'library scan time:', stopTime[0] + 's', stopTime[1] / 1000000 + 'ms')
  return library
}

async function indexFolder (library, parentContents, currentFolder, libraryPath) {
  console.log('[indexer]', 'indexing folder', currentFolder)
  const folderContents = await fs.readdir(currentFolder)
  for (const item of folderContents) {
    const itemPath = path.join(currentFolder, item)
    const itemStat = await fs.stat(itemPath)
    if (itemStat.isDirectory()) {
      const folder = {
        id: `folder_${itemPath}`,
        type: 'folder',
        folder: item,
        path: itemPath,
        title: path.dirname(itemPath),
        contents: []
      }
      parentContents.push(folder)
      await indexFolder(library, folder.contents, folder.path, libraryPath)
      continue
    }
    const extension = itemPath.split('.').pop().toLowerCase()
    const file = {
      type: 'file',
      id: `file_${itemPath}`,
      extension,
      file: item,
      size: itemStat.size,
      title: path.basename(itemPath),
      path: itemPath
    }
    parentContents.push(file.id)
    library.files.push(file)
  }
}
