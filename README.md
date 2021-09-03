# Library

Library indexes all the files within one or more folders and maps the folder structure.  It can be extended with modules to index specific types of files and collect metadata information.  The API filters, sorts and paginates your files and anything modules add.

### Documentation

- [How to use](#how-to-use)
- [Index data structure](#index-data-structure)
- [Modules](#library-modules)
- [Compressing index files](#compressing-index-files)
- [Indexing files from command line](#indexing-files-from-the-command-line)
- [Loading index from command line](#loading-index-from-the-command-line)
- [Indexing files with NodeJS](#indexing-files-with-nodejs)
- [Using the index with NodeJS](#using-the-files-index-with-nodejs)

## How to use 

You can clone the project and run it from a command line:

    $ git clone https//github.com/server/library
    $ cd library
    $ node scanner.js /path/to/files

It can work with multiple paths:

    $ node scanner.js /path/to/files /optional/second/path

And load modules from the command line:

    $ node scanner.js @royalarchives/library-music /path/to/files

Or use it as a module in NodeJS to support your project: 

    const Library = require('library')
    const musicLibrary = await Library.load('@royalarchives/library-music', '/path/to/music')

[Top of page](#documentation)    

## Index data structure

This is the data structure of the index.  Files can be sorted, filtered and paginated.  The tree maps the folder nesting structure.

    LIBRARY INDEX {
      files [{
        type               file
        id                 string
        file               string
        path               string
        size               integer
      }],
      tree: {
        type               folder
        id                 string
        folder             string
        path               string
        items              array [{folder|file}]
      }
    }

[Top of page](#documentation)

### Library modules

| Module name                    | Description                                                                                                           |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| @royalarchives/library-music | Indexes library files for `MP3` and `FLAC` media and adds songs, albums, genres, and credited persons to your library | 

[Top of page](#documentation)

### Compressing index files

JSON is very verbose and can be heavily-compressed by setting an environment variable:

    $ export GZIP_LIBRARY_DATA=true

You can configure this permanently in Ubuntu:

    $ echo "GZIP_LIBRARY_DATA=true" >> ~/.bashrc

Specify it when scanning or loading libraries:

    $ GZIP_LIBRARY_DATA=true node scanner.js /path/to/music

    $ GZIP_LIBRARY_DATA=true node library.js /path/to/music

[Top of page](#documentation)

## Indexing files from the command line 

The command line arguments are module names and then paths:

    $ node scanner.js module1 module2 moduleN path1

    $ node scanner.js /path/to/folder

    $ node scanner.js @royalarchives/library-music /path/to/music

[Top of page](#documentation)

## Loading files from the command line 

The command line arguments are module names and then paths:

    $ node library.js @royalarchives/library-music /path/to/music /path/to/more/music /path/to/other/music

[Top of page](#documentation)

## Indexing files with NodeJS

    const Library = require('@royalarchives/library')

In NodeJS you specify modules and paths using a string or arrays:

    const Library = require('@royalarchives/library')
    await Library.scan('/path/to/files')
    await Library.scan('@royalarchives/library-music', '/path/to/music')
    await Library.scan('@royalarchives/library-music', [
      '/music-1/music',
      '/music-2/music',
      '/music-3/music'
    ])

Load your library by passing the same parameters that built it:

    const Library = require('@royalarchives/library')
    const fileLibrary = await Library.load('/path/to/files')
    const musicLibrary = await Library.load('@royalarchives/library-music', '/path/to/music')
    const bigMusicLibrary = await Library.load('@royalarchives/library-music', [
      '/music-1/music',
      '/music-2/music',
      '/music-3/music'
    ])

## Using the API with NodeJS

File information can be retrieved with an ID:

    const Library = require('@royalarchives/library')
    const fileLibrary = await Library.load('/path/to/files')
    const file = await fileLibrary.api.files.get(fileid)

    RESPONSE {
      data: {
        type               string
        id                 string
        file               string
        size               integer
      }
    }

The files array can be sorted, filtered and paginated:

    const Library = require('@royalarchives/library')
    const fileLibrary = await Library.load('/path/to/files')
    const response = await fileLibrary.api.files.list({
      sort                 string
      sortDirection        string asc|desc
      offset               integer
      limit                integer
      keyword              string
      keywordMatch         string equal|start|end|exclude|contain
      <property>           string
      <property>Match      string
    })

    RESPONSE  {
      offset               integer
      limit                integer 
      total                integer
      data: [{
        type               file
        id                 string
        file               string
        size               integer
      }]
    }

[Top of page](#documentation)

## License

MIT
