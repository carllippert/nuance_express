type ContextValue = number | any[];
type ContextValues<T> = {
    [K in keyof T]: ContextValue;
};

export class Context<T extends Record<string, ContextValue>> {
    private keys: ContextValues<T>;

    constructor(initialValues: ContextValues<T>) {
        this.keys = initialValues;
    }

    resetContext(initialValues: ContextValues<T>): void {
        this.keys = initialValues;
    }

    addValues(values: Partial<ContextValues<T>>): void {
        for (const key in values) {
            const currentValue = this.keys[key];
            const valueToAdd = values[key];

            if (currentValue !== undefined && valueToAdd !== undefined) {
                if (typeof currentValue === 'number' && typeof valueToAdd === 'number') {
                    this.keys[key] = currentValue + valueToAdd;
                } else if (Array.isArray(currentValue) && Array.isArray(valueToAdd)) {
                    // Concatenate arrays, regardless of their element types
                    this.keys[key] = [...currentValue, ...valueToAdd];
                } else {
                    // Handle mismatched types according to your needs
                    console.warn(`Mismatched types for key ${key}: cannot add or combine values of different types.`);
                }
            }
        }
    }

    fetchContext(): ContextValues<T> {
        return { ...this.keys };
    }
}