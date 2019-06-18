import { logger } from "@atomist/automation-client";
import {
    DefaultGoalNameGenerator, doWithProject,
    ExecuteGoal,
    FulfillableGoalDetails, FulfillableGoalWithRegistrations,
    getGoalDefinitionFrom, Goal, GoalDefinition,
} from "@atomist/sdm";
import { KubernetesDeploy, KubernetesDeployRegistration } from "@atomist/sdm-pack-k8s";
import { generateKubernetesGoalEventData, getKubernetesGoalEventData } from "@atomist/sdm-pack-k8s/lib/deploy/data";
import { defaultDataSources } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import { makeApiClients } from "@atomist/sdm-pack-k8s/lib/kubernetes/clients";
import { loadKubeConfig } from "@atomist/sdm-pack-k8s/lib/kubernetes/config";
import { upsertIngress } from "@atomist/sdm-pack-k8s/lib/kubernetes/ingress";
import * as _ from "lodash";
import {k8sCallback} from "./callback";
import {BlueGreenDeploy, getNextDeploy} from "./getDeploy";

export interface KubernetesTrafficSwitcherRegistration extends  KubernetesDeployRegistration {
    deployType: BlueGreenDeploy;
}

export function initiateKubernetesServiceChange(
    k8Deploy: KubernetesDeploy,
    registration: KubernetesDeployRegistration,
): ExecuteGoal {
    return doWithProject(async pa => {
        const nextDeploy = await getNextDeploy(pa.context, pa.goalEvent.repo.name);
        defaultDataSources(registration);
        const goalEvent = await generateKubernetesGoalEventData(k8Deploy, registration, pa);
        const app = getKubernetesGoalEventData(goalEvent);

        const updatedApp = await k8sCallback(app, pa.project, k8Deploy, pa.goalEvent, pa.context);
        updatedApp.ingressSpec = {
            spec: {
                rules: [{
                        http: {
                            paths: [{
                                    path: `${updatedApp.path}`,
                                    backend: { serviceName: `${app.name}${BlueGreenDeploy[nextDeploy]}`},
                             }],
                        },
                }],
            },
        };

        let config: any;
        try {
            config = loadKubeConfig();
        } catch (e) {
            e.message = `Failed to load Kubernetes config to deploy ${updatedApp.ns}/${updatedApp.name}: ${e.message}`;
            logger.error(e.message);
            throw e;
        }
        const clients = makeApiClients(config);
        const req = { ...app, ...{sdmFulfiller: "local"}, clients };

        await upsertIngress(req);

        await pa.preferences.put(
            `${pa.goalEvent.push.repo.name}`, nextDeploy, {scope: `bgdeploy`});

        return {
            code: 0,
            externalUrls: [
                {url: `${updatedApp.protocol ? updatedApp.protocol : "http"}://${updatedApp.host}${updatedApp.path}`},
            ],
        };
    });
}

export class KubernetesManageServiceTraffic extends FulfillableGoalWithRegistrations<KubernetesDeployRegistration> {
    constructor(public readonly details?: FulfillableGoalDetails, ...dependsOn: Goal[]) {
        super(getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("traffic-updater")), ...dependsOn);
    }
    public with(registration: KubernetesTrafficSwitcherRegistration): this {
        const fulfillment = registration.name || this.sdm.configuration.name;
        this.addFulfillment({
            name: fulfillment,
            goalExecutor: initiateKubernetesServiceChange(this as any as KubernetesDeploy, registration),
            pushTest: registration.pushTest,
        });
        this.updateMyGoalName(registration);
        return this;
    }

    public updateMyGoalName(registration: KubernetesTrafficSwitcherRegistration): this {
        const env = (this.details && this.details.environment) ? this.details.environment : this.environment;
        const deployType = registration.deployType;
        this.details.uniqueName = DefaultGoalNameGenerator.generateName(`k8s-traffic-switcher-${deployType}`);
        this.definition.displayName = `K8s Flip Traffic to ${BlueGreenDeploy[deployType]} deploy in \`${env}\``;
        const defaultDefinitions: Partial<GoalDefinition> = {
            canceledDescription: `Canceled: ${this.definition.displayName}`,
            completedDescription: `Completed: ${this.definition.displayName}`,
            failedDescription: `Failed: ${this.definition.displayName}`,
            plannedDescription: `Planned: ${this.definition.displayName}`,
            requestedDescription: `Requested: ${this.definition.displayName}`,
            skippedDescription: `Skipped: ${this.definition.displayName}`,
            stoppedDescription: `Stopped: ${this.definition.displayName}`,
            waitingForApprovalDescription: `Pending Approval: ${this.definition.displayName}`,
            waitingForPreApprovalDescription: `Pending Pre-Approval: ${this.definition.displayName}`,
            workingDescription: `Running: ${this.definition.displayName}`,
        };
        _.defaultsDeep(this.definition, defaultDefinitions);
        return this;
    }
}
