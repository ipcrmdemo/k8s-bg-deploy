import {configurationValue, HandlerContext} from "@atomist/automation-client";
import {PreferenceStoreFactory, SdmContext} from "@atomist/sdm";

export enum BlueGreenDeploy {
    blue = 0,
    green = 1,
}

export async function getNextDeploy(ctx: HandlerContext, repo: string): Promise<BlueGreenDeploy> {
    const context = await configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);
    const currentDeploy = await context.get(
        `${repo}`, {scope: `bgdeploy`, defaultValue: undefined});

    return (currentDeploy !== BlueGreenDeploy.blue || currentDeploy === undefined)
        ? BlueGreenDeploy.blue : BlueGreenDeploy.green;
}

export async function getActiveDeploy(ctx: HandlerContext, repo: string): Promise<BlueGreenDeploy> {
    const context = await configurationValue<PreferenceStoreFactory>("sdm.preferenceStoreFactory")(ctx);
    const currentDeploy = await context.get(
        `${repo}`, {scope: `bgdeploy`, defaultValue: undefined});

    return (currentDeploy === BlueGreenDeploy.blue || currentDeploy === undefined)
        ? BlueGreenDeploy.blue : BlueGreenDeploy.green;
}
