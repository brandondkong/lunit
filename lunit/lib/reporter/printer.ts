import StringBuilder from "../../utils/string-builder";
import { getClassMetadata } from "../metadata/utils";
import { TestCaseResult, TestRunResult } from "../runner/types";

function getSymbol(passed: boolean, skipped?: boolean) {
	return skipped ? "↓" : passed ? "✓" : "✗";
}

function formatTestResult(
	{ passed, skipped, elapsedTimeMs, label, method: { options } }: TestCaseResult,
	isLast: boolean = false,
): StringBuilder {
	const stringBuilder = new StringBuilder();

	const failed = !(passed || skipped);

	const isDisabled = options.disabled?.value || false;
	const disabledMessage = options.disabled?.message ?? "";

	stringBuilder.append(" │");
	stringBuilder.appendLine(
		`\t${isLast ? "└" : "├"}── [${getSymbol(passed, skipped)}] ${label} (${math.round(elapsedTimeMs)}ms) ${passed ? "PASSED" : failed ? "FAILED" : isDisabled ? `SKIPPED${disabledMessage.size() > 0 ? ` (${disabledMessage})` : ""}` : ""}`,
	);
	return stringBuilder;
}

function formatTestRunSummary(results: TestRunResult): StringBuilder {
	const stringBuilder = new StringBuilder();

	stringBuilder.appendLine(`\tRan ${results.numTests} tests in ${math.round(results.elapsedTimeMs)}ms`);
	stringBuilder.appendLine(`\t\tPassed: ${results.numTestsPassed}`);
	stringBuilder.appendLine(`\t\tFailed: ${results.numTestsFailed}`);
	stringBuilder.appendLine(`\t\tSkipped: ${results.numTestsSkipped}`);
	return stringBuilder;
}

function formatTestFailures(results: TestRunResult): StringBuilder {
	const stringBuilder = new StringBuilder();
	let failureIndex = 0;

	stringBuilder.appendLine("Failures:");
	for (const [className, testResults] of results.tests) {
		for (const { label, errorMessage, passed } of testResults.tests) {
			if (passed === true || errorMessage === undefined) continue;
			stringBuilder.appendLine(`${++failureIndex}. ${tostring(className)}.${label}`);

			const errorDisplay = tostring(errorMessage)
				.split("\n")
				.map((line) => "   " + line)
				.join("\n\t");
			stringBuilder.appendLine(errorDisplay);
			stringBuilder.appendLine();
		}
	}
	return stringBuilder;
}

function formatTests(results: TestRunResult): StringBuilder {
	const stringBuilder = new StringBuilder();
	results.tests.forEach((testResultsRecord, testClassMetadata) => {
		const metadata = getClassMetadata(testClassMetadata) ?? {};
		const className = metadata?.displayName ?? tostring(testClassMetadata);

		const someTestsFailed = testResultsRecord.tests.some((test) => !test.passed && !test.skipped);
		stringBuilder.appendLine(
			`[${getSymbol(!someTestsFailed)}] ${className} (${math.round(testResultsRecord.elapsedTimeMs)}ms)`,
		);

		testResultsRecord.tests.forEach((testResult, index) => {
			stringBuilder.append(formatTestResult(testResult, index === testResultsRecord.tests.size() - 1).toString());
		});
		stringBuilder.appendLine();
	});
	return stringBuilder;
}

export function getTestSummary(results: TestRunResult) {
	const stringBuilder = new StringBuilder("\n");
	if (results.tags !== undefined) {
		stringBuilder.appendLine(`Ran filtered tests on the following tags: ${results.tags.join(", ")}`);
		stringBuilder.appendLine();
	}
	if (results.numTests === 0) {
		stringBuilder.appendLine("No tests ran.");
		return stringBuilder.toString();
	}
	stringBuilder.append(formatTests(results).toString());

	if (results.numTestsFailed > 0) {
		stringBuilder.append(formatTestFailures(results).toString());
	}
	stringBuilder.append(formatTestRunSummary(results).toString());

	return stringBuilder.toString();
}
