/** Fixed-size circular buffer for numeric time-series data */
export class HistoryBuffer {
  private data: number[] = [];
  constructor(public readonly capacity: number) {}

  push(value: number): void {
    this.data.push(value);
    if (this.data.length > this.capacity) this.data.shift();
  }

  get(): number[] {
    return [...this.data];
  }
}
