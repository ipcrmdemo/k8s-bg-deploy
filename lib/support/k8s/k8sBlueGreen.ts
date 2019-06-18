import {
    DefaultGoalNameGenerator,
    FulfillableGoalDetails, FulfillableGoalWithRegistrations,
    getGoalDefinitionFrom,
    Goal,
    GoalDefinition,
} from "@atomist/sdm";
import {KubernetesDeploy, KubernetesDeployRegistration} from "@atomist/sdm-pack-k8s";
import {initiateKubernetesDeploy} from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import * as _ from "lodash";
import {BlueGreenDeploy} from "./getDeploy";

interface K8sBlueGreenDeployRegistration extends KubernetesDeployRegistration {
    deployType: BlueGreenDeploy;
}

export class KubernetesBlueGreenDeploy extends FulfillableGoalWithRegistrations<K8sBlueGreenDeployRegistration> {
    constructor(public readonly details?: FulfillableGoalDetails,
                ...dependsOn: Goal[]) {
        super({
            ...getGoalDefinitionFrom(details, DefaultGoalNameGenerator.generateName("k8s-deploy-bluegreen")),
        }, ...dependsOn);
    }

    /**
     * Register a deployment with the initiator fulfillment.
     */
    public with(registration: K8sBlueGreenDeployRegistration): this {
        const fulfillment = registration.name || this.sdm.configuration.name;
        this.addFulfillment({
            name: fulfillment,
            goalExecutor: initiateKubernetesDeploy(this as any as KubernetesDeploy, registration),
            pushTest: registration.pushTest,
        });
        this.updateMyGoalName(registration);
        return this;
    }

    public updateMyGoalName(registration: K8sBlueGreenDeployRegistration): this {
        const env = (this.details && this.details.environment) ? this.details.environment : this.environment;
        const deployType = BlueGreenDeploy[registration.deployType];
        this.definition.displayName = `K8s ${deployType} deploy to \`${env}\``;
        const defaultDefinitions: Partial<GoalDefinition> = {
            canceledDescription: `Canceled: ${this.definition.displayName}`,
            completedDescription: `Deployed: ${this.definition.displayName}`,
            failedDescription: `Failed: ${this.definition.displayName}`,
            plannedDescription: `Planned: ${this.definition.displayName}`,
            requestedDescription: `Requested: ${this.definition.displayName}`,
            skippedDescription: `Skipped: ${this.definition.displayName}`,
            stoppedDescription: `Stopped: ${this.definition.displayName}`,
            waitingForApprovalDescription: `Pending Approval: ${this.definition.displayName}`,
            waitingForPreApprovalDescription: `Pending Pre-Approval: ${this.definition.displayName}`,
            workingDescription: `Deploying: ${this.definition.displayName}`,
        };
        _.defaultsDeep(this.definition, defaultDefinitions);
        return this;
    }
}
