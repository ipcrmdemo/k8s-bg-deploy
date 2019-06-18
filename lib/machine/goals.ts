import {LogSuppressor, SoftwareDeliveryMachine} from "@atomist/sdm";
import {cacheRemove, cacheRestore, GoalCacheOptions, Version} from "@atomist/sdm-core";
import {DockerBuild, DockerProgressReporter} from "@atomist/sdm-pack-docker";
import {IsNode, NodeProjectVersioner, NpmInstallProjectListener} from "@atomist/sdm-pack-node";
import {k8sCallback} from "../support/k8s/callback";
import {BlueGreenDeploy} from "../support/k8s/getDeploy";
import {KubernetesBlueGreenDeploy} from "../support/k8s/k8sBlueGreen";
import {KubernetesManageServiceTraffic} from "../support/k8s/k8sTraffic";
import {NpmCompileProjectListener} from "../support/node/compileProjectListener";

export const nodeVersion = new Version().withVersioner(NodeProjectVersioner);
const NodeModulesCacheOptions: GoalCacheOptions = {
    entries: [{ classifier: "nodeModules", pattern: { directory: "node_modules" }}],
    onCacheMiss: [NpmInstallProjectListener, NpmCompileProjectListener],
};

export const dockerBuildGoal: DockerBuild = new DockerBuild()
export const k8sBlueProd = new KubernetesBlueGreenDeploy({ environment: "production" })
export const k8sGreenProd = new KubernetesBlueGreenDeploy({ environment: "production" });

export const k8sTrafficUpdateBlue = new KubernetesManageServiceTraffic( {
        preApproval: true,
        environment: "production",
    });

export const k8sTrafficUpdateGreen = new KubernetesManageServiceTraffic(
    {
        preApproval: true,
        environment: "production",
    });

export function addGoalImplementations(sdm: SoftwareDeliveryMachine): SoftwareDeliveryMachine {
    k8sBlueProd
        .with({
            deployType: BlueGreenDeploy.blue,
            applicationData: k8sCallback,
        });

    k8sGreenProd
        .with({
            deployType: BlueGreenDeploy.green,
            applicationData: k8sCallback,
        });

    k8sTrafficUpdateBlue
        .with({
            deployType: BlueGreenDeploy.blue,
            applicationData: k8sCallback,
        });

    k8sTrafficUpdateGreen
        .with({
            deployType: BlueGreenDeploy.green,
            applicationData: k8sCallback,
        });

    dockerBuildGoal
        .with({
                progressReporter: DockerProgressReporter,
                logInterpreter: LogSuppressor,
                pushTest: IsNode,
                options: sdm.configuration.sdm.docker,
            })
                .withProjectListener(cacheRestore(NodeModulesCacheOptions))
                .withProjectListener(cacheRemove(NodeModulesCacheOptions));

    return sdm;
}
