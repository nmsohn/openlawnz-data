# openlawnz-data

## Requirements

*   AWS s3 creds needed at ~/.aws
*   Rename .env.sample to .env and fill in with mySQL and AWS details
*   xpdf required in /xpdf at root directory, install tools from https://www.xpdfreader.com/download.html
*   We recommend yarn

## Structure

*   pdfToDBProcessor runs in an isolated process spawned from controller
*   Controller is where you run the program

## Installing

```
yarn install
```

## Running

```
yarn start
```

## Tests

```
cd tests
npx jasmine
```

## TODO

*   Write installer

## NOTICE

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
