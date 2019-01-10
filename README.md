# openlawnz-data

## Requirements

- AWS s3 creds needed at `~/.aws`
- Rename `.env.sample` to .env.`env` (e.g. `.env.local`) and fill in with mySQL and AWS details. If you're using [apify](https://www.apify.com/), then fill those details in too
- Rename `processor/adapterconfig.sample.json` to `processor/adapterconfig.json` and fill in which adapter you want to use:
  - If you're using xpdf you can [download it here](https://www.xpdfreader.com/download.html) "Xpdf tools" and point to the `pdftotext` binary
  - If you're using you can [download it here](https://www.evermap.com/AutoBatch.asp)
- Yarn is required

## Structure

- `processor` runs in an isolated process created from controller
- Controller is where you run the program
- Each controller process can be run independently

## Installing

```bash
yarn install
```

## env

Where you see the `env` option in a command, it will look for the corresponding ".env.`env`" file in the root of the project. You could have `.env.local` and `.env.dev`, for example.

## Running controller

`index.js` contains calls to a series of scripts inside `controller`.

The `getData.js` script spawns a `processor` process.

```bash
cd controller
node index.js --env=<env> --datasource=<datasource> [--datalocation=<datalocation>] [--skipdata]
```

`datasource` can be:

- `moj`
- `localfile` (requires `datalocation`)

`skipdata` will run the controller scripts without running `getData.js`

## Running processor

If you'd like to run the `processor` independently of the `controller`:

```bash
cd processor
node index.js --env=<env> --cases=<cases>
```

`cases` is a URI encoded string of a case array. The object looks like this:

```javascript
{
  pdf_provider: "<string>", // e.g. jdo
  pdf_db_key: "<string>", // (must be unique)
  pdf_url: "<string>" // location of pdf file,
  case_name: "<string>" // case name,
  case_date: "<string>" // case date,
  citations: "<array<string>>" // citations string array
}
```

## Deleting

If you'd like to flush your DB and start the process again:

```bash
node controller/_deleteAllData.js --env=<env>
node controller/_deleteAllRelationships.js --env=<env>
```

It'll wait for 5 seconds before doing it in case you made a mistake with your `env`.

## Tests

This will run `eslint` and some `mocha` tests. If you want to contribute, you'll have to pass these tests.

I advise using [prettier](https://github.com/prettier/prettier) to help keep you in line with the conventions.

```bash
yarn test
```
