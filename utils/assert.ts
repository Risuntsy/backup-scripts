export function assert(condition: unknown, message: string): asserts condition {
    if (!condition) {
        throw new Error(message);
    }
}

export function assertExists<T>(value: T, message?: string): asserts value is NonNullable<T> {
    if (value === undefined || value === null) {
        throw new Error(message || "Expected value exists");
    }
}

export function assertAllExists<T>(
    values: T[],
    message?: string,
): asserts values is NonNullable<T>[] {
    values.forEach(value => assertExists(value, message));
}

export function isDefined<T>(value: T): boolean {
    return value !== undefined && value !== null;
}

export function isNullOrUndefined<T>(value: T): boolean {
    return value === null || value === undefined;
}
