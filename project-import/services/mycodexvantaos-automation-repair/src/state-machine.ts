import type { StateMachine, TransitionDef, StateTransition } from "./types";

let counter = 0;

export class StateMachineService {
  private machines = new Map<string, StateMachine>();
  private currentStates = new Map<string, string>();
  private history = new Map<string, StateTransition[]>();

  create(name: string, states: string[], transitions: TransitionDef[], initialState: string): StateMachine {
    if (!states.includes(initialState)) {
      throw new Error(`Initial state "${initialState}" not in states list`);
    }
    const id = `sm-${++counter}`;
    const machine: StateMachine = { id, name, states, transitions, initialState };
    this.machines.set(id, machine);
    this.currentStates.set(id, initialState);
    this.history.set(id, []);
    return machine;
  }

  getMachine(machineId: string): StateMachine | null {
    return this.machines.get(machineId) ?? null;
  }

  getCurrentState(machineId: string): string | null {
    return this.currentStates.get(machineId) ?? null;
  }

  transition(machineId: string, event: string): StateTransition | null {
    const machine = this.machines.get(machineId);
    if (!machine) return null;

    const currentState = this.currentStates.get(machineId);
    if (!currentState) return null;

    const validTransition = machine.transitions.find(
      (t) => t.from === currentState && t.event === event,
    );
    if (!validTransition) return null;

    const trans: StateTransition = {
      from: currentState,
      to: validTransition.to,
      event,
      timestamp: new Date(),
    };

    this.currentStates.set(machineId, validTransition.to);
    this.history.get(machineId)!.push(trans);
    return trans;
  }

  getHistory(machineId: string): StateTransition[] {
    return this.history.get(machineId) ?? [];
  }

  reset(machineId: string): boolean {
    const machine = this.machines.get(machineId);
    if (!machine) return false;
    this.currentStates.set(machineId, machine.initialState);
    this.history.set(machineId, []);
    return true;
  }

  listMachines(): StateMachine[] {
    return Array.from(this.machines.values());
  }
}