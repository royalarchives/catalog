const fs = require('fs').promises
const path = require('path')
const util = require('util')
const zlib = require('zlib')
const unzipAsync = util.promisify(zlib.unzip)

module.exports = {
  load
}

if (process.argv[1] === __filename) {
  commandLineStart()
}

async function commandLineStart () {
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
  const catalog = await load(moduleNames)
  console.log(JSON.stringify(catalog, null, '  '))
  return process.exit(0)
}

async function load (moduleNames) {
  if (moduleNames && !Array.isArray(moduleNames)) {
    moduleNames = [moduleNames]
  }
  const idIndex = {}
  const filePathIndex = {}
  const treeIndex = {}
  const catalog = await loadJSONFile()
  catalog.api = {
    files: {
      get: require('./api/files.get.js'),
      list: require('./api/files.list.js')
    }
  }
  catalog.indexArray = (array) => {
    for (const object of array) {
      idIndex[object.id] = object
      if (object.filePath) {
        filePathIndex[object.filePath] = object
      }
    }
  }
  catalog.getObject = async (idOrFilePath) => {
    if (idOrFilePath.startsWith('/')) {
      if (filePathIndex[idOrFilePath]) {
        return copyItem(catalog, filePathIndex[idOrFilePath])
      }
      return
    }
    if (!idIndex[idOrFilePath]) {
      return
    }
    return copyItem(catalog, idIndex[idOrFilePath])
  }
  catalog.getObjects = async (collection, options) => {
    const unfilteredResults = []
    for (const object of collection) {
      const item = copyItem(catalog, object)
      unfilteredResults.push(item)
    }
    const results = filter(unfilteredResults, options)
    sort(results, options)
    return paginate(results, options)
  }
  catalog.getTreeObject = (id) => {
    if (!treeIndex[id]) {
      return
    }
    return copyItem(catalog, treeIndex[id])
  }
  if (moduleNames) {
    for (const moduleName of moduleNames) {
      const module = require(moduleName)
      await module.load(catalog)
    }
  }
  catalog.indexArray(catalog.children)
  return catalog
}

async function loadJSONFile () {
  const blankCatalog = {
    name: '/',
    relativePath: '/',
    hash: '/',
    sizeInBytes: 0,
    children: []
  }
  const uncompressedFilePath = path.join(process.env.DATA_PATH, 'catalog.json')
  const uncompessedFileExists = await existsAsync(uncompressedFilePath)
  if (uncompessedFileExists) {
    const rawData = await fs.readFile(uncompressedFilePath)
    if (!rawData || !rawData.length) {
      return blankCatalog
    }
    return JSON.parse(rawData.toString())
  }
  const gzippedFilePath = path.join(process.env.DATA_PATH, 'catalog.json.gz')
  const gzippedFileExists = await existsAsync(gzippedFilePath)
  if (gzippedFileExists) {
    const rawData = await fs.readFile(gzippedFilePath)
    if (!rawData || !rawData.length) {
      return blankCatalog
    }
    const data = await unzipAsync(rawData)
    return JSON.parse(data.toString())
  }
  return blankCatalog
}

async function existsAsync (itemPath) {
  try {
    await fs.stat(itemPath)
    return true
  } catch (error) {
    return false
  }
}

function normalize (text) {
  return text.toLowerCase().replace(/[\W_]+/g, ' ').trim()
}

async function copyItem (catalog, source) {
  const item = {}
  for (const key in source) {
    if (!Array.isArray(source[key])) {
      item[key] = source[key]
      continue
    }
    item[key] = []
    for (const i in source[key]) {
      if (source[key][i] && source[key][i].length && source[key][i].indexOf('_')) {
        const entity = await catalog.getObject(source[key][i])
        item[key][i] = {
          id: entity.id,
          type: entity.type,
          name: entity.name
        }
      } else {
        item[key][i] = source[key][i]
      }
    }
  }
  return item
}

function paginate (array, options) {
  const limit = options && options.limit ? parseInt(options.limit, 10) : 0
  const offset = options && options.offset ? parseInt(options.offset, 10) : 0
  const sizeWas = array.length
  if (offset) {
    array.splice(0, offset)
  }
  if (array.length > limit) {
    array.length = limit
  }
  return {
    data: array,
    offset,
    limit,
    total: sizeWas
  }
}

function filter (array, options) {
  const filtered = []
  for (const item of array) {
    let group
    if (options.composer) {
      group = 'composer'
      const value = options[group]
      const array = item[group + 's']
      if (!value || !array || !array.length) {
        continue
      }
      const normalized = normalize(value)
      const matchType = normalize(options[`${group}Match`])
      const found = matchInArray(array, matchType, normalized)
      if (!found || !found.length) {
        continue
      }
    }
    if (options.artist) {
      group = 'artist'
      const value = options[group]
      const array = item[group + 's']
      if (!value || !array || !array.length) {
        continue
      }
      const normalized = normalize(value)
      const matchType = normalize(options[`${group}Match`])
      const found = matchInArray(array, matchType, normalized)
      if (!found || !found.length) {
        continue
      }
    }
    if (options.genre) {
      group = 'genre'
      const value = options[group]
      const array = item[group + 's']
      if (!value || !array || !array.length) {
        continue
      }
      const normalized = normalize(value)
      const matchType = normalize(options[`${group}Match`])
      const found = matchInArray(array, matchType, normalized)
      if (!found || !found.length) {
        continue
      }
    }
    if (options.keyword) {
      const normalized = normalize(options.keyword)
      const matchType = normalize(options.keywordMatch)
      const found = matchValue(item, 'name', matchType, normalized)
      if (!found) {
        continue
      }
    }
    filtered.push(item)
  }
  return filtered
}

function sort (array, options) {
  if (!options.sort) {
    return array
  }
  const sortField = options.sort
  const sortDirection = options.sortDirection
  array.sort((a, b) => {
    if (sortDirection === 'DESC') {
      if (!a[sortField]) {
        return 1
      } else if (!b[sortField]) {
        return -1
      } else if (Array.isArray[a[sortField]]) {
        return normalize(a[sortField].join(',')) < normalize(b[sortField].join(',')) ? 1 : -1
      } else if (a[sortField] < 0 || a[sortField] > 0 || a[sortField] === 0) {
        return a[sortField] < b[sortField] ? 1 : -1
      } else {
        return normalize(a[sortField]) < normalize(b[sortField]) ? 1 : -1
      }
    } else {
      if (!a[sortField]) {
        return -1
      } else if (!b[sortField]) {
        return 1
      } else if (Array.isArray[a[sortField]]) {
        return normalize(a[sortField].join(',')) > normalize(b[sortField].join(',')) ? 1 : -1
      } else if (a[sortField] < 0 || a[sortField] > 0 || a[sortField] === 0) {
        return a[sortField] > b[sortField] ? 1 : -1
      } else {
        return normalize(a[sortField]) > normalize(b[sortField]) ? 1 : -1
      }
    }
  })
  return array
}

function matchInArray (array, matchType, value) {
  const normalizedValue = normalize(value)
  if (matchType === 'start' || matchType === 'starts') {
    return array.filter(entity => normalize(entity.name).startsWith(normalizedValue))
  } else if (matchType === 'end' || matchType === 'ends') {
    return array.filter(entity => normalize(entity.name).endsWith(normalizedValue))
  } else if (matchType === 'contain' || matchType === 'contains') {
    return array.filter(entity => normalize(entity.name).indexOf(normalizedValue) > -1)
  } else if (matchType === 'exclude' || matchType === 'excludes') {
    return array.filter(entity => normalize(entity.name).indexOf(normalizedValue) === -1)
  }
  return array.filter(entity => normalize(entity.name) === normalizedValue)
}

function matchValue (item, property, matchType, value) {
  const normalizedProperty = normalize(item[property])
  const normalizedValue = normalize(value)
  if (matchType === 'start' || matchType === 'starts') {
    return normalizedProperty.startsWith(normalizedValue)
  } else if (matchType === 'end' || matchType === 'ends') {
    return normalizedProperty.endsWith(normalizedValue)
  } else if (matchType === 'contain' || matchType === 'contains') {
    return normalizedProperty.indexOf(normalizedValue) > -1
  } else if (matchType === 'exclude' || matchType === 'excludes') {
    return normalizedProperty.indexOf(normalizedValue) === -1
  }
  return normalizedProperty === normalizedValue
}
