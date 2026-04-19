export class CommandService {
  async execute(command: string, args: string[]): Promise<number> {
    console.log("Executing:", command, args.join(" "));
    return 0;
  }
}
