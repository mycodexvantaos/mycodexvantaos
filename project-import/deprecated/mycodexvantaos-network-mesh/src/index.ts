import pino from "pino";

const logger = pino({ name: "network-mesh" });

export * from "./types";
export { ServiceDiscoveryService } from "./service-discovery";
export { LoadBalancerService } from "./load-balancer";
export type { BalancingStrategy } from "./load-balancer";
export { GatewayService } from "./gateway";

export async function bootstrap(): Promise<void> {
  logger.info("network-mesh initialized");
}