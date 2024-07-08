import path from "path";
import { promises as fs } from "fs";
import chalk from "chalk";
import del from "del";
import makeDir from "make-dir";
import { webfont } from "webfont";
import favicons from "favicons";
import nunjucks from "nunjucks";
import deepmerge from "deepmerge";

function buildTemplateHTML(result, meta) {
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
				meta: meta,
			},
		]);

		result.templateHTML = nunjucks.render(templateFilePath, nunjucksOptions);
		return result;
	}
}

(async () => {
	console.log(chalk.green("Start building"));

	console.log(chalk.green("Converting favicon"));

	const favicon = await favicons("templates/favicon.svg", {
		appName: "touhou98",
		dir: "ltr",
		lang: "en-US",
		background: "#000",
		theme_color: "#fff",
		icons: {
			android: true,
			appleIcon: true,
			appleStartup: false,
			favicons: true,
			windows: false,
			yandex: false,
		},
	});

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
		}),
		favicon.html.join("")
	);

	const { fontName } = result.config;
	const dest = result.config.dest;
	const web = "web/";

	console.log(chalk.green("Removing previous build"));

	await del(dest);
	await makeDir(dest);
	await del(web);
	await makeDir(web);

	console.log(chalk.green("Saving files"));

	for (const image of favicon.images) {
		const name = path.join(web, image.name);
		if (image.contents.length > 2000) continue;
		await fs.writeFile(name, image.contents);
		console.log(chalk.green(`  Saved `) + chalk.yellow(name));
	}
	for (const file of favicon.files) {
		const name = path.join(web, file.name);
		await fs.writeFile(name, file.contents, {
			encoding: "utf-8",
		});
		console.log(chalk.green(`  Saved `) + chalk.yellow(name));
	}

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
				file = path.join(web, `index.html`);
			} else if (type === "template") {
				file = path.join(dest, `${fontName}.css`);
			} else {
				file = path.join(dest, `${fontName}.${type}`);
			}

			await fs.writeFile(file, content);

			console.log(chalk.green(`  Saved `) + chalk.yellow(file));
		})
	);

	console.log(chalk.green("The build has finished!"));
})().catch((error) => {
	throw error;
});
