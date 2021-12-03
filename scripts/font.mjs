import path from "path";
import fs from "fs";
import chalk from "chalk";
import del from "del";
import makeDir from "make-dir";
import { webfont } from "webfont";
import nunjucks from "nunjucks";
import deepmerge from "deepmerge";

function buildTemplateHTML(result) {
	const options = result.config;
	if (options.templateHTML) {
		const resolvedTemplateFilePath = path.resolve(options.templateHTML);

		nunjucks.configure(path.dirname(resolvedTemplateFilePath));
		const templateFilePath = path.resolve(resolvedTemplateFilePath);

		const glyphs = result.glyphsData
			.map((glyph) => glyph.metadata)
			.filter((glyph) => [...glyph.unicode[1]].length === 1);
		const ligatures = result.glyphsData
			.map((glyph) => glyph.metadata)
			.filter((glyph) => [...glyph.unicode[1]].length > 1);

		const nunjucksOptions = deepmerge.all([
			{
				glyphs,
				ligatures,
			},
			options,
			{
				className:
					options.templateHTMLClassName ||
					options.templateClassName ||
					options.fontName,
				fontName:
					options.templateHTMLFontName ||
					options.templateFontName ||
					options.fontName,
				fontPath: (
					options.templateHTMLFontPath || options.templateFontPath
				).replace(/\/?$/u, "/"),
			},
		]);

		result.templateHTML = nunjucks.render(templateFilePath, nunjucksOptions);
		return result;
	}
}

(async () => {
	console.log(chalk.green("Start building"));

	const result = buildTemplateHTML(
		await webfont({
			files: "svg/**/*.svg",
			fontName: "touhou98",
			dest: "dist/",
			template: "templates/template.css.njk",
			templateFontPath: "./",
			templateClassName: "touhou98",
			templateHTML: "templates/template.html.njk",
			templateHTMLFontPath: "./",
			sort: false,
			fixedWidth: false,
		})
	);

	const { fontName } = result.config;
	const dest = result.config.dest;

	console.log(chalk.green("Removing previous build"));

	await del(dest);
	await makeDir(dest);

	console.log(chalk.green("Saving files"));

	await Promise.all(
		Object.keys(result).map(async (type) => {
			if (
				type === "config" ||
				type === "usedBuildInTemplate" ||
				type === "glyphsData"
			) {
				return;
			}

			const content = result[type];
			let file = null;

			if (type === "templateHTML") {
				file = path.join(dest, `index.html`);
			} else if (type === "template") {
				file = path.join(dest, `${fontName}.css`);
			} else {
				file = path.join(dest, `${fontName}.${type}`);
			}

			await fs.promises.writeFile(file, content);

			console.log(chalk.green(`  Saved `) + chalk.yellow(file));
		})
	);

	console.log(chalk.green("The build has finished!"));
})().catch((error) => {
	throw error;
});
