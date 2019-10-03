/**
 * @file Runs all the steps for processing law data
 */
const argv = require('yargs').argv;
const moment = require('moment');

const setup = require('../common/setup.js');

const resetCases = require('./_resetCases');
const parseInvalidCharacters = require('./parseInvalidCharacters');
const parseFootnotes = require('./parseFootnotes');
const parseEmptyCitations = require('./parseEmptyCitations');
const parseCourts = require('./parseCourts');
const parseCaseCitations = require('./parseCaseCitations');
const parseCaseToCase = require('./parseCaseToCase');
const parseLegislationToCases = require('./parseLegislationToCases');

// TODO: Timings between each step
const run = async () => {
	console.log('Running all parsers');

	const { connection, pipeline_connection, logDir } = await setup(argv.env);
	const start = moment();

	console.log(`- logDir: ${logDir}`);
	console.log(`- Started ${start}`);

	await resetCases(connection, pipeline_connection, logDir);
	await parseInvalidCharacters(connection, logDir);
	await parseFootnotes(connection, logDir);
	await parseEmptyCitations(connection, logDir);
	await parseCaseCitations(connection, logDir);
	await parseCourts(connection, logDir);
	await parseCaseToCase(connection, logDir);
	await parseLegislationToCases(connection, logDir);
	console.log(`All done. Took ${moment().diff(start, 'minutes')} minutes`);
};

run()
	.catch((ex) => {
		console.log(ex);
	})
	.finally(process.exit);
