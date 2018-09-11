// currently running on single case page only
// grabs case long title, extracts citation data
// looks for urls to download of pdf or rtf files

function pageFunction(context) {
	// called on every page the crawler visits, use it to extract data from it
	var $ = context.jQuery;

	function getNeutralCitation(str) {
		// try for neutral citation
		const regCite = /(\[?\d{4}\]?)(\s*?)NZ(D|F|H|C|S|L)(A|C|R)(\s.*?)(\d+)*/;
		if (str.match(regCite)) {
			return str.match(regCite)[0];
		} else {
			return null;
		}
	}

	function getOtherCitationData(str) {
		// try for other types of citation
		const otherCite = /(\[|\()\d{4}(\]|\))\s((\d*\s\S*\s\S*\s\d*)|(\w*\s\d*))/gi;
		if (str.match(otherCite)) {
			return str.match(otherCite);
		} else {
			return null;
		}
	}

	function formatName(longName) {
		// change this - currently matches either or. should substring at the index of the earliest of these two matches
		const regExName = /^(.*?)\ \[/;
		const regExFileNumber = /(.*)(?= HC| COA| SC| FC| DC| CA)/;
		// regexName gets everything up to square bracket
		// if that matches, return that
		if (longName.match(regExName)) {
			return longName.match(regExName)[1];
		}
		// if not, regExFileNumber matches everything up to the first " HC", coa, sc, fc or dc, those usually signifying the start of case reference
		else {
			if (longName.match(regExFileNumber)) {
				return longName.match(regExFileNumber)[1];
			} else {
				return "Unknown case";
			}
		}
	}

	var longTitle = $("body h2:eq(0)").text();
	var shortTitle = formatName($("body h2:eq(0)").text());
	var neutralCitation = getNeutralCitation($("body h2:eq(0)").text());
	var otherCitationData = getOtherCitationData($("body h2:eq(0)").text());
	var pdfURL = $("a:contains('PDF')").attr("href")
		? $("a:contains('PDF')").attr("href")
		: null;
	var rtfURL = $("a:contains('RTF')").attr("href")
		? $("a:contains('RTF')").attr("href")
		: null;

    // TODO: make this mirror the MOJ style json
	var result = {
		longTitle: longTitle,
		shortTitle: shortTitle,
		pdfURL: pdfURL,
		rtfURL: rtfURL,
		neutralCitation: neutralCitation,
		otherCitationData: otherCitationData
	};

	return result;
}