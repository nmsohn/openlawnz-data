# openlawnz-data

There are 2 parts: Pipeline (getting data), and Parser (parsing the data).

## Parsers Quick Start for Openlaw NZ volunteers

1. Ask for a copy of the OpenLaw NZ DB in the Slack channel for your own MySQL server setup
    * If you're interested in volunteering please get in touch!
2. Follow "General requirements", "env" and "Installing" steps below
3. Look at the [Database Setup](#database-setup) section
3. Look at the [Parser](#parser) section

## General requirements

- Yarn
- Rename `.env.sample` to .env.`env` (e.g. `.env.local`) and fill in with MySQL details.

## env

Where you see the `env` option in a command, it will look for the corresponding ".env.`env`" file in the root of the project. You could have `.env.local` and `.env.dev`, for example.

## Installing

```bash
yarn install
```

## Database Setup

There are 2 databases:

- `pipeline_cases`: this is populated by running the pipeline and is not affected by the parsers
- `cases`: this is populated and mutated by running the parsers

## Pipeline

### Requirements

*NOTE: The AWS pipeline is disabled at the moment.*
- If you're using AWS, you need to:
  - Put in s3 creds at `~/.aws`
  - AWS profile and bucket details in `.env`
- If you're using [apify](https://www.apify.com/), then fill those details in your `.env`
- Rename `pipeline/adapterconfig.sample.json` to `pipeline/adapterconfig.json` and fill in details
- You need AutoBatch. You can [download it here](https://www.evermap.com/AutoBatch.asp)

### Description

- Pipeline gets data from a `datasource` and loads it into MySQL into a separate immutable database.

A `case` datastore must return an array of:

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

A `legislation` datastore must return an array of:

```javascript
{
  title: "<string>",
  link: "<string>",
  year: "<string>"
  alerts: "<string>"
}
```

### Running

#### Flags

*datasource*:

  - `moj` (only works for `getCases.js`)
  - `pco` (only works for `getLegislation.js`)
  - `localfile` (requires `datalocation`)
  - `url` (requires `datalocation`)

*datalocation*:

  - a local json file OR
  - a url

*copyto*:

- S3 (disabled at the moment)
- local folder path

The folder the PDFs that have been processed are copied to.

*trylocaldatalocation*:

Try and look for data in this folder first before fetching it.

  - local file path

#### Get Cases

```bash
cd pipeline
node getCases.js --env=<env> --datasource=<datasource> --copyto=<copyto> [--datalocation=<datalocation>] [--trylocaldatalocation=<trylocaldatalocation>]
```

#### Get Legislation

```bash
cd pipeline
node getLegislation.js --env=<env> --datasource=<datasource> [--datalocation=<datalocation>]
```

## Parser

- Each time a full run of the parsers is started the `cases` database is emptied and filled with the `pipeline_cases` data before running through each parser
- Each script can be run individually

### Running example

```bash
cd parser
node parseCaseToCase.js --env=<env>
```

## NOTICE

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
