export function setProcessEnvironment(t, variables) {
    for (const [name, value] of Object.entries(variables)) {
        const earlier = process.env[name];
        t.after(() => {
            if (earlier === undefined)
                delete process.env[name];
            else
                process.env[name] = earlier;
        });
        process.env[name] = value;
    }
}
//# sourceMappingURL=process-environment.js.map