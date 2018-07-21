/**
 * Case to Case
 * @param MysqlConnection connection
 * @param {function} cb
 * 
 * last updated 7/21/2018 by Matt Frost
 */
// populate the case_to_case table
// that table has two fields - case_id_1 and case_id_2 both integers and foreign keys referencing ids in the cases table
// case_id_1 is the referencing case
// case_id_2 is the case being referenced
const citation_reg = /\[[0-9]{4}\]\s[a-zA-Z]{1,7}\s[0-9]{0,6}[,;.\s]/g;
const moment = require('moment')
const run = (connection, cb) => {
	var start = moment().unix()
	var end;
	console.log("Parse case to case");
	console.log("started at " + start)
	connection.query(
		"select id, case_text from cases; select citation, case_id from case_citations",
		function (err, results, fields) {
			if (err) {
				cb(err);
				return;
			}
			console.log("fetched tables in: " + (moment().unix() - start ) + " secs")

			var allCases = results[0];
			var allCitations = results[1];

			var insertQueries = [];

			// initialize map of citation strings
			var case_citations = {};
			console.log("started matching")
			/** 
			 * Loop over cases, pull out all citations and 
			 * 
			 */
			allCases.forEach(function (caseRow) {
				// go through each case, check for blank text
				if (!caseRow.case_text) {
					return;
				}
				// regex searches for the format of a citation, grabs all valid sitations and maps them under the id of the case
				// ACCOUNT For bad whitespace
				var matches = caseRow.case_text.match(citation_reg);

				// create map entry with key as the ID, all citations as body
				if (matches) {
					case_citations[caseRow.id] = matches
				}
			});
			console.log("found regex in: " + (moment().unix() - start ) + " secs")

			// assuming no blank text, inside each case look at all citation records in the db
			// see if any citations in the db are present in the case text
			allCitations.forEach(function (citationRow) {
				for (var key in case_citations) {
					case_citations[key].forEach((caseCitation) => {
						// match against caseRow.case_text, and only match if the ids are not identical (dont need to add a case's reference to itself)
						if (citationRow.citation) {
							caseCitation = caseCitation.slice(0,-1)
							caseCitation += ";"
							// so indexOf returns if partial match of citation
							// searching through full text for presence of a shorter citation eg [2017] NZHC 5, will return for 50, 51 etc and 500 and so on
							// so add a period, space, comma and semicolon to the end of each citation and search for those instead
							// very efficient, much fast
							var w = citationRow.citation.concat(";");

						if ( caseCitation.indexOf(w) !== -1 && citationRow.case_id != key ) {
							/** 
							 * here, we need to check for duplicates already in the case_to_case table?
							 * the script will likely be run regularly across the whole db (to account for new citations being added)
							 * this will result in duplicate entries
							 * UPDATE: put a key on (case_id_1, case_id_2)
							*/
							insertQueries.push(
								"insert into case_to_case (case_id_1, case_id_2) values ('" +
								key +
								"', '" +
								citationRow.case_id +
								"')"
							);

						}}
					})
				}
			});
			console.log("Created insert queries in: " + (moment().unix() - start ) + " secs")
			console.log("Insert", insertQueries.length);
			if (insertQueries.length > 0) {
				connection.query(insertQueries.join(";"), function (
					err,
					results,
					fields
				) {
					if (err) {
						cb(err);
						return;
					}
					console.log("Finshed insert in: " + (moment().unix() - start ) + " secs")
					cb();
				});
			} else {
				cb();
			}
		}
	);
};

if (require.main === module) {
	const connection = require("../lib/db");
	connection.connect(err => {
		if (err) {
			console.log("Error connecting");
			return;
		}
		run(connection, err => {
			connection.end();
			if (err) {
				console.log(err);
				return;
			}
			console.log("Done");
		});
	});
} else {
	module.exports = run;
}
