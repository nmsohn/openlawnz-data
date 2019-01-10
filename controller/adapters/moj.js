const urlAdapter = require("./generic/url");
const common = require("../../common/functions.js");

// Currently limited to 10 results for testing
const maxRows = 10;
const fromDate = "2016-2-27";
const jsonURL = [
	"https://forms.justice.govt.nz/solr/jdo/select",
	"?q=*",
	"&facet=true",
	"&facet.field=Location",
	"&facet.field=Jurisdiction",
	"&facet.limit=-1",
	"&facet.mincount=1",
	"&rows=" + maxRows,
	"&json.nl=map",
	`&fq=JudgmentDate%3A%5B${fromDate}T00%3A00%3A00Z%20TO%20*%20%5D`,
	"&sort=JudgmentDate%20desc",
	"&fl=CaseName%2C%20JudgmentDate%2C%20DocumentName%2C%20id%2C%20score",
	"&wt=json"
].join("");

const run = async () => {
	try {
		const mojData = await urlAdapter(jsonURL, ["response", "docs"]);
		return mojData.map(d => {
			return {
				pdf_provider: "jdo",
				pdf_db_key: "jdo_" + d.JudgmentDate + "_" + d.DocumentName,
				pdf_url: "https://forms.justice.govt.nz/search/Documents/pdf/" + d.id,
				case_name: d.CaseName,
				case_date: d.JudgmentDate,
				citations: [common.getCitation(d.CaseName)]
			};
		});
	} catch (ex) {
		throw ex;
	}
};

if (require.main === module) {
	try {
		run();
	} catch (ex) {
		console.log(ex);
	}
} else {
	module.exports = run;
}
