import { randomBytes } from 'node:crypto';
/**
 * CodexvantaOS — automation-core / StateMachineService
 * Finite state machine for workflow state management
 */
import { getProviders } from '../providers.js';
import type * as T from '../types/index.js';

export interface StateMachineDef { id: string; name: string; initialState: string; states: Record<string, StateConfig>; }
export interface StateConfig { transitions: Record<string, string>; onEnter?: string; onExit?: string; }
export interface StateMachineInstance { id: string; definitionId: string; currentState: string; history: Array<{ from: string; to: string; event: string; timestamp: number }>; context: Record<string, unknown>; createdAt: number; }

export class StateMachineService {
  private get providers() { return getProviders(); }

  async define(name: string, initialState: string, states: Record<string, StateConfig>): Promise<StateMachineDef> {
    const id = `sm-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const def: StateMachineDef = { id, name, initialState, states };
    await this.providers.stateStore.set(`automation:sm:def:${id}`, def);
    return def;
  }

  async createInstance(definitionId: string, context?: Record<string, unknown>): Promise<StateMachineInstance> {
    const def = (await this.providers.stateStore.get<StateMachineDef>(`automation:sm:def:${definitionId}`))?.value;
    if (!def) throw new Error(`State machine definition not found: ${definitionId}`);
    const id = `smi-${Date.now()}-${randomBytes(3).toString('hex').slice(0, 6)}`;
    const instance: StateMachineInstance = { id, definitionId, currentState: def.initialState, history: [], context: context ?? {}, createdAt: Date.now() };
    await this.providers.stateStore.set(`automation:sm:instance:${id}`, instance);
    return instance;
  }

  async transition(instanceId: string, event: string): Promise<StateMachineInstance> {
    const instance = (await this.providers.stateStore.get<StateMachineInstance>(`automation:sm:instance:${instanceId}`))?.value;
    if (!instance) throw new Error(`Instance not found: ${instanceId}`);
    const def = (await this.providers.stateStore.get<StateMachineDef>(`automation:sm:def:${instance.definitionId}`))?.value;
    if (!def) throw new Error(`Definition not found: ${instance.definitionId}`);
    const stateConfig = def.states[instance.currentState];
    if (!stateConfig) throw new Error(`Invalid state: ${instance.currentState}`);
    const nextState = stateConfig.transitions[event];
    if (!nextState) throw new Error(`No transition for event "${event}" from state "${instance.currentState}"`);
    if (!def.states[nextState]) throw new Error(`Invalid target state: ${nextState}`);
    instance.history.push({ from: instance.currentState, to: nextState, event, timestamp: Date.now() });
    instance.currentState = nextState;
    await this.providers.stateStore.set(`automation:sm:instance:${instanceId}`, instance);
    this.providers.observability.debug('State transition', { instanceId, event, from: instance.history[instance.history.length - 1].from, to: nextState });
    return instance;
  }

  async getInstance(instanceId: string): Promise<StateMachineInstance | null> {
    return (await this.providers.stateStore.get<StateMachineInstance>(`automation:sm:instance:${instanceId}`))?.value ?? null;
  }
}
