export class Mutex {
  private queue: Array<() => void> = [];
  private locked = false;

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      const execute = async () => {
        this.locked = true;
        try {
          const result = await fn();
          resolve(result);
        } catch (err) {
          reject(err);
        } finally {
          this.locked = false;
          this.next();
        }
      };

      if (!this.locked) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }

  private next() {
    if (this.queue.length > 0) {
      const next = this.queue.shift()!;
      next();
    }
  }
}