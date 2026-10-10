import fs from "fs-extra";

import { expectSuccess, ReferenceFixture } from "../referenceFixture";

let fixture: ReferenceFixture;
const store = "node_modules/.pnpm/probe@1/node_modules/@polytoria-ts/probe";
beforeEach(() => {
	fixture = new ReferenceFixture();
	fixture.project("game");
	fixture.write("game/src/index.ts", 'import { answer } from "@rbxts/probe"; export const result = answer;');
});
afterEach(() => fixture.close());

function installPackage(extension = "lua") {
	fixture.json(`${store}/package.json`, {
		name: "@polytoria-ts/probe",
		version: "1.0.0",
		types: "index.d.ts",
		main: `init.${extension}`,
	});
	fixture.write(`${store}/index.d.ts`, "export declare const answer: number;");
	fixture.write(`${store}/init.${extension}`, "return { answer = 42 }");
	fs.ensureSymlinkSync(fixture.file(store), fixture.file("node_modules/@polytoria-ts/probe"), "junction");
}

function modules(packagePath: string) {
	return { $className: "Folder", "@rbxts": { $className: "Folder", probe: { $path: packagePath } } };
}

it.each(["lua", "luau"])("resolves a pnpm package mounted by its real path with a %s entry point", extension => {
	installPackage(extension);
	fixture.rojo({ node_modules: modules(store) });

	expectSuccess(fixture.createBuild().build());
	expect(fixture.read("out/game/init.luau")).toContain('"node_modules", "@rbxts", "probe"');
});

it("reports an unmapped package whose runtime entry point directory is missing", () => {
	installPackage();
	const packageJson = fs.readJsonSync(fixture.file(`${store}/package.json`));
	packageJson.main = "missing/init.lua";
	fixture.json(`${store}/package.json`, packageJson);

	const result = fixture.createBuild().build();
	expect(result.emitSkipped).toBe(true);
	expect(result.diagnostics.map(diagnostic => diagnostic.messageText).join("\n")).toContain(
		"Could not find Rojo data",
	);
});
