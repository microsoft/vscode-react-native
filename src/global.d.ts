interface Thenable<T> {
    then<TResult>(
        this: void,
        onfulfilled?: (value: T) => TResult | Thenable<TResult>,
        onrejected?: (reason: any) => TResult | Thenable<TResult>,
    ): Thenable<TResult>;
    then<TResult>(
        this: void,
        onfulfilled?: (value: T) => TResult | Thenable<TResult>,
        onrejected?: (reason: any) => void,
    ): Thenable<TResult>;
}
