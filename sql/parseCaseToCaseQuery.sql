INSERT INTO case_to_case \
		SELECT ca.id, ci.case_id \
		FROM cases AS ca, case_citations AS ci WHERE \ 
		ca.id <> ci.case_id \
		AND(ca.case_text LIKE concat('%', ci.citation, '.%') \
			OR ca.case_text LIKE concat('%', ci.citation, ' %') \
			OR ca.case_text LIKE concat('%', ci.citation, ',%') \
			OR ca.case_text LIKE concat('%', ci.citation, ';%'))