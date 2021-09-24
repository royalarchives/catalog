const dree = require('dree')
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
  const catalogPaths = []
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
    catalogPaths.push(process.argv[index])
    index++
  }
  await scan(moduleNames, catalogPaths)
  console.log('[indexer]', 'finished scanning')
  return process.exit(0)
}

async function scan (moduleNames, catalogPaths) {
  if (!Array.isArray(catalogPaths)) {
    catalogPaths = [catalogPaths]
  }
  if (moduleNames && !Array.isArray(moduleNames)) {
    moduleNames = [moduleNames]
  }
  const Catalog = require('./catalog.js')
  const startTime = process.hrtime()
  const catalog = await Catalog.load(moduleNames, catalogPaths)
  delete (catalog.api)
  catalog.catalogPaths = catalogPaths
  catalog.catalogModules = moduleNames
  catalog.name = '/'
  catalog.relativePath = '/'
  catalog.path = '/'
  catalog.hash = '/'
  catalog.sizeInBytes = 0
  catalog.children = []
  for (const catalogPath of catalogPaths) {
    const startTime = process.hrtime()
    console.log('[indexer]', 'scanning catalog', catalogPath)
    const tree = await dree.scan(catalogPath)
    console.log('tree', tree)
    catalog.children = catalog.children.concat(tree.children)
    catalog.sizeInBytes += tree.sizeInBytes
    const stopTime = process.hrtime(startTime)
    console.log('[indexer]', 'catalog scan time:', stopTime[0] + 's', stopTime[1] / 1000000 + 'ms')
    if (moduleNames) {
      for (const moduleName of moduleNames) {
        const module = require(moduleName)
        if (module.scan) {
          console.log('[indexer]', 'module scanning catalog', moduleName)
          await module.scan(catalog, catalogPath)
        }
      }
    }
  }
  if (process.env.GZIP && process.env.GZIP !== 'false') {
    console.log('[indexer]', 'compressing data')
    const compressedData = await gzipAsync(JSON.stringify(catalog))
    const catalogDataPath = path.join(process.env.DATA_PATH, 'catalog.json.gzip')
    console.log('[indexer]', 'writing compressed data', compressedData.length)
    await fs.writeFile(catalogDataPath, compressedData)
  } else {
    const buffer = Buffer.from(JSON.stringify(catalog, null, '  '))
    const catalogDataPath = path.join(process.env.DATA_PATH, 'catalog.json')
    console.log('[indexer]', 'writing uncompressed data', buffer.length)
    await fs.writeFile(catalogDataPath, buffer)
  }
  const stopTime = process.hrtime(startTime)
  console.info('[indexer', 'total scan time:', stopTime[0] + 's', stopTime[1] / 1000000 + 'ms')
}
