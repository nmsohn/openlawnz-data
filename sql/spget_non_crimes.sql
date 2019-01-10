CREATE PROCEDURE `get_non_crimes`()
BEGIN
DROP TABLE IF EXISTS `legislationWithoutCrime`;
CREATE TEMPORARY TABLE legislationWithoutCrime AS SELECT id FROM cases.legislation where title not Like "%Crimes%" AND title not like "%Parole%" AND title not like "sentencing%" AND title not like "summary%" AND title not like "criminal%" AND title not like "misuse%";
DROP TABLE IF EXISTS `legislationCasesWithoutCrime`;
CREATE TEMPORARY TABLE legislationCasesWithoutCrime AS SELECT case_id FROM cases.legislation_to_cases where legislation_id in ( SELECT id FROM legislationWithoutCrime );
SELECT id, case_text FROM cases WHERE id IN ( SELECT case_id FROM legislationCasesWithoutCrime) AND case_name NOT LIKE "% V R" AND case_name NOT LIKE "R V %";
END