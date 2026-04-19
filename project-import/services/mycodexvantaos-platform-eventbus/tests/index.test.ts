import { EventBusService } from "../src";

describe("EventBusService", () => {
  let bus: EventBusService;

  beforeEach(() => {
    bus = new EventBusService();
  });

  it("should be instantiable", () => {
    expect(bus).toBeDefined();
    expect(bus).toBeInstanceOf(EventBusService);
  });

  it("should publish an event and return envelope", async () => {
    const envelope = await bus.publish("test.topic", { key: "value" }, "test");
    expect(envelope.id).toBeDefined();
    expect(envelope.topic).toBe("test.topic");
    expect(envelope.payload).toEqual({ key: "value" });
    expect(envelope.timestamp).toBeGreaterThan(0);
  });

  it("should subscribe and receive events", async () => {
    const received: unknown[] = [];
    bus.subscribe("orders", async (event) => {
      received.push(event.payload);
    });
    await bus.publish("orders", { orderId: 1 });
    expect(received).toHaveLength(1);
    expect(received[0]).toEqual({ orderId: 1 });
  });

  it("should unsubscribe", async () => {
    const received: unknown[] = [];
    const subId = bus.subscribe("orders", async (event) => {
      received.push(event.payload);
    });
    bus.unsubscribe("orders", subId);
    await bus.publish("orders", { orderId: 2 });
    expect(received).toHaveLength(0);
  });

  it("should track topics and subscription counts", () => {
    bus.subscribe("a", async () => {});
    bus.subscribe("a", async () => {});
    bus.subscribe("b", async () => {});
    expect(bus.getTopics()).toEqual(expect.arrayContaining(["a", "b"]));
    expect(bus.getSubscriptionCount("a")).toBe(2);
    expect(bus.getSubscriptionCount("b")).toBe(1);
    expect(bus.getSubscriptionCount("c")).toBe(0);
  });
});
