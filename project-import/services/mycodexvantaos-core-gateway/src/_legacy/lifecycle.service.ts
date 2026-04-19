export interface ServiceDescriptor {
  name: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}

export class LifecycleService {
  private descriptors: ServiceDescriptor[] = [];

  register(desc: ServiceDescriptor): void {
    this.descriptors.push(desc);
  }

  async startAll(): Promise<void> {
    for (const desc of this.descriptors) {
      await desc.start();
    }
  }

  async stopAll(): Promise<void> {
    for (const desc of [...this.descriptors].reverse()) {
      await desc.stop();
    }
  }
}
