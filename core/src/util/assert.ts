export namespace Assert {
  export class NotFoundError extends Error {
    constructor(readonly entity: string) {
      super(`${entity} not found`);
      this.name = 'NotFoundError';
    }
  }

  export function create(entity: string) {
    return {
      async exists<T>(value: T | null | undefined | Promise<T | null | undefined>): Promise<T> {
        const resolved = await value;
        if (resolved === null || resolved === undefined) throw new NotFoundError(entity);
        return resolved;
      },
    };
  }
}
