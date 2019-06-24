/**
 * Statistics
 * @param MysqlConnection connection
 */
const run = async connection => {

	console.log("\n-----------------------------------");
	console.log("Statistics");
    console.log("-----------------------------------\n");
    
    const [
        [
            [ { validFootnotes } ],
            [ { invalidFootnotes } ],
            [ { noFootnotes } ],
            [ { totalCases } ],
            [ { totalCaseToCaseRelationships } ],
            [ { totalLegislationToCaseRelationships } ]
        ]
    ] = await connection.query(`
        SELECT COUNT(*) AS validFootnotes FROM cases WHERE case_footnotes_are_valid = 1;
        SELECT COUNT(*) AS invalidFootnotes FROM cases WHERE case_footnotes_are_valid = 0;
        SELECT COUNT(*) AS noFootnotes FROM cases WHERE case_footnotes_are_valid IS NULL;
        SELECT COUNT(*) AS totalCases FROM cases;
        SELECT SUM(citation_count) AS totalCaseToCaseRelationships FROM cases_cited;
        SELECT SUM(count) AS totalLegislationToCaseRelationships FROM legislation_to_cases;
    `);

    const totalNonNullFootnotes = validFootnotes + invalidFootnotes;

    console.log(`Valid Footnotes: ${validFootnotes} (${Math.round((validFootnotes/totalNonNullFootnotes) * 100)}%)`);
    console.log(`Invalid Footnotes: ${invalidFootnotes}  (${Math.round((invalidFootnotes/totalNonNullFootnotes) * 100)}%)`);
    console.log(`Percentage of cases with no footnotes: ${Math.round((noFootnotes/totalCases) * 100)}%`)
    
    console.log(`Total cases: ${totalCases}`);
    console.log(`Total case to case: ${totalCaseToCaseRelationships}`);
    console.log(`Total legislation to case: ${totalLegislationToCaseRelationships}`);
    
    connection.end();
};

if (require.main === module) {
	const argv = require("yargs").argv;
	(async () => {
		try {
			const { connection } = await require("../common/setup")(argv.env);
			await run(connection);
		} catch (ex) {
			console.log(ex);
		}
	})().finally(process.exit);
} else {
	module.exports = run;
}
