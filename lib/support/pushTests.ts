import {predicatePushTest, PredicatePushTest, pushTest} from "@atomist/sdm";
import {BlueGreenDeploy, getActiveDeploy} from "./k8s/getDeploy";

export const IsGreenDeploy = pushTest("bg-check", async pi => {
    const currentDeploy = await getActiveDeploy(pi.context, pi.project.name);
    return currentDeploy !== BlueGreenDeploy.green && currentDeploy !== undefined;
});

export const IsBlueDeploy = pushTest("bg-check", async pi => {
    const currentDeploy = await getActiveDeploy(pi.context, pi.project.name);
    return currentDeploy !== BlueGreenDeploy.blue || currentDeploy === undefined;
});

export const PackageJsonHasCompile: PredicatePushTest = predicatePushTest(
    "npmHasBuildScript",
    async p => {
        if (await p.hasFile("package.json")) {
            const npmFile = await p.getFile("package.json");
            const packageFile = JSON.parse(await npmFile.getContent());
            const hasBuild = packageFile.scripts.hasOwnProperty("compile");
            return hasBuild;
        } else {
            return false;
        }
    });
