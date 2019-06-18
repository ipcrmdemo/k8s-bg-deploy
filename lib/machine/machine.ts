/*
 * Copyright © 2018 Atomist, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {
    goals,
    SoftwareDeliveryMachine,
    SoftwareDeliveryMachineConfiguration, ToDefaultBranch, whenPushSatisfies,
} from "@atomist/sdm";
import {
    createSoftwareDeliveryMachine,
} from "@atomist/sdm-core";
import {HasDockerfile} from "@atomist/sdm-pack-docker";
import {k8sSupport} from "@atomist/sdm-pack-k8s";
import {IsNode} from "@atomist/sdm-pack-node";
import {IsBlueDeploy, IsGreenDeploy} from "../support/pushTests";
import {
    addGoalImplementations,
    dockerBuildGoal,
    k8sBlueProd,
    k8sGreenProd,
    k8sTrafficUpdateBlue,
    k8sTrafficUpdateGreen,
    nodeVersion
} from "./goals";

/**
 * Initialize an sdm definition, and add functionality to it.
 *
 * @param configuration All the configuration for this service
 */
export function machine(
    configuration: SoftwareDeliveryMachineConfiguration,
): SoftwareDeliveryMachine {

    const sdm = createSoftwareDeliveryMachine({
        name: "Example SDM performing K8s Blue/Green Deployments",
        configuration,
    });

    /**
     * Setup Extension Packs
     */
    sdm.addExtensionPacks(
        k8sSupport(),
    );

    /**
     * Configure Goals
     */
    const buildGoals = goals("build")
        .plan(nodeVersion)
        .plan(dockerBuildGoal).after(nodeVersion);

    const k8sBlueGoal = goals("deploy-blue")
        .plan(k8sBlueProd).after(buildGoals)
        .plan(k8sTrafficUpdateBlue).after(k8sBlueProd);

    const k8sGreenGoal = goals("deploy-green")
        .plan(k8sGreenProd).after(buildGoals)
        .plan(k8sTrafficUpdateGreen).after(k8sGreenProd);

    /**
     * Define Push Rules
     */
    sdm.withPushRules(
        whenPushSatisfies(HasDockerfile, IsNode)
            .setGoals(buildGoals),
        whenPushSatisfies(HasDockerfile, IsNode, ToDefaultBranch, IsBlueDeploy)
            .setGoals(k8sBlueGoal),
        whenPushSatisfies(HasDockerfile, IsNode, ToDefaultBranch, IsGreenDeploy)
            .setGoals(k8sGreenGoal),
    );

    /**
     * Add Required Goal Implementations
     */
    addGoalImplementations(sdm);
    return sdm;
}
