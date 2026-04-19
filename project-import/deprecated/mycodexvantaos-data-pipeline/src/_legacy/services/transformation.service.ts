/**
 * CodexvantaOS — data-pipeline / TransformationService
 * Data transformation pipelines
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export type TransformType = 'map' | 'filter' | 'aggregate' | 'join' | 'flatten' | 'custom';
export interface TransformStep { name: string; type: TransformType; config: Record<string, unknown>; }

export class TransformationService {
  private get providers() { return getProviders(); }

  async transform(data: unknown[], steps: TransformStep[]): Promise<unknown[]> {
    let result = [...data];
    for (const step of steps) {
      const before = result.length;
      switch (step.type) {
        case 'map': result = result.map(item => this.applyMapping(item, step.config)); break;
        case 'filter': result = result.filter(item => this.applyFilter(item, step.config)); break;
        case 'aggregate': result = [this.applyAggregate(result, step.config)]; break;
        case 'flatten': result = result.flat(step.config['depth'] as number ?? 1); break;
        default: break;
      }
      this.providers.observability.debug('Transform step applied', { step: step.name, before, after: result.length });
    }
    return result;
  }

  async transformStream(inputTopic: string, outputTopic: string, steps: TransformStep[]): Promise<void> {
    const process = async () => {
      const msg = await this.providers.queue.dequeue(inputTopic);
      if (msg) {
        const transformed = await this.transform([msg.payload], steps);
        for (const item of transformed) await this.providers.queue.enqueue(outputTopic, item);
        await this.providers.queue.ack(inputTopic, msg.id);
      }
    };
    if (this.providers.queue.subscribe) {
      await this.providers.queue.subscribe(inputTopic, async (msg) => {
        const transformed = await this.transform([msg.payload], steps);
        for (const item of transformed) await this.providers.queue.enqueue(outputTopic, item);
      });
    } else { await process(); }
  }

  private applyMapping(item: unknown, config: Record<string, unknown>): unknown {
    if (typeof item !== 'object' || !item) return item;
    const fieldMap = config['fields'] as Record<string, string> ?? {};
    const result: Record<string, unknown> = {};
    for (const [newKey, oldKey] of Object.entries(fieldMap)) result[newKey] = (item as any)[oldKey];
    return Object.keys(result).length > 0 ? result : item;
  }

  private applyFilter(item: unknown, config: Record<string, unknown>): boolean {
    if (typeof item !== 'object' || !item) return true;
    const conditions = config['conditions'] as Record<string, unknown> ?? {};
    for (const [key, expected] of Object.entries(conditions)) { if ((item as any)[key] !== expected) return false; }
    return true;
  }

  private applyAggregate(items: unknown[], config: Record<string, unknown>): unknown {
    const op = config['operation'] as string ?? 'count';
    const field = config['field'] as string;
    switch (op) {
      case 'count': return { count: items.length };
      case 'sum': return { sum: items.reduce((acc: number, i) => acc + (Number((i as any)?.[field]) || 0), 0) };
      case 'avg': { const vals = items.map(i => Number((i as any)?.[field]) || 0); return { avg: vals.reduce((a, b) => a + b, 0) / vals.length }; }
      default: return { count: items.length };
    }
  }
}
