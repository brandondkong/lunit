// Lunit coverage transformer for roblox-ts.
//
// Adds a counter in front of each TypeScript statement, so a test run records
// which lines ran. Turn it on in a separate tsconfig, for example
// tsconfig.coverage.json:
//
//   {
//     "extends": "./tsconfig.json",
//     "compilerOptions": { "plugins": [{ "transform": "@rbxts/lunit/transformer" }] }
//   }
//
// Options (in the plugin entry):
//   exclude: regular expressions (strings) for source paths to leave out.
//            Default: test and spec files.
//
// Each module stores its counts at _G.__lunitCoverage[<path>][<line>], where
// <path> is the source path relative to the tsconfig folder. Read them with
// `Coverage` from @rbxts/lunit, or `run({ coverage: true })`.
"use strict";
const path = require("path");

const COUNTS = "__lunitCov";
const STORE = "__lunitCoverage";
const DEFAULT_EXCLUDE = ["\\.(test|spec)\\.tsx?$"];

module.exports = function lunitCoverage(program, config, extras) {
	const ts = (extras && extras.ts) || require("typescript");
	const f = ts.factory;
	const options = program.getCompilerOptions();
	const root = options.configFilePath ? path.dirname(options.configFilePath) : program.getCurrentDirectory();
	const exclude = ((config && config.exclude) || DEFAULT_EXCLUDE).map((p) => new RegExp(p));

	// Statements that run no code of their own.
	function runsNoCode(stmt) {
		if (
			ts.isInterfaceDeclaration(stmt) ||
			ts.isTypeAliasDeclaration(stmt) ||
			ts.isImportDeclaration(stmt) ||
			ts.isImportEqualsDeclaration(stmt) ||
			ts.isExportDeclaration(stmt) ||
			ts.isEmptyStatement(stmt) ||
			// Hoisted; the statements in its body are counted.
			ts.isFunctionDeclaration(stmt) ||
			// A const enum emits no code, and a regular enum is only a table.
			ts.isEnumDeclaration(stmt) ||
			(ts.isModuleDeclaration(stmt) && stmt.body === undefined)
		) {
			return true;
		}
		const modifiers = ts.canHaveModifiers(stmt) ? ts.getModifiers(stmt) : undefined;
		return modifiers !== undefined && modifiers.some((m) => m.kind === ts.SyntaxKind.DeclareKeyword);
	}

	function isSuperCall(stmt) {
		return (
			ts.isExpressionStatement(stmt) &&
			ts.isCallExpression(stmt.expression) &&
			stmt.expression.expression.kind === ts.SyntaxKind.SuperKeyword
		);
	}

	const numberType = () => f.createKeywordTypeNode(ts.SyntaxKind.NumberKeyword);
	const stringType = () => f.createKeywordTypeNode(ts.SyntaxKind.StringKeyword);
	// { [k: K]: V }
	const mapType = (key, value) =>
		f.createTypeLiteralNode([
			f.createIndexSignature(
				undefined,
				[f.createParameterDeclaration(undefined, undefined, "k", undefined, key)],
				value,
			),
		]);
	const constStatement = (name, type, init) =>
		f.createVariableStatement(
			undefined,
			f.createVariableDeclarationList(
				[f.createVariableDeclaration(name, undefined, type, init)],
				ts.NodeFlags.Const,
			),
		);

	// const __lunitCov: { [k: number]: number } = { 3: 0, ... };
	// {
	//     const __lunitG = _G as unknown as { __lunitCoverage?: { [k: string]: { [k: number]: number } } };
	//     if (__lunitG.__lunitCoverage === undefined) __lunitG.__lunitCoverage = {};
	//     __lunitG.__lunitCoverage["src/x.ts"] = __lunitCov;
	// }
	function header(file, lines) {
		const counts = constStatement(
			COUNTS,
			mapType(numberType(), numberType()),
			f.createObjectLiteralExpression(
				lines.map((line) =>
					f.createPropertyAssignment(f.createNumericLiteral(line), f.createNumericLiteral(0)),
				),
			),
		);
		const globalType = f.createTypeLiteralNode([
			f.createPropertySignature(
				undefined,
				STORE,
				f.createToken(ts.SyntaxKind.QuestionToken),
				mapType(stringType(), mapType(numberType(), numberType())),
			),
		]);
		const g = constStatement(
			"__lunitG",
			undefined,
			f.createAsExpression(
				f.createAsExpression(f.createIdentifier("_G"), f.createKeywordTypeNode(ts.SyntaxKind.UnknownKeyword)),
				globalType,
			),
		);
		const store = () => f.createPropertyAccessExpression(f.createIdentifier("__lunitG"), STORE);
		const create = f.createIfStatement(
			f.createStrictEquality(store(), f.createIdentifier("undefined")),
			f.createExpressionStatement(f.createAssignment(store(), f.createObjectLiteralExpression([]))),
		);
		const register = f.createExpressionStatement(
			f.createAssignment(
				f.createElementAccessExpression(store(), f.createStringLiteral(file)),
				f.createIdentifier(COUNTS),
			),
		);
		return [counts, f.createBlock([g, create, register], true)];
	}

	return (context) => (sourceFile) => {
		const file = path.relative(root, sourceFile.fileName).split(path.sep).join("/");
		if (sourceFile.isDeclarationFile || exclude.some((r) => r.test(file))) {
			return sourceFile;
		}
		const lines = new Set();

		function counter(stmt) {
			const line = sourceFile.getLineAndCharacterOfPosition(stmt.getStart(sourceFile)).line + 1;
			lines.add(line);
			return f.createExpressionStatement(
				f.createBinaryExpression(
					f.createElementAccessExpression(f.createIdentifier(COUNTS), f.createNumericLiteral(line)),
					ts.SyntaxKind.PlusEqualsToken,
					f.createNumericLiteral(1),
				),
			);
		}

		function instrumentList(statements, inConstructor) {
			const out = [];
			for (const stmt of statements) {
				const visited = ts.visitNode(stmt, visit);
				if (inConstructor && isSuperCall(stmt)) {
					// super() must stay the first statement.
					out.push(visited, counter(stmt));
				} else if (runsNoCode(stmt)) {
					out.push(visited);
				} else {
					out.push(counter(stmt), visited);
				}
			}
			return out;
		}

		// A body without braces (`if (x) y();`) becomes a block, so it can hold a counter.
		function asBlock(stmt) {
			if (stmt === undefined || ts.isBlock(stmt)) return ts.visitNode(stmt, visit);
			return f.createBlock(instrumentList([stmt], false), true);
		}

		function visit(node) {
			if (ts.isBlock(node)) {
				const inConstructor = node.parent !== undefined && ts.isConstructorDeclaration(node.parent);
				return f.updateBlock(node, instrumentList(node.statements, inConstructor));
			}
			if (ts.isModuleBlock(node)) {
				return f.updateModuleBlock(node, instrumentList(node.statements, false));
			}
			if (ts.isCaseClause(node)) {
				return f.updateCaseClause(
					node,
					ts.visitNode(node.expression, visit),
					instrumentList(node.statements, false),
				);
			}
			if (ts.isDefaultClause(node)) {
				return f.updateDefaultClause(node, instrumentList(node.statements, false));
			}
			if (ts.isIfStatement(node)) {
				const elseStatement =
					node.elseStatement !== undefined && ts.isIfStatement(node.elseStatement)
						? ts.visitNode(node.elseStatement, visit)
						: asBlock(node.elseStatement);
				return f.updateIfStatement(
					node,
					ts.visitNode(node.expression, visit),
					asBlock(node.thenStatement),
					elseStatement,
				);
			}
			if (ts.isIterationStatement(node, false)) {
				return ts.visitEachChild(
					node,
					(child) => (child === node.statement ? asBlock(child) : visit(child)),
					context,
				);
			}
			return ts.visitEachChild(node, visit, context);
		}

		const body = instrumentList(sourceFile.statements, false);
		if (lines.size === 0) return sourceFile;
		// Keep imports first.
		let at = body.findIndex((s) => !ts.isImportDeclaration(s) && !ts.isImportEqualsDeclaration(s));
		if (at === -1) at = body.length;
		const head = header(
			file,
			[...lines].sort((a, b) => a - b),
		);
		return f.updateSourceFile(sourceFile, [...body.slice(0, at), ...head, ...body.slice(at)]);
	};
};
