import path from "path";
import fs from "fs";
import chalk from "chalk";
import del from "del";
import makeDir from "make-dir";
import Jimp from "jimp";

function* groupPixels(image, { width, height }) {
	const area = width * height;
	if (area === 0) return;

	while (true) {
		let maxCandidate = null;
		let maxCandidateScore = 0;
		const list = new Uint16Array(area);
		for (let y = 0; y < height; y++) {
			for (let x = 0; x < width; x++) {
				if (!image[y + x * height]) continue;
				const subWidth = width - x;
				const subHeight = height - y;
				list.fill(0);
				for (let y2 = 0; y2 < subHeight; y2++) {
					for (let x2 = 0; x2 < subWidth; x2++) {
						if (
							(list[y2 * subWidth + x2] =
								image[y2 + y + (x2 + x) * height] &&
								(x2 === 0 || list[y2 * subWidth + x2 - 1] > 0) &&
								(y2 === 0 || list[(y2 - 1) * subWidth + x2] > 0)
									? area * (Math.min(x2, y2) + 1) + Math.max(x2, y2) + 1
									: 0) === 0
						)
							break;
					}
				}
				const maxScore = Math.max(...list);
				const maxIndex = list.indexOf(maxScore);
				if (maxScore > maxCandidateScore) {
					maxCandidateScore = maxScore;
					maxCandidate = {
						x,
						y,
						width: (maxIndex % subWidth) + 1,
						height: Math.floor(maxIndex / subWidth) + 1,
					};
				}
			}
		}
		if (
			maxCandidate == null ||
			(maxCandidate.height === 1 && maxCandidate.width === 1)
		)
			break;
		for (let y = maxCandidate.y; y < maxCandidate.y + maxCandidate.height; y++) {
			for (let x = maxCandidate.x; x < maxCandidate.x + maxCandidate.width; x++) {
				image[y + x * height] = false;
			}
		}
		yield maxCandidate;
	}
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			if (image[y + x * height]) yield { x, y, width: 1, height: 1 };
		}
	}
}

function bitmap2svg(image, { width, height }) {
	let svg = `<?xml version="1.0" encoding="utf-8"?><svg version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0" y="0" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">\n`;
	for (const rect of groupPixels(image, { width, height })) {
		svg += `<rect x="${rect.x}" y="${rect.y}" width="${rect.width}" height="${rect.height}" />\n`;
	}
	svg += `</svg>`;
	return svg;
}

(async () => {
	const dest = path.join("svg");
	const destChars = path.join(dest, "c");
	const destLowerCase = path.join(dest, "l");
	const destLigatures = path.join(dest, "z");

	await del(dest);
	await makeDir(dest);
	await makeDir(destChars);
	await makeDir(destLowerCase);
	await makeDir(destLigatures);

	const chars = (await fs.promises.readFile("src/chars.txt", "utf8")).split(
		"\n"
	);

	const image = await Jimp.read("src/chars.png");

	const stream = new Uint8Array(256 * 256);

	const rows = 16;

	for (let i = 0; i < rows; i++) {
		const section = image.clone().crop(0, i * 16, 256, 16);
		let offset = i * 256 * 16;
		for (let x = 0; x < 256; x++) {
			for (let y = 0; y < 16; y++, offset++)
				stream[offset] = section.getPixelColor(x, y) >>> 8 !== 0 ? 1 : 0;
		}
	}

	let index = 0;
	while (index < chars.length) {
		const char = chars[index];
		if (char != null && char !== "" && char !== "???") {
			const start = index;
			while (index < chars.length && chars[index + 1] === char) {
				index++;
			}
			const image = stream.subarray(start * 256, (index + 1) * 256);
			const width = 16 * (index - start + 1);
			const height = 16;
			const svg = bitmap2svg(image, { width, height });
			const length = [...char].length;
			if (length === 1) {
				await fs.promises.writeFile(
					path.join(destChars, `${char}.svg`),
					svg,
					"utf8"
				);
				if (char.toLowerCase() !== char) {
					await fs.promises.writeFile(
						path.join(destLowerCase, `${char.toLowerCase()}.svg`),
						svg,
						"utf8"
					);
				}
			} else {
				await fs.promises.writeFile(
					path.join(destLigatures, `${char}.svg`),
					svg,
					"utf8"
				);
			}
		}
		++index;
	}

	console.log(chalk.green("SVG generated!"));
})().catch((error) => {
	throw error;
});
