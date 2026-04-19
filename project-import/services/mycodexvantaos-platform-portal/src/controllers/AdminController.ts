export class AdminController {
  async getStatus(): Promise<{ admin: boolean }> {
    return { admin: true };
  }
}
