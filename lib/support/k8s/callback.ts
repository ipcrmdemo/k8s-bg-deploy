import {HandlerContext, logger} from "@atomist/automation-client";
import { SdmGoalEvent } from "@atomist/sdm";
import { KubernetesApplication } from "@atomist/sdm-pack-k8s";
import { ApplicationDataCallback } from "@atomist/sdm-pack-k8s/lib/deploy/goal";
import * as _ from "lodash";
import {BlueGreenDeploy, getNextDeploy} from "./getDeploy";

const setBgDeploymentDetails = async (
    e: SdmGoalEvent,
    a: KubernetesApplication,
    ctx: HandlerContext,
): Promise<KubernetesApplication> => {
    if (e.uniqueName.includes("k8s-deploy-bluegreen")) {
        const activeDeploy = await getNextDeploy(ctx, e.repo.name);
        logger.debug(`setBgDeploymentDetails => This deploy is ${BlueGreenDeploy[activeDeploy]}`);
        a.name = `${a.name}${BlueGreenDeploy[activeDeploy]}`;
        a.path = `/${a.ns}/${a.name}`;
    }

    return a;
};

export const k8sCallback: ApplicationDataCallback = async (a, p, g, e, ctx) => {
    a.ns = e.environment.includes("prod") ? "production" : "testing";
    a.path = `/${a.ns}/${p.name}`;
    const app = await setBgDeploymentDetails(e, a, ctx);

    let annotations: any;
    if (
        app.ingressSpec &&
        app.ingressSpec.metadata &&
        app.ingressSpec.metadata.annotations
    ) {
        annotations = _.merge({
                "kubernetes.io/ingress.class": "nginx",
                "nginx.ingress.kubernetes.io/rewrite-target": "/",
                "nginx.ingress.kubernetes.io/ssl-redirect": "false",
            },
            a.ingressSpec.metadata.annotations,
        );
    } else {
        annotations = {
            "kubernetes.io/ingress.class": "nginx",
            "nginx.ingress.kubernetes.io/rewrite-target": "/",
            "nginx.ingress.kubernetes.io/ssl-redirect": "false",
        };
    }

    a.ingressSpec = _.merge(a.ingressSpec, {
        metadata: {
            annotations,
        },
    });

    return app;
};
