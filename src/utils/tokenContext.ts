class TokenContext {
    constructor() {
        this.resetTokens();
    }

    _aggregate_prompt_tokens = 0;
    _aggregate_total_tokens = 0;
    _aggregate_completion_tokens = 0;

    resetTokens() {
        this._aggregate_prompt_tokens = 0;
        this._aggregate_total_tokens = 0;
        this._aggregate_completion_tokens = 0;
    }

    addTokens({ prompt_tokens = 0, total_tokens = 0, completion_tokens = 0 }) {
        this._aggregate_prompt_tokens += prompt_tokens;
        this._aggregate_total_tokens += total_tokens;
        this._aggregate_completion_tokens += completion_tokens;
    }

    fetchContext() {
        return {
            aggregate_prompt_tokens: this.aggregate_prompt_tokens,
            aggregate_total_tokens: this.aggregate_total_tokens,
            aggregate_completion_tokens: this.aggregate_completion_tokens
        };
    }

    get aggregate_prompt_tokens() {
        return this._aggregate_prompt_tokens;
    }

    get aggregate_total_tokens() {
        return this._aggregate_total_tokens;
    }

    get aggregate_completion_tokens() {
        return this._aggregate_completion_tokens;
    }
}

// Export an instance so it can be used across your application
export default TokenContext;