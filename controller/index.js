/**
 * @file Runs all the steps for processing law data
 */
const argv = require("yargs").argv;

const setup = require("../common/setup.js");

const getData = require("./getData");
const parseEmptyCitations = require("./parseEmptyCitations");
const parseCaseCitations = require("./parseCaseCitations");
const parseCaseToCase = require("./parseCaseToCase");
const parseLegislation = require("./parseLegislation");
const parseLegislationToCases = require("./parseLegislationToCases");

const run = async () => {
	const connection = await setup(argv.env);
	if (!argv.skipdata) {
		await getData(argv.env, argv.datasource, argv.datalocation);
	}
	await parseEmptyCitations(connection);
	await parseCaseCitations(connection);
	await parseCaseToCase(connection);
	await parseLegislation(connection);
	await parseLegislationToCases(connection);
};

run()
	.catch(ex => {
		console.log(ex);
	})
	.finally(process.exit);
