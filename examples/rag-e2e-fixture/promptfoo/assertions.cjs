module.exports.hasGroundedCitation = (output) => {
	try {
		const value = JSON.parse(output);
		return (
			typeof value.answer === "string" &&
			value.answer.length > 0 &&
			Array.isArray(value.citations) &&
			value.citations.includes("s11tnext-overview") &&
			Array.isArray(value.retrievedDocumentIds) &&
			value.retrievedDocumentIds.includes("s11tnext-overview")
		);
	} catch {
		return false;
	}
};
